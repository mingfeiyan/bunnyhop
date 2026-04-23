import { createServiceClient } from '@/lib/supabase/server'
import { autofillTripFromEvents, generateCoverIfNeeded } from '@/lib/trip-autofill'
import { checkApiSecurity } from '@/lib/api-security'
import { byCodeLimiter } from '@/lib/rate-limit'
import { resolveInviteCode } from '@/lib/trip-invite'
import { VALID_EVENT_TYPES, VALID_STATUSES, matchCardByPlaceId } from '@/lib/timeline-links'
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
  card_id?: string | null
  status?: string
  google_place_id?: string
}

function validateEvent(e: unknown): { ok: true; value: IncomingEvent } | { ok: false; error: string } {
  if (!e || typeof e !== 'object') return { ok: false, error: 'event must be an object' }
  const ev = e as IncomingEvent
  if (!ev.type || !VALID_EVENT_TYPES.has(ev.type)) {
    return { ok: false, error: `type must be one of: ${[...VALID_EVENT_TYPES].join(', ')}` }
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
  if (ev.status !== undefined && !VALID_STATUSES.has(ev.status)) {
    return { ok: false, error: `status must be one of: ${[...VALID_STATUSES].join(', ')}` }
  }
  if (ev.card_id !== undefined && ev.card_id !== null && typeof ev.card_id !== 'string') {
    return { ok: false, error: 'card_id must be a string if provided' }
  }
  if (ev.google_place_id !== undefined && typeof ev.google_place_id !== 'string') {
    return { ok: false, error: 'google_place_id must be a string if provided' }
  }
  return { ok: true, value: ev }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ inviteCode: string }> }
) {
  const securityError = await checkApiSecurity(request, { rateLimiter: byCodeLimiter, checkOrigin: false })
  if (securityError) return securityError

  const { inviteCode } = await params
  const supabase = createServiceClient()

  // Resolve code to (trip, family). Since migration 019, codes are per-family,
  // so the family_id tells us who's posting and drives attribution on insert.
  const resolved = await resolveInviteCode(supabase, inviteCode, 'id, created_by')
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
  }
  const trip = resolved.trip as { id: string; created_by: string }
  const familyId = resolved.familyId

  const body = await request.json()
  const incoming = Array.isArray(body) ? body : [body]
  if (incoming.length === 0) {
    return NextResponse.json({ error: 'no events provided' }, { status: 400 })
  }

  // Validate each event
  const validEvents: IncomingEvent[] = []
  for (let i = 0; i < incoming.length; i++) {
    const result = validateEvent(incoming[i])
    if (!result.ok) {
      return NextResponse.json({ error: `event[${i}]: ${result.error}` }, { status: 400 })
    }
    validEvents.push(result.value)
  }

  // Fallback: resolve google_place_id -> card_id when agent didn't pass explicit card_id.
  // Exact place_id only; matchCardByPlaceId returns null on zero or multiple matches.
  const needsFallback = validEvents.some(e => !e.card_id && e.google_place_id)
  if (needsFallback) {
    const { data: cardsForMatch } = await supabase
      .from('cards')
      .select('id, metadata')
      .eq('trip_id', trip.id)
    for (const e of validEvents) {
      if (!e.card_id && e.google_place_id) {
        e.card_id = matchCardByPlaceId(cardsForMatch ?? [], e.google_place_id)
      }
    }
  }

  // Ownership check (symmetric with authed route). Place_id-derived ids come from
  // a trip-scoped query so they'll always belong, but this defends against any
  // explicit card_id the agent passes.
  const cardIds = validEvents
    .map(ev => ev.card_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
  if (cardIds.length > 0) {
    const { data: ownedCards } = await supabase
      .from('cards')
      .select('id')
      .eq('trip_id', trip.id)
      .in('id', cardIds)
    const owned = new Set((ownedCards ?? []).map(c => c.id))
    for (const id of cardIds) {
      if (!owned.has(id)) {
        return NextResponse.json(
          { error: `card_id ${id} does not belong to this trip` },
          { status: 400 },
        )
      }
    }
  }

  // Insert
  const rows = validEvents.map(ev => ({
    trip_id: trip.id,
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
    added_by: trip.created_by,
    family_id: familyId,
    source: 'agent',
    card_id: ev.card_id ?? null,
    status: ev.status ?? 'planned',
  }))

  const { data, error } = await supabase
    .from('timeline_events')
    .insert(rows)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Backfill missing trip metadata from the inserted events. Idempotent.
  const result = await autofillTripFromEvents(supabase, trip.id)
  await generateCoverIfNeeded(supabase, trip.id, result)

  return NextResponse.json(data)
}
