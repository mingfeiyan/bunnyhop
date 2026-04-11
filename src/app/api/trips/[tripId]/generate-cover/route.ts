// Generates an editorial-style cover image for a trip via Gemini Imagen,
// uploads it to Supabase Storage, and stores the public URL on the trip row.
//
// Idempotent: if the trip already has a cover_image_url, returns it without
// re-generating. To force regeneration, clear the column first.
//
// Called fire-and-forget from the new-trip flow (src/app/trips/new/page.tsx)
// after the trip insert succeeds. Can also be called directly via curl for
// backfilling existing trips.

import { createServiceClient } from '@/lib/supabase/server'
import { generateCoverImage } from '@/lib/gemini'
import { NextResponse } from 'next/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params
  const supabase = createServiceClient()

  // Look up the trip
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id, destination, cover_image_url')
    .eq('id', tripId)
    .single()
  if (tripError || !trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  // Idempotent: if a cover already exists, return it without re-generating.
  if (trip.cover_image_url) {
    return NextResponse.json({
      cover_image_url: trip.cover_image_url,
      cached: true,
    })
  }

  // Generate via Gemini Imagen
  let image
  try {
    image = await generateCoverImage(trip.destination as string)
  } catch (err) {
    console.error('[generate-cover] Gemini failed:', err)
    return NextResponse.json(
      { error: `Image generation failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
  if (!image) {
    return NextResponse.json({ error: 'No image returned by Gemini (content filter?)' }, { status: 500 })
  }

  // Upload to Supabase Storage. The bucket is public-read, so the public URL
  // works as an <img src>. We always overwrite (upsert) so a regeneration
  // (after manually clearing cover_image_url) replaces the old file.
  const path = `${tripId}.png`
  const { error: uploadError } = await supabase.storage
    .from('trip-covers')
    .upload(path, image.data, {
      contentType: image.mimeType,
      upsert: true,
    })
  if (uploadError) {
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadError.message}` },
      { status: 500 }
    )
  }

  // Get the public URL
  const { data: publicUrlData } = supabase.storage.from('trip-covers').getPublicUrl(path)
  const coverUrl = publicUrlData.publicUrl

  // Update the trip row
  const { error: updateError } = await supabase
    .from('trips')
    .update({ cover_image_url: coverUrl })
    .eq('id', tripId)
  if (updateError) {
    return NextResponse.json(
      { error: `DB update failed: ${updateError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    cover_image_url: coverUrl,
    cached: false,
  })
}
