-- Fix infinite recursion in RLS policies
-- The trip_participants SELECT policy was querying trip_participants itself.
-- Solution: use a security definer function that bypasses RLS for membership checks.

-- Create a helper function that checks trip membership without triggering RLS
create or replace function is_trip_member(p_trip_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_participants
    where trip_id = p_trip_id and user_id = auth.uid()
  );
$$;

-- Drop ALL existing policies to recreate cleanly
drop policy if exists "Participants can view trips" on trips;
drop policy if exists "Anyone can read trip by invite code" on trips;
drop policy if exists "Authenticated users can create trips" on trips;
drop policy if exists "Participants can view co-participants" on trip_participants;
drop policy if exists "Users can join trips" on trip_participants;
drop policy if exists "Participants can view trip context" on trip_context;
drop policy if exists "Participants can add context" on trip_context;
drop policy if exists "Participants can view cards" on cards;
drop policy if exists "Participants can add cards" on cards;
drop policy if exists "Participants can view swipes" on swipes;
drop policy if exists "Users can swipe" on swipes;
drop policy if exists "Users can update their swipe" on swipes;

-- Recreate policies using the helper function

-- Trips: use the function for participant check, keep open read for invite lookup
create policy "Participants can view trips"
  on trips for select
  using (is_trip_member(id) or true);

create policy "Authenticated users can create trips"
  on trips for insert
  with check (auth.uid() = created_by);

-- Trip Participants: allow users to see rows for trips they belong to
create policy "Participants can view co-participants"
  on trip_participants for select
  using (is_trip_member(trip_id));

-- Trip Context
create policy "Participants can view trip context"
  on trip_context for select
  using (is_trip_member(trip_id));

create policy "Participants can add context"
  on trip_context for insert
  with check (
    auth.uid() = added_by
    and is_trip_member(trip_id)
  );

-- Cards
create policy "Participants can view cards"
  on cards for select
  using (is_trip_member(trip_id));

create policy "Participants can add cards"
  on cards for insert
  with check (is_trip_member(trip_id));

-- Trip Participants: users can join
create policy "Users can join trips"
  on trip_participants for insert
  with check (auth.uid() = user_id);

-- Swipes
create policy "Participants can view swipes"
  on swipes for select
  using (card_id in (
    select id from cards where is_trip_member(trip_id)
  ));

create policy "Users can swipe"
  on swipes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their swipe"
  on swipes for update
  using (auth.uid() = user_id);
