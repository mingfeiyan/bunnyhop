import { createClient } from '@/lib/supabase/server'
import { generateCards } from '@/lib/card-generator'
import { searchPlace } from '@/lib/google-places'
import { checkApiSecurity } from '@/lib/api-security'
import { byCodeLimiter } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const securityError = await checkApiSecurity(request, { rateLimiter: byCodeLimiter })
  if (securityError) return securityError

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

  // Card generation needs a destination to seed Claude. Trips created via the
  // optional-fields flow may not have one until they add a hotel/flight.
  if (!trip.destination) {
    return NextResponse.json(
      { error: 'Set the trip destination first (or add a hotel/flight to auto-fill it).', count: 0 },
      { status: 400 }
    )
  }

  // The three follow-up reads are independent of each other — fan them out.
  // contexts = constraints/notes; timelineEvents = confirmed flights, hotels,
  // activities (so the generator can suggest things near the hotels and around
  // the schedule); existingCards = titles to avoid duplicates.
  const [contextsRes, timelineRes, existingCardsRes] = await Promise.all([
    supabase.from('trip_context').select('*').eq('trip_id', tripId),
    supabase
      .from('timeline_events')
      .select('*')
      .eq('trip_id', tripId)
      .order('start_date', { ascending: true }),
    supabase.from('cards').select('title').eq('trip_id', tripId),
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
    console.error('Card generation failed:', err)
    return NextResponse.json(
      { error: `Card generation failed: ${err}`, cards: [], count: 0 },
      { status: 500 }
    )
  }

  console.log(`Generated ${generated.length} cards for trip ${tripId}`)

  if (!generated || generated.length === 0) {
    return NextResponse.json({ cards: [], count: 0 })
  }

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
    console.error('Card insert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  console.log(`Inserted ${inserted?.length} cards`)

  // Fetch photo + rating + place_id for inserted cards in a single Places call each
  if (inserted && inserted.length > 0) {
    const placeUpdates = inserted.map(async (card) => {
      const query = card.metadata?.photo_search_query
      if (!query) return
      const place = await searchPlace(query as string)

      // Build the metadata patch with whatever we got back
      const metadataPatch: Record<string, unknown> = { ...card.metadata }
      if (place.place_id !== null) metadataPatch.google_place_id = place.place_id
      if (place.rating !== null) metadataPatch.rating = place.rating
      if (place.rating_count !== null) metadataPatch.rating_count = place.rating_count

      const update: Record<string, unknown> = { metadata: metadataPatch }
      if (place.photo_url) update.image_url = place.photo_url

      await supabase
        .from('cards')
        .update(update)
        .eq('id', card.id)
    })
    await Promise.allSettled(placeUpdates)
  }

  return NextResponse.json({ cards: inserted, count: inserted?.length })
}
