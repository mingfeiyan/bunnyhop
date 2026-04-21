import { createClient } from '@/lib/supabase/server'
import { checkApiSecurity } from '@/lib/api-security'
import { byCodeLimiter } from '@/lib/rate-limit'
import { VALID_STATUSES } from '@/lib/timeline-links'
import { NextResponse } from 'next/server'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_24H_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const MUTABLE_FIELDS = new Set([
  'status',
  'start_date',
  'start_time',
  'end_date',
  'end_time',
  'details',
])

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tripId: string; eventId: string }> },
) {
  const securityError = await checkApiSecurity(request, { rateLimiter: byCodeLimiter })
  if (securityError) return securityError

  const { tripId, eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: participant } = await supabase
    .from('trip_participants')
    .select('id')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .single()
  if (!participant) return NextResponse.json({ error: 'Not a trip participant' }, { status: 403 })

  const body = await request.json()
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'body must be an object' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (!MUTABLE_FIELDS.has(key)) continue
    if (key === 'status') {
      if (typeof value !== 'string' || !VALID_STATUSES.has(value)) {
        return NextResponse.json(
          { error: `status must be one of: ${[...VALID_STATUSES].join(', ')}` },
          { status: 400 },
        )
      }
    }
    if ((key === 'start_date' || key === 'end_date') && value != null) {
      if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) {
        return NextResponse.json({ error: `${key} must be YYYY-MM-DD` }, { status: 400 })
      }
    }
    if ((key === 'start_time' || key === 'end_time') && value != null) {
      if (typeof value !== 'string' || !TIME_24H_RE.test(value)) {
        return NextResponse.json({ error: `${key} must be HH:MM 24h` }, { status: 400 })
      }
    }
    update[key] = value
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no mutable fields provided' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('timeline_events')
    .update(update)
    .eq('id', eventId)
    .eq('trip_id', tripId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'event not found' }, { status: 404 })
  return NextResponse.json(data)
}
