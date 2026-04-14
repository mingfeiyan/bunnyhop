import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
    const i = l.indexOf('=')
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
  })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const TRIP_NAMES: Record<string, string> = {
  '7790ff8a-364a-4f7d-bedd-5dce116a9f07': 'Summer 2026 (Bora Bora)',
  'cdec7c4a-7d6d-4f67-b1f5-2578daff117e': 'Spring break (Hawaii)',
  'c903e588-d486-4196-840c-42de63f29eff': 'Disney Cruise',
  'ef6717fe-0c27-43f0-b2ac-f2ad27b57ad2': "Coeur d'Alene",
  'a313928d-76be-43ba-84dd-eb240e4a4c60': 'Tokyo Summer 2026',
  'a517764a-424a-4050-ad74-b7a03d3d26e1': 'Club Med Tomamu',
  'd6e66a7c-11c4-43be-b7fc-ccd517ada338': "Oyster Mother's Day",
}

async function main() {
  // 1. Check trip_family_invites: how many per trip, and what code each family has
  console.log('=== trip_family_invites ===')
  const { data: invites, error: invErr } = await supabase
    .from('trip_family_invites')
    .select('trip_id, family_id, invite_code, families(name)')
    .order('trip_id')
  if (invErr) {
    console.error('ERROR:', invErr)
    return
  }

  const { data: trips } = await supabase.from('trips').select('id, invite_code')
  const tripLegacyCode: Record<string, string> = {}
  for (const t of trips ?? []) tripLegacyCode[t.id] = t.invite_code

  const byTrip: Record<string, Array<{ family: string; code: string; isLegacy: boolean }>> = {}
  for (const row of invites ?? []) {
    const fam = Array.isArray(row.families) ? row.families[0] : row.families
    const name = (fam as { name?: string })?.name ?? '?'
    const tripKey = TRIP_NAMES[row.trip_id] ?? row.trip_id
    byTrip[tripKey] = byTrip[tripKey] ?? []
    byTrip[tripKey].push({
      family: name,
      code: row.invite_code,
      isLegacy: row.invite_code === tripLegacyCode[row.trip_id],
    })
  }
  for (const [trip, rows] of Object.entries(byTrip)) {
    console.log(`\n${trip}`)
    for (const r of rows) {
      console.log(`  ${r.code}  ${r.family}${r.isLegacy ? '  (= old trips.invite_code, unchanged for Ryan)' : '  (new)'}`)
    }
  }

  // 2. Check timeline_events family_id coverage
  console.log('\n=== timeline_events family_id coverage ===')
  const { data: events } = await supabase
    .from('timeline_events')
    .select('id, trip_id, title, added_by, family_id')

  const nullCount = (events ?? []).filter(e => !e.family_id).length
  console.log(`Total events: ${events?.length ?? 0}, null family_id: ${nullCount}`)

  // Group events by (trip, family)
  const { data: families } = await supabase.from('families').select('id, name')
  const famName: Record<string, string> = {}
  for (const f of families ?? []) famName[f.id] = f.name

  const grouped: Record<string, Record<string, number>> = {}
  for (const ev of events ?? []) {
    const tripKey = TRIP_NAMES[ev.trip_id] ?? ev.trip_id
    const famKey = ev.family_id ? famName[ev.family_id] : '(NULL)'
    grouped[tripKey] = grouped[tripKey] ?? {}
    grouped[tripKey][famKey] = (grouped[tripKey][famKey] ?? 0) + 1
  }
  for (const [trip, fams] of Object.entries(grouped)) {
    console.log(`\n${trip}`)
    for (const [fam, n] of Object.entries(fams)) {
      console.log(`  ${fam}: ${n} events`)
    }
  }

  // 3. Spot-check the 4 events that should have been reassigned to Ryan
  console.log('\n=== Spot-check: events that should be Ryan (by title rule) ===')
  const { data: ryanEvents } = await supabase
    .from('timeline_events')
    .select('trip_id, title, family_id')
    .or('title.ilike.%(You Family)%,title.ilike.%(Frances%')

  for (const e of ryanEvents ?? []) {
    const trip = TRIP_NAMES[e.trip_id] ?? e.trip_id
    const fam = e.family_id ? famName[e.family_id] : '(NULL)'
    const ok = fam === "Ryan's Family" ? '✓' : '✗'
    console.log(`  ${ok} [${trip}] ${e.title} -> ${fam}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
