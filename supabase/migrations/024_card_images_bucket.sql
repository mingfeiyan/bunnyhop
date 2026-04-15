-- Card images: per-card photograph rendered on the swipe card.
-- Google Places photos remain the primary source (written directly as
-- /api/photos?ref=<ref> proxy URLs). When Places has no match — abstract
-- activities like a beach bonfire, or queries that just don't resolve —
-- we fall back to Gemini-generated images stored in this bucket.
--
-- Bucket is public-read so the generated PNGs can render via <img src>.
-- Writes go through the service role via /backfill-images.

insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', true)
on conflict (id) do nothing;
