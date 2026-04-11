-- Make destination and date columns optional on trips. Users should be able
-- to create a trip with only a title and have the rest backfilled from
-- bookings (flights, hotels, activities) added later via context or
-- timeline-events endpoints.
--
-- Also adds an UPDATE RLS policy so the trip organizer can edit metadata
-- by hand via the EditTripDetailsModal client component. Today the only
-- update path is the cover-image route, which uses the service role key
-- and bypasses RLS — adding a participant-facing UPDATE policy means we
-- can drop a manual edit affordance into the trip hub without inventing
-- a new API route.

alter table trips alter column destination drop not null;
alter table trips alter column date_start drop not null;
alter table trips alter column date_end drop not null;

create policy "Organizers can update their trips"
  on trips for update
  using (
    id in (
      select trip_id
      from trip_participants
      where user_id = auth.uid() and role = 'organizer'
    )
  )
  with check (
    id in (
      select trip_id
      from trip_participants
      where user_id = auth.uid() and role = 'organizer'
    )
  );
