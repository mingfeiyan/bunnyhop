// One-shot backfill endpoint: populates Google Places data on cards that are
// missing a google_place_id or an image_url. Idempotent — running it twice is
// safe; the second run finds nothing to do.
//
// Use:
//   curl -X POST https://<host>/api/trips/by-code/<invite_code>/backfill-places

import { createServiceClient } from '@/lib/supabase/server'
import { searchPlace, fetchPlacePhoto } from '@/lib/google-places'
import { NextResponse } from 'next/server'

type CardRow = {
  id: string
  title: string
  image_url: string | null
  metadata: Record<string, unknown> | null
}

type Result = {
  id: string
  title: string
  status: 'ok' | 'no_places_data' | 'error'
  rating?: number | null
  rating_count?: number | null
  error?: string
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ inviteCode: string }> }
) {
  const { inviteCode } = await params
  const supabase = createServiceClient()

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id, destination')
    .eq('invite_code', inviteCode)
    .single()
  if (tripError || !trip) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
  }

  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('id, title, image_url, metadata')
    .eq('trip_id', trip.id)
  if (cardsError) {
    return NextResponse.json({ error: cardsError.message }, { status: 500 })
  }

  const needsBackfill = ((cards ?? []) as CardRow[]).filter(c => {
    const m = c.metadata ?? {}
    return !m.google_place_id || !c.image_url
  })

  const destination = String(trip.destination ?? '')

  const results: Result[] = await Promise.all(
    needsBackfill.map(async (card): Promise<Result> => {
      const m = card.metadata ?? {}
      const existingPlaceId = typeof m.google_place_id === 'string' ? m.google_place_id : null

      try {
        // Photo-only path: card already has a place_id, just missing the photo.
        // Cheaper than re-running findplacefromtext, and avoids the risk of the
        // fuzzy text match resolving to a different place and overwriting the
        // cached rating/rating_count.
        if (existingPlaceId && !card.image_url) {
          const photoUrl = await fetchPlacePhoto(existingPlaceId)
          if (!photoUrl) {
            return { id: card.id, title: card.title, status: 'no_places_data' }
          }
          const { error: updateError } = await supabase
            .from('cards')
            .update({ image_url: photoUrl })
            .eq('id', card.id)
          if (updateError) {
            return { id: card.id, title: card.title, status: 'error', error: updateError.message }
          }
          return { id: card.id, title: card.title, status: 'ok' }
        }

        // Full lookup: no place_id yet — fuzzy search on title + destination
        // and patch metadata + image_url with whatever Places returns.
        const query = `${card.title} ${destination}`.trim()
        const place = await searchPlace(query)
        if (place.place_id === null && place.rating === null && place.rating_count === null) {
          return { id: card.id, title: card.title, status: 'no_places_data' }
        }
        const patch: Record<string, unknown> = { ...m }
        if (place.place_id !== null) patch.google_place_id = place.place_id
        if (place.rating !== null) patch.rating = place.rating
        if (place.rating_count !== null) patch.rating_count = place.rating_count

        const update: { metadata: Record<string, unknown>; image_url?: string } = { metadata: patch }
        if (place.photo_url && !card.image_url) {
          update.image_url = place.photo_url
        }

        const { error: updateError } = await supabase
          .from('cards')
          .update(update)
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
