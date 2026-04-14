-- Tighten RLS on trip_family_invites. The original policy (migration 019) let
-- any trip participant read every family's code on the trip, which meant a
-- participant from one family could read another family's code and post
-- timeline events as that other family via the by-code agent endpoints.
-- Since the invite code IS the posting credential, this was a cross-family
-- impersonation path — the exact threat model the per-family design was
-- meant to close.
--
-- New policy: a user can only see (trip, family) codes where they both
-- participate in the trip AND belong to the family.

drop policy if exists "Participants see their trip's family codes" on trip_family_invites;

create policy "Members see their own family's code per trip"
  on trip_family_invites for select to authenticated using (
    exists (
      select 1 from trip_participants tp
      where tp.trip_id = trip_family_invites.trip_id
        and tp.user_id = auth.uid()
    )
    and exists (
      select 1 from family_members fm
      where fm.family_id = trip_family_invites.family_id
        and fm.user_id = auth.uid()
    )
  );
