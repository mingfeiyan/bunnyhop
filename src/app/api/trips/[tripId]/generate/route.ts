import { createClient } from '@/lib/supabase/server'
import { generateCards } from '@/lib/card-generator'
import { searchPlacePhoto } from '@/lib/google-places'
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
  let generated
  try {
    generated = await generateCards(
      trip.destination,
      trip.date_start,
      trip.date_end,
      contexts ?? [],
      existingTitles
    )
  } catch (err) {
    console.error('Card generation failed:', err)
    return NextResponse.json({ error: `Card generation failed: ${err}`, count: 0 }, { status: 500 })
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

  // Fetch photos for inserted cards
  if (inserted && inserted.length > 0) {
    const photoUpdates = inserted.map(async (card) => {
      const query = card.metadata?.photo_search_query
      if (!query) return
      const photoUrl = await searchPlacePhoto(query as string)
      if (photoUrl) {
        await supabase
          .from('cards')
          .update({ image_url: photoUrl })
          .eq('id', card.id)
      }
    })
    await Promise.allSettled(photoUpdates)
  }

  return NextResponse.json({ cards: inserted, count: inserted?.length })
}
