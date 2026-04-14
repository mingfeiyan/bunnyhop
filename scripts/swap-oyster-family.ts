import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function main() {
  const tripId = 'd6e66a7c-11c4-43be-b7fc-ccd517ada338'
  const { data: families } = await sb.from('families').select('id, name')
  const ryanId = (families ?? []).find(f => f.name === "Ryan's Family")?.id
  const kennyId = (families ?? []).find(f => f.name === 'Kenny Family')?.id
  if (!ryanId || !kennyId) throw new Error('missing family ids')

  // Check Ryan-family participants on the trip
  const { data: ryanMembers } = await sb.from('family_members').select('user_id').eq('family_id', ryanId)
  const ryanUserIds = (ryanMembers ?? []).map(r => r.user_id).filter(Boolean) as string[]
  const { data: ryanParticipants } = await sb
    .from('trip_participants')
    .select('user_id')
    .eq('trip_id', tripId)
    .in('user_id', ryanUserIds)
  console.log(`Ryan-family participants on Oyster: ${ryanParticipants?.length ?? 0}`)
  if (ryanParticipants && ryanParticipants.length > 0) {
    console.log('  user_ids:', ryanParticipants.map(p => p.user_id))
  }

  // Swap: drop Ryan's invite, add Kenny's.
  const { error: delErr } = await sb
    .from('trip_family_invites')
    .delete()
    .eq('trip_id', tripId)
    .eq('family_id', ryanId)
  if (delErr) throw delErr
  console.log('Deleted Ryan invite for Oyster')

  const { data: inserted, error: insErr } = await sb
    .from('trip_family_invites')
    .insert({ trip_id: tripId, family_id: kennyId })
    .select('invite_code')
    .single()
  if (insErr) throw insErr
  console.log(`Created Kenny invite for Oyster: ${inserted?.invite_code}`)
}
main().catch(e=>{console.error(e);process.exit(1)})
