import { createServerClient } from '@supabase/ssr'
import { parseContext } from '@/lib/claude'
import { parsedEntryToTimelineEvent } from '@/lib/timeline-events'
import { NextResponse } from 'next/server'

// Create a Supabase client with service role key (bypasses RLS)
// Used for agent API where there's no browser session
function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  )
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ inviteCode: string }> }
) {
  const { inviteCode } = await params

  const supabase = createServiceClient()

  // Find trip by invite code — the invite code IS the auth
  const { data: trip } = await supabase
    .from('trips')
    .select('id, created_by')
    .eq('invite_code', inviteCode)
    .single()

  if (!trip) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
  }

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
