import { createClient } from '@/lib/supabase/server'
import { parseContext } from '@/lib/claude'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ inviteCode: string }> }
) {
  const { inviteCode } = await params
  const supabase = await createClient()

  // Find trip by invite code
  const { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('invite_code', inviteCode)
    .single()

  if (!trip) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
  }

  // Auth: user must be logged in and a participant
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: participant } = await supabase
    .from('trip_participants')
    .select('id')
    .eq('trip_id', trip.id)
    .eq('user_id', user.id)
    .single()

  if (!participant) {
    return NextResponse.json({ error: 'Not a trip participant' }, { status: 403 })
  }

  const { text } = await request.json()
  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 })
  }

  const parsed = await parseContext(text)

  const { data, error } = await supabase
    .from('trip_context')
    .insert({
      trip_id: trip.id,
      type: parsed.type,
      raw_text: text,
      details: parsed.details,
      added_by: user.id,
      source: 'agent',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
