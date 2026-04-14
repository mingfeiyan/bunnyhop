-- Backfill for migration 019. Runs after 019 is applied.
--
-- 1. Carry Ryan's Family's existing invite code. Historically every trip's
--    `trips.invite_code` was handed to Kiku (Ryan's agent), so we map each
--    existing trip's code to Ryan's Family in `trip_family_invites`. Other
--    families on each trip will get fresh auto-generated codes.
-- 2. Materialize (trip, family) invite rows for every family that currently
--    has participants on each trip. The trigger only fires on new inserts,
--    so existing participants need an explicit backfill.
-- 3. Set `timeline_events.family_id` based on the rule:
--    - Kiku-authored rows -> Ryan's Family
--    - Titles containing "(You Family)" or "(Frances" -> Ryan's Family
--    - All others -> family of `added_by` (via family_members)

do $$
declare
  ryan_id uuid;
begin
  select id into ryan_id from families where name = 'Ryan''s Family';

  -- 1. Ryan keeps each trip's existing invite_code.
  insert into trip_family_invites (trip_id, family_id, invite_code)
  select t.id, ryan_id, t.invite_code
  from trips t
  on conflict (trip_id, family_id) do nothing;

  -- 2. Ensure every (trip, family-with-participants) pair has a row.
  -- Distinct on trip_id, family_id — fresh codes via default for families
  -- other than Ryan's.
  insert into trip_family_invites (trip_id, family_id)
  select distinct tp.trip_id, fm.family_id
  from trip_participants tp
  join family_members fm on fm.user_id = tp.user_id
  on conflict (trip_id, family_id) do nothing;
end $$;

-- 3a. Kiku-authored events -> Ryan's Family.
update timeline_events te
set family_id = f.id
from families f, family_members fm
where fm.user_id = te.added_by
  and fm.family_id = f.id
  and f.name = 'Ryan''s Family'
  and te.family_id is null;

-- 3b. Specific titles flagged as Ryan's (posted via Yan's by-code code).
update timeline_events te
set family_id = (select id from families where name = 'Ryan''s Family')
where (te.title ilike '%(You Family)%' or te.title ilike '%(Frances%')
  and te.family_id is distinct from (select id from families where name = 'Ryan''s Family');

-- 3c. Everything else: resolve via added_by -> family_members.
update timeline_events te
set family_id = fm.family_id
from family_members fm
where fm.user_id = te.added_by
  and te.family_id is null;
