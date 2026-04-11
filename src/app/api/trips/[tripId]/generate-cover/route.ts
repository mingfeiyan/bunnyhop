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

import { createServiceClient } from '@/lib/supabase/server'
import { generateAndStoreCover } from '@/lib/trip-cover'
import { NextResponse } from 'next/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params
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
