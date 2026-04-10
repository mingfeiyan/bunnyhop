-- Allow trip_context row creator OR trip organizer to delete entries
-- This enables cleanup of legacy flight/hotel rows and corrections of constraints/notes
create policy "Creator or organizer can delete trip_context"
  on trip_context for delete
  using (
    auth.uid() = added_by
    or exists (
      select 1 from trip_participants
      where trip_id = trip_context.trip_id
        and user_id = auth.uid()
        and role = 'organizer'
    )
  );
