import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).map(l => l.split('=').map(s => s.trim()))
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const TRIP_NAMES: Record<string, string> = {
  '7790ff8a-364a-4f7d-bedd-5dce116a9f07': 'Summer 2026 (Bora Bora)',
  'cdec7c4a-7d6d-4f67-b1f5-2578daff117e': 'Spring break (Hawaii)',
  'c903e588-d486-4196-840c-42de63f29eff': 'Disney Cruise',
  'ef6717fe-0c27-43f0-b2ac-f2ad27b57ad2': "Coeur d'Alene",
  'a313928d-76be-43ba-84dd-eb240e4a4c60': 'Tokyo Summer 2026',
  'a517764a-424a-4050-ad74-b7a03d3d26e1': 'Club Med Tomamu',
  'd6e66a7c-11c4-43be-b7fc-ccd517ada338': 'Oyster Mother\'s Day',
}
const USER_NAMES: Record<string, string> = {
  '957f72f0-c934-4fc4-87e4-c9aebcdc7116': 'mingfeiy (Yan)',
  '60096791-dea6-46ba-9982-ef05d1067768': 'ningyue (Yan)',
  'd0c0d237-6ae2-41e5-9714-fc8253385732': 'frances (Ryan)',
  'bb1fbc14-aeca-4a7b-b9e2-6c9eaa4e3f18': 'rongchang/Ryan (Ryan)',
  'f42fe704-bc3b-4b50-9ccc-9d45fd092041': 'kiku (Ryan)',
  '285eb37a-13f1-4f19-a41c-ced9f58cbefe': 'qihuan (Huan)',
  'd4f45002-c4dd-47ad-b1ea-56d8d79fce99': 'zshaonan (Huan)',
}

async function main() {
  const { data: events } = await supabase
    .from('timeline_events')
    .select('id, trip_id, title, type, added_by, source, created_at')
    .order('trip_id')
    .order('created_at')

  const byTrip: Record<string, Array<{ id: string; title: string; type: string; addedBy: string; source: string }>> = {}
  for (const ev of events ?? []) {
    const tripKey = TRIP_NAMES[ev.trip_id] ?? ev.trip_id
    byTrip[tripKey] = byTrip[tripKey] ?? []
    byTrip[tripKey].push({
      id: ev.id,
      title: ev.title,
      type: ev.type,
      addedBy: USER_NAMES[ev.added_by] ?? ev.added_by,
      source: ev.source,
    })
  }
  for (const [trip, rows] of Object.entries(byTrip)) {
    console.log(`\n=== ${trip} ===`)
    for (const r of rows) {
      console.log(`  [${r.source}] (${r.addedBy}) ${r.type}: ${r.title}`)
    }
  }
}
main().catch(e => { console.error(e); process.exit(1) })
