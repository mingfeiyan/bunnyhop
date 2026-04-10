-- Timeline Events: structured booking data (flights, hotels)
-- Replaces the trip_context flight/hotel pattern with proper schema columns

create table timeline_events (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade not null,
  type text not null check (type in ('flight', 'hotel')),

  -- Display
  title text not null,

  -- Timing
  start_date date not null,
  end_date date,
  start_time text,
  end_time text,

  -- Flight-specific (nullable for hotels)
  origin text,
  destination text,

  -- Common
  reference text,
  details jsonb default '{}'::jsonb,

  added_by uuid references auth.users(id) not null,
  source text not null default 'manual' check (source in ('manual', 'agent', 'email')),
  created_at timestamptz default now()
);

create index idx_timeline_events_trip on timeline_events(trip_id);

-- RLS
alter table timeline_events enable row level security;

create policy "Participants can view timeline events"
  on timeline_events for select
  using (is_trip_member(trip_id));

create policy "Participants can add timeline events"
  on timeline_events for insert
  with check (
    auth.uid() = added_by
    and is_trip_member(trip_id)
  );

create policy "Creator or organizer can delete timeline events"
  on timeline_events for delete
  using (
    auth.uid() = added_by
    or exists (
      select 1 from trip_participants
      where trip_id = timeline_events.trip_id
        and user_id = auth.uid()
        and role = 'organizer'
    )
  );

-- Enable Realtime
alter publication supabase_realtime add table timeline_events;
