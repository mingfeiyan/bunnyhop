// One-shot card generation endpoint scoped by invite code (agent-friendly).
// Mirrors /api/trips/[tripId]/generate but uses the service role key + invite
// code instead of a user session, so it can be triggered by curl/agents.
//
// Note: this endpoint intentionally does NOT do the post-generation Google
// Places fetch — that's a separate /backfill-places call. The reason is that
// generation alone (Claude call) takes 30-60s, and adding 25 parallel Places
// fetches pushes the total over Vercel's serverless function timeout. Calling
// /backfill-places afterward populates photos/ratings.

import { createServiceClient } from '@/lib/supabase/server'
import { generateCards } from '@/lib/card-generator'
import { NextResponse } from 'next/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ inviteCode: string }> }
) {
  const { inviteCode } = await params
  const supabase = createServiceClient()

  // The invite code IS the auth — anyone with the code can trigger generation.
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*')
    .eq('invite_code', inviteCode)
    .single()
  if (tripError || !trip) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
  }

  // Card generation needs a destination to seed Claude. Trips created via the
  // optional-fields flow may not have one until they add a hotel/flight.
  if (!trip.destination) {
    return NextResponse.json(
      { error: 'Set the trip destination first (or add a hotel/flight to auto-fill it).', count: 0 },
      { status: 400 }
    )
  }

  // The three follow-up reads are independent of each other — fan them out.
  const [contextsRes, timelineRes, existingCardsRes] = await Promise.all([
    supabase.from('trip_context').select('*').eq('trip_id', trip.id),
    supabase
      .from('timeline_events')
      .select('*')
      .eq('trip_id', trip.id)
      .order('start_date', { ascending: true }),
    supabase.from('cards').select('title').eq('trip_id', trip.id),
  ])
  const existingTitles = existingCardsRes.data?.map(c => c.title) ?? []

  let generated
  try {
    generated = await generateCards({
      destination: trip.destination,
      dateStart: trip.date_start,
      dateEnd: trip.date_end,
      contexts: contextsRes.data ?? [],
      timelineEvents: timelineRes.data ?? [],
      existingTitles,
    })
  } catch (err) {
    console.error('[by-code generate] Card generation failed:', err)
    return NextResponse.json(
      { error: `Card generation failed: ${String(err)}`, cards: [], count: 0 },
      { status: 500 }
    )
  }

  if (!generated || generated.length === 0) {
    return NextResponse.json({ cards: [], count: 0 })
  }

  const cardsToInsert = generated.map(card => ({
    trip_id: trip.id,
    title: card.title,
    tagline: card.tagline,
    description: card.description,
    category: card.category,
    source: 'ai_generated' as const,
    metadata: card.metadata,
    added_by: trip.created_by,
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('cards')
    .insert(cardsToInsert)
    .select()

  if (insertError) {
    console.error('[by-code generate] Card insert failed:', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    cards: inserted ?? [],
    count: inserted?.length ?? 0,
    note: 'Cards generated. Photos and ratings are populated by /backfill-places (call separately).',
  })
}
