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
import { generateAndStoreCover } from '@/lib/trip-cover'

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

// Pull the city out of a hotel address. The Claude parser produces addresses
// in many shapes:
//
//   3-part US:        "1 Ritz Carlton Drive, Kapalua, HI 96761"
//   4-part with ctry: "383 Kalaimoku St, Waikiki Beach, HI, USA"
//   3-part intl:      "Pointe Tata A, Faaa, French Polynesia 98702"
//   4-part Canadian:  "123 Main St, Vancouver, BC, Canada"
//   2-part merged:    "3900 Wailea Alanui Drive, Kihei HI 96753"
//   2-part normal:    "Honolulu, HI"
//   city + country:   "Bora Bora, French Polynesia"
//   no comma:         "Disneyland"
//
// Strategy:
//   1. Strip a trailing country chunk if present (with or without trailing
//      postal code), so the rest looks like a standard "street, city, state"
//      address.
//   2. For 3+ parts: the city is the second-to-last chunk.
//   3. For 2 parts: distinguish "street, city STATE zip" (city in parts[1])
//      from "city, state" (city in parts[0]) using the US state code list
//      and a merged-city-state regex.
//   4. For 1 part: detect if it's a single chunk like "Kihei HI 96753"
//      with a merged city + state.
//   5. Otherwise return the input unchanged.
//
// Exported for unit tests in src/test/trip-autofill.test.ts.

// Common country names that show up at the end of comma-separated addresses.
// Compared case-insensitively after stripping any trailing postal code.
const COUNTRIES = new Set([
  'USA', 'US', 'U.S.A.', 'U.S.', 'UNITED STATES', 'UNITED STATES OF AMERICA',
  'CANADA',
  'MEXICO',
  'UK', 'U.K.', 'UNITED KINGDOM', 'ENGLAND', 'SCOTLAND', 'WALES', 'NORTHERN IRELAND',
  'IRELAND',
  'FRANCE', 'FRENCH POLYNESIA', 'ITALY', 'SPAIN', 'GERMANY', 'PORTUGAL', 'GREECE',
  'NETHERLANDS', 'BELGIUM', 'SWITZERLAND', 'AUSTRIA', 'DENMARK', 'SWEDEN', 'NORWAY',
  'FINLAND', 'ICELAND', 'POLAND', 'CZECH REPUBLIC', 'CZECHIA', 'HUNGARY', 'CROATIA',
  'JAPAN', 'CHINA', 'KOREA', 'SOUTH KOREA', 'NORTH KOREA', 'TAIWAN', 'HONG KONG',
  'INDIA', 'THAILAND', 'VIETNAM', 'PHILIPPINES', 'INDONESIA', 'SINGAPORE', 'MALAYSIA',
  'AUSTRALIA', 'NEW ZEALAND', 'FIJI',
  'BRAZIL', 'ARGENTINA', 'CHILE', 'PERU', 'COLOMBIA', 'COSTA RICA', 'PANAMA',
  'EGYPT', 'MOROCCO', 'SOUTH AFRICA', 'KENYA', 'TANZANIA',
  'TURKEY', 'GREECE', 'ISRAEL', 'UAE', 'UNITED ARAB EMIRATES',
])

// US state and territory codes. Used to disambiguate "city, state" from
// "street, city" in 2-part addresses.
const US_STATES = new Set([
  'AK', 'AL', 'AR', 'AZ', 'CA', 'CO', 'CT', 'DC', 'DE', 'FL',
  'GA', 'HI', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA',
  'MD', 'ME', 'MI', 'MN', 'MO', 'MS', 'MT', 'NC', 'ND', 'NE',
  'NH', 'NJ', 'NM', 'NV', 'NY', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'VT', 'WA', 'WI', 'WV', 'WY',
  'AS', 'GU', 'MP', 'PR', 'VI',
])

// Matches "City STATE [zip]" merged into a single chunk. Lazy `.+?` finds
// the shortest city prefix such that the rest is a 2-letter state code with
// optional 5-digit (+ optional 4) zip. Multi-word cities like "Salt Lake
// City UT 84111" work because the regex backtracks until the state code
// matches.
const MERGED_CITY_STATE_RE = /^(.+?)\s+([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?$/

// Strip a trailing US-style postal code (5 digits or 5+4) and return the
// rest. Used to test whether a chunk is a state or a country.
function stripTrailingZip(s: string): string {
  return s.replace(/\s*\d{5}(?:-\d{4})?\s*$/, '').trim()
}

function isCountry(part: string): boolean {
  const stripped = stripTrailingZip(part).toUpperCase()
  return COUNTRIES.has(stripped)
}

function isUsState(part: string): boolean {
  const stripped = stripTrailingZip(part).toUpperCase()
  return US_STATES.has(stripped)
}

export function cityFromAddress(address: string): string {
  let parts = address.split(',').map(p => p.trim()).filter(Boolean)
  if (parts.length === 0) return address

  // (1) Strip trailing country chunks. Handles "..., HI, USA" → "..., HI"
  // and "..., French Polynesia 98702" → "...".
  while (parts.length > 1 && isCountry(parts[parts.length - 1])) {
    parts = parts.slice(0, -1)
  }

  // After stripping, decide based on length:

  if (parts.length === 1) {
    // (4) Single chunk: detect merged "City STATE [zip]" form, otherwise
    // return as-is. This handles "Bora Bora" (after country strip) and
    // "Kihei HI 96753" (when there's no street prefix).
    const merged = parts[0].match(MERGED_CITY_STATE_RE)
    if (merged) return merged[1]
    return parts[0]
  }

  if (parts.length === 2) {
    // (3) Two chunks. Three sub-cases:
    //   a) "street, city STATE zip" — city is inside parts[1] (merged form).
    //   b) "city, state" / "city, state zip" — city is parts[0].
    //   c) "street, city" (post-country-strip) — city is parts[1].
    const merged = parts[1].match(MERGED_CITY_STATE_RE)
    if (merged) return merged[1]
    if (isUsState(parts[1])) return parts[0]
    return parts[1]
  }

  // (2) 3+ parts: street(s), city, state[+zip]. The city is the
  // second-to-last chunk.
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

// Generate the cover image when destination just transitioned from null →
// set. Calls the trip-cover library directly (no loopback HTTP hop). Safe
// to await; the call is idempotent (short-circuits if cover_image_url is
// already populated). Errors are logged and swallowed — best-effort.
export async function generateCoverIfNeeded(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  tripId: string,
  result: AutofillResult
): Promise<void> {
  if (!result.destinationJustSet) return
  try {
    const coverResult = await generateAndStoreCover(supabase, tripId)
    if (!coverResult.ok) {
      console.error('[autofill] cover gen failed:', coverResult.error)
    }
  } catch (err) {
    console.error('[autofill] cover gen unexpected:', err)
  }
}
