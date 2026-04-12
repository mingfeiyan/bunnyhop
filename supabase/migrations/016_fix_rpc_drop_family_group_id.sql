-- The get_trip_participants_with_email RPC was still selecting
-- tp.family_group_id which was dropped in migration 015. This caused
-- the RPC to fail, making participant count show 0 on the trip hub.

drop function if exists get_trip_participants_with_email(uuid);

create function get_trip_participants_with_email(p_trip_id uuid)
returns table (
  id uuid,
  trip_id uuid,
  user_id uuid,
  role text,
  created_at timestamptz,
  email text
)
language sql security definer
as $$
  select
    tp.id,
    tp.trip_id,
    tp.user_id,
    tp.role,
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
