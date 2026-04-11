// One-shot backfill endpoint: re-fetches Google Places data for every card in
// a trip that has a photo_search_query but is missing google_place_id, then
// patches rating, rating_count, and google_place_id into the card's metadata.
// Idempotent — running it twice is safe; the second run finds nothing to do.
//
// Use:
//   curl -X POST https://<host>/api/trips/by-code/<invite_code>/backfill-places

import { createServerClient } from '@supabase/ssr'
import { searchPlace } from '@/lib/google-places'
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

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id')
    .eq('invite_code', inviteCode)
    .single()
  if (tripError || !trip) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
  }

  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('id, title, metadata')
    .eq('trip_id', trip.id)
  if (cardsError) {
    return NextResponse.json({ error: cardsError.message }, { status: 500 })
  }

  type CardRow = { id: string; title: string; metadata: Record<string, unknown> | null }
  const needsBackfill = ((cards ?? []) as CardRow[]).filter(c => {
    const m = (c.metadata ?? {}) as Record<string, unknown>
    return Boolean(m.photo_search_query) && !m.google_place_id
  })

  type Result = {
    id: string
    title: string
    status: 'ok' | 'no_places_data' | 'error'
    rating?: number | null
    rating_count?: number | null
    error?: string
  }

  const results: Result[] = await Promise.all(
    needsBackfill.map(async (card): Promise<Result> => {
      const m = (card.metadata ?? {}) as Record<string, unknown>
      const query = m.photo_search_query as string
      try {
        const place = await searchPlace(query)
        if (place.place_id === null && place.rating === null && place.rating_count === null) {
          return { id: card.id, title: card.title, status: 'no_places_data' }
        }
        const patch: Record<string, unknown> = { ...m }
        if (place.place_id !== null) patch.google_place_id = place.place_id
        if (place.rating !== null) patch.rating = place.rating
        if (place.rating_count !== null) patch.rating_count = place.rating_count

        const { error: updateError } = await supabase
          .from('cards')
          .update({ metadata: patch })
          .eq('id', card.id)
        if (updateError) {
          return { id: card.id, title: card.title, status: 'error', error: updateError.message }
        }
        return {
          id: card.id,
          title: card.title,
          status: 'ok',
          rating: place.rating,
          rating_count: place.rating_count,
        }
      } catch (err) {
        return {
          id: card.id,
          title: card.title,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        }
      }
    })
  )

  return NextResponse.json({
    total_cards: cards?.length ?? 0,
    needs_backfill: needsBackfill.length,
    updated: results.filter(r => r.status === 'ok').length,
    no_data: results.filter(r => r.status === 'no_places_data').length,
    errors: results.filter(r => r.status === 'error').length,
    results,
  })
}
