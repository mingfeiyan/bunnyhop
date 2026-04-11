// One-shot backfill: for every card with a photo_search_query but no google_place_id,
// re-fetch Google Places data and update the row's metadata.
//
// Run: npx tsx scripts/backfill-card-places.ts
//
// Requires .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// and GOOGLE_PLACES_API_KEY.

import { createClient } from '@supabase/supabase-js'
import { searchPlace } from '../src/lib/google-places'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }

  const supabase = createClient(url, serviceKey)

  // Find cards that need backfill: have a photo_search_query, missing google_place_id
  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, title, metadata')
  if (error) throw error

  const needsBackfill = (cards ?? []).filter(c => {
    const m = (c.metadata ?? {}) as Record<string, unknown>
    return m.photo_search_query && !m.google_place_id
  })

  console.log(`Found ${needsBackfill.length} cards to backfill (out of ${cards?.length ?? 0} total)`)

  let updated = 0
  for (const card of needsBackfill) {
    const m = (card.metadata ?? {}) as Record<string, unknown>
    const query = m.photo_search_query as string
    process.stdout.write(`  ${card.title}... `)
    try {
      const place = await searchPlace(query)
      const patch: Record<string, unknown> = { ...m }
      if (place.place_id !== null) patch.google_place_id = place.place_id
      if (place.rating !== null) patch.rating = place.rating
      if (place.rating_count !== null) patch.rating_count = place.rating_count

      if (place.place_id === null && place.rating === null && place.rating_count === null) {
        console.log('no Places data')
        continue
      }

      const { error: updateError } = await supabase
        .from('cards')
        .update({ metadata: patch })
        .eq('id', card.id)
      if (updateError) {
        console.log(`error: ${updateError.message}`)
        continue
      }
      updated++
      console.log(`ok (rating=${place.rating ?? 'n/a'}, count=${place.rating_count ?? 'n/a'})`)
    } catch (err) {
      console.log(`error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  console.log(`\nDone. Updated ${updated}/${needsBackfill.length} cards.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
