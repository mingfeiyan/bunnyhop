import { createClient } from '@/lib/supabase/server'
import { parseContext } from '@/lib/claude'
import { parsedEntryToTimelineEvent } from '@/lib/timeline-events'
import { autofillTripFromEvents, fireCoverGenerationIfNeeded } from '@/lib/trip-autofill'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params
  const supabase = await createClient()
  const origin = new URL(request.url).origin

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

  // Split entries: flight/hotel → timeline_events, others → trip_context.
  // If a flight/hotel can't be converted (missing required fields), fall back
  // to trip_context so the entry is not silently lost.
  const timelineRows: Array<Record<string, unknown>> = []
  const contextRows: Array<Record<string, unknown>> = []

  for (const entry of parsedEntries) {
    if (entry.type === 'flight' || entry.type === 'hotel' || entry.type === 'activity') {
      const ev = parsedEntryToTimelineEvent(entry)
      if (ev) {
        timelineRows.push({
          ...ev,
          trip_id: tripId,
          added_by: user.id,
          source: 'manual',
        })
        continue
      }
    }
    contextRows.push({
      trip_id: tripId,
      type: entry.type,
      raw_text: entry.raw_text || text,
      details: entry.details,
      added_by: user.id,
      source: 'manual',
    })
  }

  const inserted: unknown[] = []

  if (timelineRows.length > 0) {
    const { data, error } = await supabase
      .from('timeline_events')
      .insert(timelineRows)
      .select()
    if (error) {
      return NextResponse.json({ error: `timeline_events insert failed: ${error.message}` }, { status: 500 })
    }
    if (data) inserted.push(...data)

    // Backfill missing trip metadata (destination, dates) from the events
    // we just inserted plus any pre-existing ones. Helper is idempotent and
    // only fills nulls. Best-effort — errors are logged inside the helper.
    const result = await autofillTripFromEvents(supabase, tripId)
    fireCoverGenerationIfNeeded(origin, tripId, result)
  }

  if (contextRows.length > 0) {
    const { data, error } = await supabase
      .from('trip_context')
      .insert(contextRows)
      .select()
    if (error) {
      return NextResponse.json({ error: `trip_context insert failed: ${error.message}` }, { status: 500 })
    }
    if (data) inserted.push(...data)
  }

  return NextResponse.json(inserted)
}
