import { createClient } from '@/lib/supabase/server'
import { generateCards } from '@/lib/card-generator'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify participant
  const { data: participant } = await supabase
    .from('trip_participants')
    .select('id')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .single()

  if (!participant) {
    return NextResponse.json({ error: 'Not a trip participant' }, { status: 403 })
  }

  // Get trip
  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single()

  if (!trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  // Get existing context
  const { data: contexts } = await supabase
    .from('trip_context')
    .select('*')
    .eq('trip_id', tripId)

  // Get existing card titles to avoid duplicates
  const { data: existingCards } = await supabase
    .from('cards')
    .select('title')
    .eq('trip_id', tripId)

  const existingTitles = existingCards?.map(c => c.title) ?? []

  // Generate cards
  const generated = await generateCards(
    trip.destination,
    trip.date_start,
    trip.date_end,
    contexts ?? [],
    existingTitles
  )

  // Insert cards
  const cardsToInsert = generated.map(card => ({
    trip_id: tripId,
    title: card.title,
    tagline: card.tagline,
    description: card.description,
    category: card.category,
    source: 'ai_generated' as const,
    metadata: card.metadata,
    added_by: user.id,
  }))

  const { data: inserted, error } = await supabase
    .from('cards')
    .insert(cardsToInsert)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ cards: inserted, count: inserted?.length })
}
