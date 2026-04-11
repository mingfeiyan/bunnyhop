// Auto-fill trip metadata (destination, date_start, date_end) from the
// timeline_events that exist for that trip. Called after any insert into
// timeline_events from any of the four endpoints:
//
//   - /api/trips/[tripId]/context
//   - /api/trips/by-code/[inviteCode]/context
//   - /api/trips/[tripId]/timeline-events
//   - /api/trips/by-code/[inviteCode]/timeline-events
//
// Idempotent: only fills fields that are currently null. Never overwrites
// user-entered values. Best-effort: errors are logged and swallowed so
// they don't poison the calling endpoint.

import type { SupabaseClient } from '@supabase/supabase-js'

type TripRow = {
  id: string
  destination: string | null
  date_start: string | null
  date_end: string | null
  cover_image_url: string | null
}

type EventRow = {
  type: 'flight' | 'hotel' | 'activity'
  start_date: string
  end_date: string | null
  destination: string | null
  details: Record<string, unknown> | null
}

// Pull the city from a hotel address. Addresses parser-extracted by Claude
// look like "1 Ritz Carlton Drive, Kapalua, HI 96761" — the city is the
// second-to-last comma-separated chunk (the last chunk is "STATE ZIP" or
// "STATE", and for international addresses the last chunk is the country).
// For 2-part addresses ("Kapalua, HI"), the city is the first chunk.
// For 1-part addresses, return as-is.
//
// Exported for unit tests in src/test/trip-autofill.test.ts.
export function cityFromAddress(address: string): string {
  const parts = address.split(',').map(p => p.trim()).filter(Boolean)
  if (parts.length === 0) return address
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return parts[0]
  // 3+ parts: street(s), city, state(/zip)[, country]
  return parts[parts.length - 2]
}

// Compute the destination string from the events. Priority order:
//   1. First hotel's address (city portion)
//   2. First hotel's name (raw — usually contains a place name)
//   3. First flight's destination column (raw IATA — better than null)
//   4. null (no events that imply a destination)
function pickDestination(events: EventRow[]): string | null {
  for (const ev of events) {
    if (ev.type !== 'hotel') continue
    const details = ev.details ?? {}
    const address = typeof details.address === 'string' ? details.address.trim() : ''
    if (address) return cityFromAddress(address)
    const name = typeof details.name === 'string' ? details.name.trim() : ''
    if (name) return name
  }
  for (const ev of events) {
    if (ev.type === 'flight' && ev.destination) return ev.destination
  }
  return null
}

// Compute date_end from the latest end_date or start_date across all events.
// Hotel check_out (end_date) wins; otherwise the latest start_date.
function pickDateEnd(events: EventRow[]): string | null {
  let latest: string | null = null
  for (const ev of events) {
    const candidate = ev.end_date ?? ev.start_date
    if (!latest || candidate > latest) latest = candidate
  }
  return latest
}

// Compute date_start from the earliest start_date across all events.
function pickDateStart(events: EventRow[]): string | null {
  let earliest: string | null = null
  for (const ev of events) {
    if (!earliest || ev.start_date < earliest) earliest = ev.start_date
  }
  return earliest
}

export type AutofillResult = {
  filled: Partial<Pick<TripRow, 'destination' | 'date_start' | 'date_end'>>
  destinationJustSet: boolean
}

const EMPTY: AutofillResult = { filled: {}, destinationJustSet: false }

// Read the trip + events, compute missing fields, write them back. Returns
// which fields were filled and whether destination just transitioned from
// null → set (so callers can fire generate-cover for the cover image).
//
// Best-effort: any error is logged with the [autofill] prefix and the
// function returns EMPTY rather than throwing. The four endpoint hooks that
// call this rely on the contract that an error here never breaks the parent
// request — only the auto-fill side effect is skipped.
export async function autofillTripFromEvents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  tripId: string
): Promise<AutofillResult> {
  try {
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id, destination, date_start, date_end, cover_image_url')
      .eq('id', tripId)
      .single()

    if (tripError || !trip) {
      console.error('[autofill] trip lookup failed:', tripError)
      return EMPTY
    }

    const tripRow = trip as TripRow

    // Short-circuit: nothing to fill
    const needsDestination = tripRow.destination === null
    const needsDateStart = tripRow.date_start === null
    const needsDateEnd = tripRow.date_end === null
    if (!needsDestination && !needsDateStart && !needsDateEnd) {
      return EMPTY
    }

    const { data: events, error: eventsError } = await supabase
      .from('timeline_events')
      .select('type, start_date, end_date, destination, details')
      .eq('trip_id', tripId)

    if (eventsError) {
      console.error('[autofill] events lookup failed:', eventsError)
      return EMPTY
    }

    const eventRows = (events ?? []) as EventRow[]
    if (eventRows.length === 0) return EMPTY

    const patch: Partial<TripRow> = {}
    const filled: AutofillResult['filled'] = {}

    if (needsDestination) {
      const dest = pickDestination(eventRows)
      if (dest) {
        patch.destination = dest
        filled.destination = dest
      }
    }
    if (needsDateStart) {
      const start = pickDateStart(eventRows)
      if (start) {
        patch.date_start = start
        filled.date_start = start
      }
    }
    if (needsDateEnd) {
      const end = pickDateEnd(eventRows)
      if (end) {
        patch.date_end = end
        filled.date_end = end
      }
    }

    if (Object.keys(patch).length === 0) return EMPTY

    const { error: updateError } = await supabase
      .from('trips')
      .update(patch)
      .eq('id', tripId)

    if (updateError) {
      console.error('[autofill] trip update failed:', updateError)
      return EMPTY
    }

    return {
      filled,
      destinationJustSet: needsDestination && filled.destination !== undefined,
    }
  } catch (err) {
    console.error('[autofill] unexpected:', err)
    return EMPTY
  }
}

// Helper to fire-and-forget the cover image generation when destination just
// transitioned from null → set. Safe to call after autofillTripFromEvents:
// idempotent on the cover side too (the route returns the cached URL if
// cover_image_url is already populated).
//
// `origin` is needed because the helper is called from server routes where
// there's no window.location — pass the request URL's origin.
export function fireCoverGenerationIfNeeded(
  origin: string,
  tripId: string,
  result: AutofillResult
): void {
  if (!result.destinationJustSet) return
  fetch(`${origin}/api/trips/${tripId}/generate-cover`, { method: 'POST' }).catch(err => {
    console.error('[autofill] cover gen kickoff failed:', err)
  })
}
