// Generates an editorial-style cover image for a trip via Gemini, uploads it
// to Supabase Storage, and stores the public URL on the trip row. The actual
// orchestration lives in src/lib/trip-cover.ts so it can also be called
// in-process from src/lib/trip-autofill.ts (no loopback HTTP hop).
//
// Idempotent: returns the existing cover_image_url if already set.
// Skips silently if the trip has no destination yet.
//
// Called fire-and-forget from /trips/new and from EditTripDetailsModal after
// the user fills in destination. Can also be called directly via curl for
// backfilling existing trips.

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateAndStoreCover } from '@/lib/trip-cover'
import { NextResponse } from 'next/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  // Auth: require a logged-in user who is a participant of this trip.
  // Previously this route had ZERO authentication — anyone with a trip UUID
  // could trigger Gemini generation and overwrite the cover image.
  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { data: participant } = await userSupabase
    .from('trip_participants')
    .select('id')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!participant) {
    return NextResponse.json({ error: 'Not a trip participant' }, { status: 403 })
  }

  const supabase = createServiceClient()

  const result = await generateAndStoreCover(supabase, tripId)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  if (result.cover_image_url === null) {
    return NextResponse.json({
      cover_image_url: null,
      skipped: result.skipped,
    })
  }

  return NextResponse.json({
    cover_image_url: result.cover_image_url,
    cached: result.cached,
  })
}
