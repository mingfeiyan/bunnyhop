import { createServiceClient } from '@/lib/supabase/server'
import { parseContext } from '@/lib/claude'
import { parsedEntryToTimelineEvent } from '@/lib/timeline-events'
import { autofillTripFromEvents, generateCoverIfNeeded } from '@/lib/trip-autofill'
import { checkApiSecurity } from '@/lib/api-security'
import { byCodeLimiter } from '@/lib/rate-limit'
import { resolveInviteCode } from '@/lib/trip-invite'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ inviteCode: string }> }
) {
  const securityError = await checkApiSecurity(request, { rateLimiter: byCodeLimiter, checkOrigin: false })
  if (securityError) return securityError

  const { inviteCode } = await params

  const supabase = createServiceClient()

  const resolved = await resolveInviteCode(supabase, inviteCode, 'id, created_by')
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
  }
  const trip = resolved.trip as { id: string; created_by: string }
  const familyId = resolved.familyId

  const body = await request.json()
  const { text } = body
  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'text field is required' }, { status: 400 })
  }

  // Parse with AI — may return multiple entries
  const parsedEntries = await parseContext(text)

  // Split entries: flight/hotel → timeline_events, others → trip_context.
  const timelineRows: Array<Record<string, unknown>> = []
  const contextRows: Array<Record<string, unknown>> = []

  for (const entry of parsedEntries) {
    if (entry.type === 'flight' || entry.type === 'hotel' || entry.type === 'activity') {
      const ev = parsedEntryToTimelineEvent(entry)
      if (ev) {
        timelineRows.push({
          ...ev,
          trip_id: trip.id,
          added_by: trip.created_by,
          family_id: familyId,
          source: 'agent',
        })
        continue
      }
    }
    contextRows.push({
      trip_id: trip.id,
      type: entry.type,
      raw_text: entry.raw_text || text,
      details: entry.details,
      added_by: trip.created_by,
      source: 'agent',
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

    // Backfill missing trip metadata from the events. Idempotent.
    const result = await autofillTripFromEvents(supabase, trip.id)
    await generateCoverIfNeeded(supabase, trip.id, result)
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
