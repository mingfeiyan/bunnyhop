import { createClient } from '@/lib/supabase/server'
import { autofillTripFromEvents, generateCoverIfNeeded } from '@/lib/trip-autofill'
import { checkApiSecurity } from '@/lib/api-security'
import { byCodeLimiter } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
// HH:MM 24-hour format, 00:00 through 23:59
const TIME_24H_RE = /^([01]\d|2[0-3]):[0-5]\d$/

type IncomingEvent = {
  type?: string
  title?: string
  start_date?: string
  end_date?: string | null
  start_time?: string | null
  end_time?: string | null
  origin?: string | null
  destination?: string | null
  reference?: string | null
  details?: Record<string, unknown>
}

const VALID_EVENT_TYPES = new Set(['flight', 'hotel', 'activity', 'airbnb', 'cruise'])

function validateEvent(e: unknown): { ok: true; value: IncomingEvent } | { ok: false; error: string } {
  if (!e || typeof e !== 'object') return { ok: false, error: 'event must be an object' }
  const ev = e as IncomingEvent
  if (!ev.type || !VALID_EVENT_TYPES.has(ev.type)) {
    return { ok: false, error: 'type must be one of: flight, hotel, airbnb, cruise, activity' }
  }
  if (!ev.title || typeof ev.title !== 'string') {
    return { ok: false, error: 'title is required' }
  }
  if (!ev.start_date || typeof ev.start_date !== 'string' || !ISO_DATE_RE.test(ev.start_date)) {
    return { ok: false, error: 'start_date is required in YYYY-MM-DD format' }
  }
  if (ev.end_date && (typeof ev.end_date !== 'string' || !ISO_DATE_RE.test(ev.end_date))) {
    return { ok: false, error: 'end_date must be YYYY-MM-DD format if provided' }
  }
  if (ev.start_time && (typeof ev.start_time !== 'string' || !TIME_24H_RE.test(ev.start_time))) {
    return { ok: false, error: 'start_time must be HH:MM 24-hour format if provided (e.g. "13:25")' }
  }
  if (ev.end_time && (typeof ev.end_time !== 'string' || !TIME_24H_RE.test(ev.end_time))) {
    return { ok: false, error: 'end_time must be HH:MM 24-hour format if provided (e.g. "21:30")' }
  }
  return { ok: true, value: ev }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const securityError = await checkApiSecurity(request, { rateLimiter: byCodeLimiter })
  if (securityError) return securityError

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

  const body = await request.json()
  const incoming = Array.isArray(body) ? body : [body]
  if (incoming.length === 0) {
    return NextResponse.json({ error: 'no events provided' }, { status: 400 })
  }

  const validEvents: IncomingEvent[] = []
  for (let i = 0; i < incoming.length; i++) {
    const result = validateEvent(incoming[i])
    if (!result.ok) {
      return NextResponse.json({ error: `event[${i}]: ${result.error}` }, { status: 400 })
    }
    validEvents.push(result.value)
  }

  const rows = validEvents.map(ev => ({
    trip_id: tripId,
    type: ev.type!,
    title: ev.title!,
    start_date: ev.start_date!,
    end_date: ev.end_date ?? null,
    start_time: ev.start_time ?? null,
    end_time: ev.end_time ?? null,
    origin: ev.origin ?? null,
    destination: ev.destination ?? null,
    reference: ev.reference ?? null,
    details: ev.details ?? {},
    added_by: user.id,
    source: 'manual',
  }))

  const { data, error } = await supabase
    .from('timeline_events')
    .insert(rows)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Backfill missing trip metadata from the inserted events. Idempotent.
  const result = await autofillTripFromEvents(supabase, tripId)
  await generateCoverIfNeeded(supabase, tripId, result)

  return NextResponse.json(data)
}
