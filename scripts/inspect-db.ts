import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => l.split('=').map(s => s.trim()))
)

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function main() {
  console.log('=== FAMILIES ===')
  const { data: families } = await supabase.from('families').select('*')
  console.log(JSON.stringify(families, null, 2))

  console.log('\n=== FAMILY_MEMBERS (with family + user) ===')
  const { data: fm } = await supabase
    .from('family_members')
    .select('user_id, family_id, families(name)')
  console.log(JSON.stringify(fm, null, 2))

  console.log('\n=== AUTH USERS (email map) ===')
  const { data: users } = await supabase.auth.admin.listUsers()
  const userMap = users.users.map(u => ({ id: u.id, email: u.email }))
  console.log(JSON.stringify(userMap, null, 2))

  console.log('\n=== TRIPS ===')
  const { data: trips } = await supabase
    .from('trips')
    .select('id, title, destination, invite_code, created_by')
  console.log(JSON.stringify(trips, null, 2))

  console.log('\n=== TIMELINE_EVENTS (grouped by trip + added_by) ===')
  const { data: events } = await supabase
    .from('timeline_events')
    .select('id, trip_id, title, type, added_by, source, created_at')
    .order('created_at', { ascending: true })

  const grouped: Record<string, Record<string, number>> = {}
  for (const ev of events ?? []) {
    const tKey = ev.trip_id
    const uKey = ev.added_by ?? 'null'
    grouped[tKey] = grouped[tKey] ?? {}
    grouped[tKey][uKey] = (grouped[tKey][uKey] ?? 0) + 1
  }
  console.log(JSON.stringify(grouped, null, 2))
  console.log(`Total events: ${events?.length ?? 0}`)

  console.log('\n=== TIMELINE_EVENTS columns (first row) ===')
  if (events?.[0]) {
    const { data: first } = await supabase
      .from('timeline_events')
      .select('*')
      .eq('id', events[0].id)
      .single()
    console.log('Columns:', Object.keys(first ?? {}))
  }
}

main().catch(e => { console.error(e); process.exit(1) })
