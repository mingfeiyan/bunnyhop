-- When any family member joins a trip, automatically add all other HUMAN
-- members of the same family as participants. This means if Ryan joins
-- a trip, Frances and Rongchang see it immediately without needing
-- separate invite links.
--
-- Implemented as a trigger so it fires regardless of how the participant
-- was added (invite page, direct SQL, agent API, etc.). Idempotent via
-- ON CONFLICT DO NOTHING. Only adds human family members, not agents.
--
-- The trigger fires on its own inserts too (cascading), but since the
-- re-inserts conflict on (trip_id, user_id) and do nothing, the cascade
-- terminates after one round with no extra rows.

create or replace function auto_add_family_to_trip()
returns trigger as $$
begin
  insert into trip_participants (trip_id, user_id, role)
  select new.trip_id, fm2.user_id, 'member'
  from family_members fm1
  join family_members fm2 on fm2.family_id = fm1.family_id
  where fm1.user_id = new.user_id
    and fm2.user_id is not null
    and fm2.user_id != new.user_id
    and fm2.member_type = 'human'
  on conflict (trip_id, user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

create trigger trg_auto_add_family
after insert on trip_participants
for each row
execute function auto_add_family_to_trip();
