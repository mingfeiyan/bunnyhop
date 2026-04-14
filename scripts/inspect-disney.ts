import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
    const i = l.indexOf('=')
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
  })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function main() {
  const tripId = 'c903e588-d486-4196-840c-42de63f29eff' // Disney Cruise
  const { data: events } = await supabase
    .from('timeline_events')
    .select('id, title, added_by, family_id')
    .eq('trip_id', tripId)
    .order('created_at')
  const { data: families } = await supabase.from('families').select('id, name')
  const famName: Record<string, string> = {}
  for (const f of families ?? []) famName[f.id] = f.name
  for (const ev of events ?? []) {
    const fam = ev.family_id ? famName[ev.family_id] : '(NULL)'
    console.log(`  ${fam.padEnd(20)} | added_by=${ev.added_by.slice(0, 8)} | ${ev.title}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
