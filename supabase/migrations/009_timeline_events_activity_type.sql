-- Allow 'activity' type in timeline_events for confirmed activity bookings
-- (e.g., scheduled tours, dinner reservations, spa appointments)
alter table timeline_events drop constraint timeline_events_type_check;
alter table timeline_events add constraint timeline_events_type_check
  check (type in ('flight', 'hotel', 'activity'));
