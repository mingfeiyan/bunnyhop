import { createClient } from '@/lib/supabase/server'
import { parseContext } from '@/lib/claude'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is a participant
  const { data: participant } = await supabase
    .from('trip_participants')
    .select('id')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .single()

  if (!participant) {
    return NextResponse.json({ error: 'Not a trip participant' }, { status: 403 })
  }

  const { text } = await request.json()
  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 })
  }

  // Parse with AI — may return multiple entries
  const parsedEntries = await parseContext(text)

  // Store each parsed entry as a separate row
  const rows = parsedEntries.map(entry => ({
    trip_id: tripId,
    type: entry.type,
    raw_text: entry.raw_text || text,
    details: entry.details,
    added_by: user.id,
    source: 'manual',
  }))

  const { data, error } = await supabase
    .from('trip_context')
    .insert(rows)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
