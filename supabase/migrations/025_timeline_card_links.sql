-- Migration 025: link timeline events to cards + planned/visited/skipped status.
--
-- Why: lets the agent and UI mark a card as "committed" (planned for a date)
-- or "visited" (actually went). Also adds 'restaurant' as a first-class
-- timeline type so eateries render distinctly from generic activities.

-- 1. Extend type constraint to include 'restaurant'.
alter table timeline_events drop constraint timeline_events_type_check;
alter table timeline_events add constraint timeline_events_type_check
  check (type in ('flight', 'hotel', 'activity', 'airbnb', 'cruise', 'restaurant'));

-- 2. Nullable FK to cards. ON DELETE SET NULL so deleting a card doesn't
-- wipe the history of what happened on the trip.
alter table timeline_events
  add column card_id uuid references cards(id) on delete set null;

create index idx_timeline_events_card on timeline_events(card_id)
  where card_id is not null;

-- 3. Status column. Existing rows are backfilled to 'planned' — they
-- represent bookings that were committed but not yet confirmed as visited.
alter table timeline_events
  add column status text not null default 'planned'
  check (status in ('planned', 'visited', 'skipped'));
