import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function main() {
  const tripId = 'd6e66a7c-11c4-43be-b7fc-ccd517ada338' // Oyster
  console.log('=== Oyster invites ===')
  const { data: invites } = await sb.from('trip_family_invites').select('invite_code, families(name)').eq('trip_id', tripId)
  for (const r of invites ?? []) {
    const fam = Array.isArray(r.families) ? r.families[0] : r.families
    console.log(`  ${r.invite_code}  ${(fam as { name?: string })?.name}`)
  }
  console.log('\n=== Oyster events ===')
  const { data: events } = await sb.from('timeline_events').select('title, added_by, family_id').eq('trip_id', tripId)
  const { data: families } = await sb.from('families').select('id, name')
  const fmap: Record<string,string> = {}
  for (const f of families ?? []) fmap[f.id] = f.name
  for (const e of events ?? []) {
    console.log(`  [${e.family_id ? fmap[e.family_id] : 'NULL'}] ${e.title}`)
  }
  console.log('\n=== All families ===')
  for (const f of families ?? []) console.log(`  ${f.name}`)
}
main().catch(e=>{console.error(e);process.exit(1)})
