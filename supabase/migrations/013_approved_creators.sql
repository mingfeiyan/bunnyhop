-- Trip creation whitelist. Only users in this table can create new trips.
-- Everyone else can still sign in, view trips they're invited to, and post
-- to timelines via the agent API — they just can't create NEW trips.
--
-- The is_admin flag marks the site admin who can manage this list via /admin.
-- Seeded with Mingfei as the first admin + approved creator.

create table approved_creators (
  user_id uuid references auth.users(id) primary key,
  is_admin boolean not null default false,
  approved_by uuid references auth.users(id) not null,
  created_at timestamptz default now()
);

alter table approved_creators enable row level security;

-- Any authenticated user can check if they're approved (the /trips/new page
-- needs this to decide whether to show the form or a "not approved" message).
create policy "Authenticated users can check approved status"
  on approved_creators for select
  to authenticated
  using (true);

-- Admin writes (approve/revoke) go through the service role client in the
-- /admin server component, so no INSERT/UPDATE/DELETE RLS policy is needed
-- for regular users. The service role bypasses RLS.

-- Seed Mingfei as the first admin + approved creator
insert into approved_creators (user_id, is_admin, approved_by)
values (
  '957f72f0-c934-4fc4-87e4-c9aebcdc7116',
  true,
  '957f72f0-c934-4fc4-87e4-c9aebcdc7116'
);
