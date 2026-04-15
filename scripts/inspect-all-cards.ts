import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function main() {
  const { data: trips, error } = await sb.from('trips').select('id, title, destination, created_at').order('created_at', { ascending: false })
  if (error) { console.error(error); return }
  for (const t of trips ?? []) {
    const { data: cards } = await sb.from('cards').select('image_url').eq('trip_id', t.id)
    const total = cards?.length ?? 0
    const withImg = cards?.filter(c => !!c.image_url).length ?? 0
    console.log(`${t.created_at?.slice(0,10)}  ${withImg}/${total}  ${t.title} (${t.destination ?? 'no dest'})`)
  }
}
main().catch(e=>{console.error(e);process.exit(1)})
