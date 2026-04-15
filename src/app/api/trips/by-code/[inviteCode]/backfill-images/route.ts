// By-code (agent-friendly) Gemini image fallback. Service-role variant of
// /api/trips/[tripId]/backfill-images — same behavior, resolved via invite
// code so curl/agents can trigger it without a session.

import { createServiceClient } from '@/lib/supabase/server'
import { generateAndStoreCardImage, type CardImageCard } from '@/lib/card-image'
import { checkApiSecurity } from '@/lib/api-security'
import { byCodeLimiter } from '@/lib/rate-limit'
import { resolveInviteCode } from '@/lib/trip-invite'
import { NextResponse } from 'next/server'

export const maxDuration = 300

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
  { params }: { params: Promise<{ inviteCode: string }> }
) {
  const securityError = await checkApiSecurity(request, { rateLimiter: byCodeLimiter, checkOrigin: false })
  if (securityError) return securityError

  const { inviteCode } = await params
  const supabase = createServiceClient()

  const resolved = await resolveInviteCode<{ destination: string | null }>(
    supabase,
    inviteCode,
    'id, destination'
  )
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
  }
  const trip = resolved.trip
  if (!trip.destination) {
    return NextResponse.json({ error: 'Trip has no destination — cannot build image prompt' }, { status: 400 })
  }

  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('id, title, description, category, image_url')
    .eq('trip_id', trip.id)
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
