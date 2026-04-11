// One-shot card generation endpoint scoped by invite code (agent-friendly).
// Mirrors /api/trips/[tripId]/generate but uses the service role key + invite
// code instead of a user session, so it can be triggered by curl/agents.
//
// Note: this endpoint intentionally does NOT do the post-generation Google
// Places fetch — that's a separate /backfill-places call. The reason is that
// generation alone (Claude call) takes 30-60s, and adding 25 parallel Places
// fetches pushes the total over Vercel's serverless function timeout. Calling
// /backfill-places afterward populates photos/ratings.

import { createServerClient } from '@supabase/ssr'
import { generateCards } from '@/lib/card-generator'
import { NextResponse } from 'next/server'

function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  )
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ inviteCode: string }> }
) {
  const { inviteCode } = await params
  const supabase = createServiceClient()

  // Find trip by invite code — the invite code IS the auth
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*')
    .eq('invite_code', inviteCode)
    .single()
  if (tripError || !trip) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
  }

  // Get trip context (constraints, notes)
  const { data: contexts } = await supabase
    .from('trip_context')
    .select('*')
    .eq('trip_id', trip.id)

  // Get confirmed timeline events (flights, hotels, activities)
  const { data: timelineEvents } = await supabase
    .from('timeline_events')
    .select('*')
    .eq('trip_id', trip.id)
    .order('start_date', { ascending: true })

  // Get existing card titles to avoid duplicates
  const { data: existingCards } = await supabase
    .from('cards')
    .select('title')
    .eq('trip_id', trip.id)
  const existingTitles = existingCards?.map(c => c.title) ?? []

  let generated
  try {
    generated = await generateCards({
      destination: trip.destination,
      dateStart: trip.date_start,
      dateEnd: trip.date_end,
      contexts: contexts ?? [],
      timelineEvents: timelineEvents ?? [],
      existingTitles,
    })
  } catch (err) {
    console.error('[by-code generate] Card generation failed:', err)
    return NextResponse.json({ error: `Card generation failed: ${String(err)}` }, { status: 500 })
  }

  if (!generated || generated.length === 0) {
    return NextResponse.json({ cards: [], count: 0, note: 'no cards generated' })
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
    return NextResponse.json({ error: `Card insert failed: ${insertError.message}` }, { status: 500 })
  }

  return NextResponse.json({
    count: inserted?.length ?? 0,
    note: 'Cards generated. Photos and ratings are populated by /backfill-places (call separately).',
  })
}
