-- Enable RLS on all tables
alter table trips enable row level security;
alter table trip_participants enable row level security;
alter table trip_context enable row level security;
alter table cards enable row level security;
alter table swipes enable row level security;

-- Trips: participants can read, creator can insert
create policy "Participants can view trips"
  on trips for select
  using (id in (select trip_id from trip_participants where user_id = auth.uid()));

create policy "Anyone can read trip by invite code"
  on trips for select
  using (true);

create policy "Authenticated users can create trips"
  on trips for insert
  with check (auth.uid() = created_by);

-- Trip Participants
create policy "Participants can view co-participants"
  on trip_participants for select
  using (trip_id in (select trip_id from trip_participants where user_id = auth.uid()));

create policy "Users can join trips"
  on trip_participants for insert
  with check (auth.uid() = user_id);

-- Trip Context
create policy "Participants can view trip context"
  on trip_context for select
  using (trip_id in (select trip_id from trip_participants where user_id = auth.uid()));

create policy "Participants can add context"
  on trip_context for insert
  with check (
    auth.uid() = added_by
    and trip_id in (select trip_id from trip_participants where user_id = auth.uid())
  );

-- Cards
create policy "Participants can view cards"
  on cards for select
  using (trip_id in (select trip_id from trip_participants where user_id = auth.uid()));

create policy "Participants can add cards"
  on cards for insert
  with check (trip_id in (select trip_id from trip_participants where user_id = auth.uid()));

-- Swipes
create policy "Participants can view swipes"
  on swipes for select
  using (card_id in (
    select id from cards where trip_id in (
      select trip_id from trip_participants where user_id = auth.uid()
    )
  ));

create policy "Users can swipe"
  on swipes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their swipe"
  on swipes for update
  using (auth.uid() = user_id);
