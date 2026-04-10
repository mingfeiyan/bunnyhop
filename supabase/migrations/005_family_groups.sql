-- Family Groups
create table family_groups (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade not null,
  name text not null,
  color text not null,
  created_at timestamptz default now(),
  unique (trip_id, name)
);

create index idx_family_groups_trip on family_groups(trip_id);

-- Add family_group_id to trip_participants
alter table trip_participants
  add column family_group_id uuid references family_groups(id) on delete set null;

-- Add timezone to trips
alter table trips
  add column timezone text;

-- RLS for family_groups
alter table family_groups enable row level security;

create policy "Participants can view family groups"
  on family_groups for select
  using (is_trip_member(trip_id));

create policy "Organizer can create family groups"
  on family_groups for insert
  with check (
    exists (
      select 1 from trip_participants
      where trip_id = family_groups.trip_id
        and user_id = auth.uid()
        and role = 'organizer'
    )
  );

create policy "Organizer can update family groups"
  on family_groups for update
  using (
    exists (
      select 1 from trip_participants
      where trip_id = family_groups.trip_id
        and user_id = auth.uid()
        and role = 'organizer'
    )
  );

create policy "Organizer can delete family groups"
  on family_groups for delete
  using (
    exists (
      select 1 from trip_participants
      where trip_id = family_groups.trip_id
        and user_id = auth.uid()
        and role = 'organizer'
    )
  );

-- Security-definer function to update only family_group_id (narrow scope)
create or replace function assign_family_group(p_participant_id uuid, p_family_group_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.trip_participants
  set family_group_id = p_family_group_id
  where id = p_participant_id
    and trip_id in (
      select trip_id from public.trip_participants
      where user_id = auth.uid() and role = 'organizer'
    );
$$;

-- Enable Realtime on family_groups
alter publication supabase_realtime add table family_groups;
