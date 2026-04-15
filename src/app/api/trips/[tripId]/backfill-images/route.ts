// Post-generation Gemini fallback: for cards that still have no image_url
// after Places enrichment (abstract activities, fuzzy misses, or an invalid
// Places key), generates a placeholder image via Gemini and uploads it to
// the public 'card-images' Supabase Storage bucket. Idempotent — running
// twice is safe (the second run finds nothing to do).
//
// Authenticated variant: requires a session + trip participant.

import { createClient } from '@/lib/supabase/server'
import { generateAndStoreCardImage, type CardImageCard } from '@/lib/card-image'
import { checkApiSecurity } from '@/lib/api-security'
import { byCodeLimiter } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'

// Gemini image generation is slow (roughly 5–15s/card). Cap total at 5 min
// so a batch of ~25 cards fits comfortably.
export const maxDuration = 300

// Soft concurrency cap to avoid hammering the Gemini endpoint. 5 parallel
// in-flight is enough to amortize latency without tripping rate limits.
const CONCURRENCY = 5

type Result = {
  id: string
  title: string
  status: 'ok' | 'error'
  error?: string
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<Result>
): Promise<Result[]> {
  const results: Result[] = []
  let cursor = 0
  async function next(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await worker(items[i])
    }
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, () => next())
  await Promise.all(runners)
  return results
}

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

  const { data: participant } = await supabase
    .from('trip_participants')
    .select('id')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .single()
  if (!participant) {
    return NextResponse.json({ error: 'Not a trip participant' }, { status: 403 })
  }

  const { data: trip } = await supabase
    .from('trips')
    .select('id, destination')
    .eq('id', tripId)
    .single()
  if (!trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }
  if (!trip.destination) {
    return NextResponse.json({ error: 'Trip has no destination — cannot build image prompt' }, { status: 400 })
  }

  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('id, title, description, category, image_url')
    .eq('trip_id', tripId)
    .is('image_url', null)
  if (cardsError) {
    return NextResponse.json({ error: cardsError.message }, { status: 500 })
  }

  const pending = (cards ?? []) as CardImageCard[]
  const results = await runWithConcurrency(pending, CONCURRENCY, async (card): Promise<Result> => {
    const res = await generateAndStoreCardImage(supabase, card, trip.destination as string)
    if (res.ok) return { id: card.id, title: card.title, status: 'ok' }
    return { id: card.id, title: card.title, status: 'error', error: res.error }
  })

  return NextResponse.json({
    total: pending.length,
    updated: results.filter(r => r.status === 'ok').length,
    errors: results.filter(r => r.status === 'error').length,
    results,
  })
}
