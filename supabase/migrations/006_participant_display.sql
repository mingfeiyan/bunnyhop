-- Function to get trip participants with display info from auth.users
-- Uses security definer to access auth.users (not accessible via anon key)
create or replace function get_trip_participants_with_email(p_trip_id uuid)
returns table (
  id uuid,
  trip_id uuid,
  user_id uuid,
  role text,
  family_group_id uuid,
  created_at timestamptz,
  email text
)
language sql
security definer
set search_path = ''
as $$
  select
    tp.id,
    tp.trip_id,
    tp.user_id,
    tp.role,
    tp.family_group_id,
    tp.created_at,
    u.email
  from public.trip_participants tp
  join auth.users u on u.id = tp.user_id
  where tp.trip_id = p_trip_id
    and exists (
      select 1 from public.trip_participants
      where trip_id = p_trip_id and user_id = auth.uid()
    );
$$;
