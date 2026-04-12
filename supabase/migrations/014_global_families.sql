-- Global families — exist independently of any trip. Replaces the per-trip
-- family_groups system. When family members appear on a timeline or trip
-- hub, their family name + color is looked up globally via family_members
-- instead of through trip_participants.family_group_id.
--
-- The old family_groups table and trip_participants.family_group_id column
-- are kept for now (backward compat) but are no longer read by the app
-- after this migration. A follow-up cleanup will drop them.

create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default 'indigo',
  created_by uuid references auth.users(id) not null,
  created_at timestamptz default now()
);

create table family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id) on delete cascade not null,
  user_id uuid references auth.users(id),
  display_name text not null,
  member_type text not null check (member_type in ('human', 'agent')) default 'human',
  agent_identifier text unique,
  created_at timestamptz default now(),
  unique (family_id, user_id)
);

-- RLS: readable by any authenticated user (family info is organizational
-- metadata, not secret). Writeable only by admins via service role.
alter table families enable row level security;
alter table family_members enable row level security;

create policy "Authenticated users can view families"
  on families for select to authenticated using (true);

create policy "Authenticated users can view family members"
  on family_members for select to authenticated using (true);

-- Seed the two known families with their members.
-- Yan Family (indigo): Mingfei, Yue Ning, agent Awesome Bunny
-- Ryan's Family (amber): Frances, Rongchang, agent Kiku

do $$
declare
  yan_id uuid;
  ryan_id uuid;
begin
  insert into families (name, color, created_by)
  values ('Yan Family', 'indigo', '957f72f0-c934-4fc4-87e4-c9aebcdc7116')
  returning id into yan_id;

  insert into families (name, color, created_by)
  values ('Ryan''s Family', 'amber', '957f72f0-c934-4fc4-87e4-c9aebcdc7116')
  returning id into ryan_id;

  -- Yan Family members
  insert into family_members (family_id, user_id, display_name, member_type) values
    (yan_id, '957f72f0-c934-4fc4-87e4-c9aebcdc7116', 'Mingfei', 'human'),
    (yan_id, '60096791-dea6-46ba-9982-ef05d1067768', 'Yue Ning', 'human');

  -- Ryan's Family members
  insert into family_members (family_id, user_id, display_name, member_type) values
    (ryan_id, 'd0c0d237-6ae2-41e5-9714-fc8253385732', 'Frances', 'human'),
    (ryan_id, 'bb1fbc14-aeca-4a7b-b9e2-6c9eaa4e3f18', 'Rongchang', 'human'),
    (ryan_id, 'f42fe704-bc3b-4b50-9ccc-9d45fd092041', 'Kiku', 'agent');
end $$;
