-- Let trip organizers both see and create per-family invite codes on their
-- own trip. Non-organizer participants still only see their own family's
-- code (migration 021). Writes are restricted to organizers so a regular
-- participant can't mint codes for other families.
--
-- The SELECT policy replaces 021's "Members see their own family's code
-- per trip" to keep a single readable rule.

drop policy if exists "Members see their own family's code per trip" on trip_family_invites;
drop policy if exists "Organizer or family member sees invite" on trip_family_invites;
drop policy if exists "Organizer creates family invites" on trip_family_invites;

create policy "Organizer or family member sees invite"
  on trip_family_invites for select to authenticated using (
    -- Organizer of the trip sees every family's code on the trip
    exists (
      select 1 from trip_participants tp
      where tp.trip_id = trip_family_invites.trip_id
        and tp.user_id = auth.uid()
        and tp.role = 'organizer'
    )
    or
    -- Regular participant sees only their own family's code
    (
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
    )
  );

create policy "Organizer creates family invites"
  on trip_family_invites for insert to authenticated with check (
    exists (
      select 1 from trip_participants tp
      where tp.trip_id = trip_family_invites.trip_id
        and tp.user_id = auth.uid()
        and tp.role = 'organizer'
    )
  );
