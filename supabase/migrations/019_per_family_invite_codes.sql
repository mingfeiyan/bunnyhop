-- Per-family invite codes. The old single `trips.invite_code` attributed every
-- agent-submitted event to the trip creator, which meant Kiku (Ryan's family
-- agent) submissions showed up under the trip creator's family. Each family
-- joined to a trip now gets its own invite code. The by-code API routes
-- resolve the code to a (trip, family) pair so events are attributed to the
-- actual posting family.
--
-- Also adds `family_id` on `timeline_events` as the canonical family
-- attribution, replacing the "infer from added_by via family_members" logic
-- used by the timeline page.

create table trip_family_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade not null,
  family_id uuid references families(id) on delete cascade not null,
  invite_code text unique not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  created_at timestamptz default now(),
  unique (trip_id, family_id)
);

create index idx_tfi_invite_code on trip_family_invites(invite_code);
create index idx_tfi_trip_family on trip_family_invites(trip_id, family_id);

alter table trip_family_invites enable row level security;

-- Trip participants can view the invite codes for their trip (so family
-- members can read their own code to hand to their agent).
create policy "Participants see their trip's family codes"
  on trip_family_invites for select to authenticated using (
    exists (
      select 1 from trip_participants tp
      where tp.trip_id = trip_family_invites.trip_id
        and tp.user_id = auth.uid()
    )
  );

-- Auto-generate a (trip, family) invite when a family member joins a trip.
-- Idempotent via the (trip_id, family_id) unique constraint.
create or replace function ensure_trip_family_invite()
returns trigger as $$
begin
  insert into trip_family_invites (trip_id, family_id)
  select new.trip_id, fm.family_id
  from family_members fm
  where fm.user_id = new.user_id
  on conflict (trip_id, family_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_ensure_trip_family_invite
after insert on trip_participants
for each row
execute function ensure_trip_family_invite();

-- Canonical family attribution for timeline events. Set on insert by both
-- the by-code route (from the invite's family) and the authenticated route
-- (from the poster's family_members lookup). Nullable to keep the schema
-- forgiving; a null family_id falls back to the added_by-based lookup.
alter table timeline_events add column family_id uuid references families(id);
create index idx_timeline_events_family_id on timeline_events(family_id);
