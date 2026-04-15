// One-shot Gemini fallback image backfill. Mirrors
// /api/trips/[tripId]/backfill-images but runs locally against the DB via
// service role — useful before the endpoint is deployed.
//
// Usage:
//   npx tsx scripts/backfill-card-images.ts <trip_id_or_invite_code>

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { generateAndStoreCardImage, type CardImageCard } from '../src/lib/card-image'

dotenv.config({ path: '.env.local' })

const CONCURRENCY = 3

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  async function next(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await worker(items[i], i)
    }
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, () => next())
  await Promise.all(runners)
  return results
}

async function main() {
  const arg = process.argv[2]
  if (!arg) {
    console.error('Usage: npx tsx scripts/backfill-card-images.ts <trip_id_or_invite_code>')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

  // Resolve the arg as either a UUID (trip id) or invite code.
  let tripId: string
  let destination: string | null
  const uuidLike = /^[0-9a-f-]{36}$/i.test(arg)
  if (uuidLike) {
    const { data: trip } = await supabase.from('trips').select('id, destination').eq('id', arg).maybeSingle()
    if (!trip) throw new Error(`Trip ${arg} not found`)
    tripId = trip.id
    destination = trip.destination
  } else {
    // Try per-family invite first, then legacy trips.invite_code.
    const { data: tfi } = await supabase
      .from('trip_family_invites')
      .select('trip_id')
      .eq('invite_code', arg)
      .maybeSingle()
    let resolved: { id: string; destination: string | null } | null = null
    if (tfi) {
      const { data: trip } = await supabase.from('trips').select('id, destination').eq('id', tfi.trip_id).maybeSingle()
      resolved = trip
    } else {
      const { data: trip } = await supabase.from('trips').select('id, destination').eq('invite_code', arg).maybeSingle()
      resolved = trip
    }
    if (!resolved) throw new Error(`Invite code ${arg} not found`)
    tripId = resolved.id
    destination = resolved.destination
  }

  if (!destination) throw new Error('Trip has no destination — cannot build image prompt')

  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, title, description, category, image_url')
    .eq('trip_id', tripId)
    .is('image_url', null)
  if (error) throw error

  const pending = (cards ?? []) as CardImageCard[]
  console.log(`Trip: ${tripId}`)
  console.log(`Destination: ${destination}`)
  console.log(`Cards needing images: ${pending.length}`)
  console.log(`Concurrency: ${CONCURRENCY}\n`)

  if (pending.length === 0) {
    console.log('Nothing to do.')
    return
  }

  const results = await runWithConcurrency(pending, CONCURRENCY, async (card, i) => {
    process.stdout.write(`  [${i + 1}/${pending.length}] ${card.title}... `)
    const res = await generateAndStoreCardImage(supabase, card, destination as string)
    if (res.ok) {
      console.log(res.cached ? 'cached' : 'ok')
    } else {
      console.log(`ERROR: ${res.error}`)
    }
    return res
  })

  const ok = results.filter(r => r.ok).length
  const err = results.filter(r => !r.ok).length
  console.log(`\nDone. ${ok} ok, ${err} error.`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
