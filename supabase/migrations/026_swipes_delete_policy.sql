-- Migration 026: let users delete their own swipes.
--
-- Why: the UI offers a "reset my votes" action on the swipe page so a user
-- can clear all of their swipes on a trip and start over. RLS previously
-- permitted insert + update but not delete; add the missing delete policy.

create policy "Users can delete their own swipes"
  on swipes for delete
  using (auth.uid() = user_id);
