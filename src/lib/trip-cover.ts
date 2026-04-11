// Trip cover image lifecycle. Extracted from
// /api/trips/[tripId]/generate-cover/route.ts so it can be called both:
//   - from that route handler (the POST endpoint, used for backfill curl)
//   - from src/lib/trip-autofill.ts in-process (no loopback HTTP hop)
//
// Idempotent: short-circuits if the trip already has a cover_image_url.
// Skips silently if the trip has no destination yet (the autofill helper
// will call this again the moment destination gets populated).

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateCoverImage } from '@/lib/gemini'

export type GenerateAndStoreCoverResult =
  | { ok: true; cover_image_url: string; cached: boolean }
  | { ok: false; status: number; error: string }
  | { ok: true; cover_image_url: null; skipped: string }

export async function generateAndStoreCover(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  tripId: string
): Promise<GenerateAndStoreCoverResult> {
  // Look up the trip
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id, destination, cover_image_url')
    .eq('id', tripId)
    .single()
  if (tripError || !trip) {
    return { ok: false, status: 404, error: 'Trip not found' }
  }

  // Idempotent: if a cover already exists, return it without re-generating.
  if (trip.cover_image_url) {
    return { ok: true, cover_image_url: trip.cover_image_url as string, cached: true }
  }

  // Trips with no destination yet (created via the optional-fields flow)
  // can't be turned into a Gemini prompt. Skip silently — the autofill
  // helper re-fires this the moment a hotel/flight populates destination.
  if (!trip.destination) {
    return { ok: true, cover_image_url: null, skipped: 'no destination yet' }
  }

  // Generate via Gemini
  let image
  try {
    image = await generateCoverImage(trip.destination as string)
  } catch (err) {
    console.error('[trip-cover] Gemini failed:', err)
    return {
      ok: false,
      status: 500,
      error: `Image generation failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
  if (!image) {
    return {
      ok: false,
      status: 500,
      error: 'No image returned by Gemini (content filter?)',
    }
  }

  // Upload to Supabase Storage. The bucket is public-read so the URL works
  // as an <img src>. Upsert so a regeneration (after manually clearing
  // cover_image_url) replaces the old file.
  const path = `${tripId}.png`
  const { error: uploadError } = await supabase.storage
    .from('trip-covers')
    .upload(path, image.data, {
      contentType: image.mimeType,
      upsert: true,
    })
  if (uploadError) {
    return { ok: false, status: 500, error: `Storage upload failed: ${uploadError.message}` }
  }

  const { data: publicUrlData } = supabase.storage.from('trip-covers').getPublicUrl(path)
  const coverUrl = publicUrlData.publicUrl

  const { error: updateError } = await supabase
    .from('trips')
    .update({ cover_image_url: coverUrl })
    .eq('id', tripId)
  if (updateError) {
    return { ok: false, status: 500, error: `DB update failed: ${updateError.message}` }
  }

  return { ok: true, cover_image_url: coverUrl, cached: false }
}
