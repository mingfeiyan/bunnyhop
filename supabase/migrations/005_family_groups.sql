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

-- Allow organizer to update family_group_id on trip_participants
create policy "Organizer can assign family groups"
  on trip_participants for update
  using (
    exists (
      select 1 from trip_participants tp
      where tp.trip_id = trip_participants.trip_id
        and tp.user_id = auth.uid()
        and tp.role = 'organizer'
    )
  );

-- Enable Realtime on family_groups
alter publication supabase_realtime add table family_groups;
