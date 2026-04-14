-- Symmetric trigger to ensure_trip_family_invite. The trigger from 019 fires
-- on trip_participants insert; if a user joins trips BEFORE being placed in
-- a family, no invite rows get created. When admin later adds them to a
-- family, this trigger materializes trip_family_invites for every trip
-- they already participate in. Together the two triggers guarantee that
-- every (trip, family) pair where both relationships exist has a code,
-- regardless of which side was added first.

create or replace function ensure_invites_for_new_family_member()
returns trigger as $$
begin
  insert into trip_family_invites (trip_id, family_id)
  select tp.trip_id, new.family_id
  from trip_participants tp
  where tp.user_id = new.user_id
  on conflict (trip_id, family_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_ensure_invites_for_new_family_member
after insert on family_members
for each row
when (new.user_id is not null)
execute function ensure_invites_for_new_family_member();
