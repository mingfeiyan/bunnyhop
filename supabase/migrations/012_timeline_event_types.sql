-- Extend the timeline_events.type check constraint to include 'airbnb' and
-- 'cruise' as first-class types alongside the existing flight/hotel/activity.
--
-- Why: a hotel and an Airbnb behave the same lifecycle-wise (check-in /
-- check-out) but the user wants to see them rendered distinctly on the
-- timeline (different kicker labels, different icons, distinct mental model).
-- Same for cruises — they're "hotels at sea" but the kicker should say
-- "cruise · board" / "cruise · disembark" instead of "hotel · check-in".
--
-- Backward compatible: existing 'hotel' rows still validate. The matching
-- code in src/lib/timeline-events.ts handles all five types via shared
-- check_in / check_out phase logic.

alter table timeline_events drop constraint timeline_events_type_check;
alter table timeline_events add constraint timeline_events_type_check
  check (type in ('flight', 'hotel', 'activity', 'airbnb', 'cruise'));

-- Migrate the two existing events that should be re-typed:
--   - Coeur d'Alene Airbnb (currently type='hotel', details.platform='Airbnb')
--   - Disney Cruise (currently type='hotel', details.cruise_line='Disney Cruise Line')
--
-- These updates are idempotent — running twice changes nothing.

update timeline_events
   set type = 'airbnb'
 where type = 'hotel'
   and details->>'platform' = 'Airbnb';

update timeline_events
   set type = 'cruise'
 where type = 'hotel'
   and (details->>'cruise_line' is not null or title ilike '%cruise%');
