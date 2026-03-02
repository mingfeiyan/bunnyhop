-- Trips
create table trips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  destination text not null,
  date_start date not null,
  date_end date not null,
  created_by uuid references auth.users(id) not null,
  invite_code text unique not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  created_at timestamptz default now()
);

-- Trip Participants
create table trip_participants (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  role text not null default 'member' check (role in ('organizer', 'member')),
  created_at timestamptz default now(),
  unique (trip_id, user_id)
);

-- Trip Context
create table trip_context (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade not null,
  type text not null check (type in ('flight', 'hotel', 'constraint', 'note')),
  raw_text text not null,
  details jsonb default '{}'::jsonb,
  added_by uuid references auth.users(id) not null,
  source text not null default 'manual' check (source in ('manual', 'email', 'agent')),
  created_at timestamptz default now()
);

-- Cards
create table cards (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade not null,
  title text not null,
  tagline text,
  description text,
  category text not null check (category in ('restaurant', 'activity', 'sightseeing')),
  source text not null default 'ai_generated' check (source in ('ai_generated', 'user_added')),
  image_url text,
  metadata jsonb default '{}'::jsonb,
  added_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Swipes
create table swipes (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  preference text not null check (preference in ('want', 'pass', 'indifferent')),
  created_at timestamptz default now(),
  unique (card_id, user_id)
);

-- Indexes
create index idx_trip_participants_trip on trip_participants(trip_id);
create index idx_trip_participants_user on trip_participants(user_id);
create index idx_trip_context_trip on trip_context(trip_id);
create index idx_cards_trip on cards(trip_id);
create index idx_swipes_card on swipes(card_id);
create index idx_swipes_user on swipes(user_id);
create index idx_trips_invite_code on trips(invite_code);
