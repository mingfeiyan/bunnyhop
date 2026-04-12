-- Drop the old per-trip family system. The global families/family_members
-- tables (migration 014) replace it. The app no longer reads from
-- family_groups or trip_participants.family_group_id.

-- First drop the FK column on trip_participants
alter table trip_participants drop column if exists family_group_id;

-- Then drop the family_groups table (CASCADE handles any remaining FKs)
drop table if exists family_groups cascade;
