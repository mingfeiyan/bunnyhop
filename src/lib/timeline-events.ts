import type { ParsedEntry } from '@/lib/claude'
import type { TimelineEventRow } from '@/types'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_24H_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_RE.test(value)
}

function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_24H_RE.test(value)
}

// Coerce a time-like value to HH:MM 24h or null. Drops malformed strings.
function coerceTime(value: unknown): string | null {
  return isValidTime(value) ? value : null
}

// Insertable shape — omits DB-managed fields and `added_by` (set by caller)
export type TimelineEventInsert = Omit<TimelineEventRow, 'id' | 'created_at' | 'added_by'>

// Convert a Claude-parsed entry into a timeline_events row.
// Returns null if the entry can't be converted (e.g., missing required date,
// or the parsed type isn't a timeline-eligible kind like 'note' or 'constraint').
export function parsedEntryToTimelineEvent(entry: ParsedEntry): TimelineEventInsert | null {
  // Filter out non-timeline types up front so the switch below can be exhaustive
  // over the timeline-eligible subset.
  if (entry.type !== 'flight' && entry.type !== 'hotel' && entry.type !== 'activity') {
    return null
  }

  const details = (entry.details && typeof entry.details === 'object')
    ? (entry.details as Record<string, unknown>)
    : {}

  switch (entry.type) {
    case 'flight': {
      const date = details.date
      if (!isIsoDate(date)) return null

      const airline = (details.airline as string) || ''
      const flightNumber = (details.flight_number as string) || ''
      const origin = (details.origin as string) || null
      const destination = (details.destination as string) || null
      const departureTime = coerceTime(details.departure_time)
      const arrivalTime = coerceTime(details.arrival_time)

      // Build a clean title from extracted fields, fall back to raw_text
      const titleParts = [airline, flightNumber, origin && destination ? `${origin} → ${destination}` : ''].filter(Boolean)
      const title = titleParts.length > 0 ? titleParts.join(' ') : entry.raw_text

      return {
        trip_id: '', // caller fills in
        type: 'flight',
        title,
        start_date: date,
        end_date: null,
        start_time: departureTime,
        end_time: arrivalTime,
        origin,
        destination,
        reference: flightNumber || null,
        details,
        source: 'manual',
      }
    }

    case 'hotel': {
      const checkIn = details.check_in
      if (!isIsoDate(checkIn)) return null

      const checkOut = isIsoDate(details.check_out) ? (details.check_out as string) : null
      const hotelName = (details.name as string) || ''
      const title = hotelName || entry.raw_text

      return {
        trip_id: '',
        type: 'hotel',
        title,
        start_date: checkIn,
        end_date: checkOut,
        start_time: null,
        end_time: null,
        origin: null,
        destination: null,
        reference: null,
        details,
        source: 'manual',
      }
    }

    case 'activity': {
      const date = details.date
      if (!isIsoDate(date)) return null

      const name = (details.name as string) || ''
      const startTime = coerceTime(details.start_time)
      const endTime = coerceTime(details.end_time)
      const title = name || entry.raw_text
      const reference = (details.confirmation as string) || null

      return {
        trip_id: '',
        type: 'activity',
        title,
        start_date: date,
        end_date: null,
        start_time: startTime,
        end_time: endTime,
        origin: null,
        destination: null,
        reference,
        details,
        source: 'manual',
      }
    }

    default: {
      const _exhaustive: never = entry.type
      return _exhaustive
    }
  }
}

// Convert HH:MM 24-hour format to 12-hour format with AM/PM
export function formatTime12h(value: string | null): string {
  if (!value) return ''
  const match = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return value
  const h = Number(match[1])
  const m = Number(match[2])
  if (h < 0 || h > 23 || m < 0 || m > 59) return value
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${match[2]} ${period}`
}

// Build a human-friendly description string for a timeline event
export function formatTimelineEventDescription(event: TimelineEventRow): string {
  switch (event.type) {
    case 'flight': {
      const route = event.origin && event.destination ? `${event.origin} → ${event.destination}` : ''
      const timeParts: string[] = []
      if (event.start_time) timeParts.push(`depart ${formatTime12h(event.start_time)}`)
      if (event.end_time) timeParts.push(`arrive ${formatTime12h(event.end_time)}`)
      const parts = [route, timeParts.join(', '), event.reference].filter(Boolean)
      return parts.join(' — ') || event.title
    }

    case 'hotel': {
      const nights = event.end_date
        ? Math.round((new Date(event.end_date).getTime() - new Date(event.start_date).getTime()) / (1000 * 60 * 60 * 24))
        : null
      const nightsStr = nights ? `${nights} night${nights !== 1 ? 's' : ''}` : ''
      const checkOutStr = event.end_date ? `check-out ${event.end_date}` : ''
      const parts = [nightsStr, checkOutStr].filter(Boolean)
      return parts.join(' — ') || ''
    }

    case 'activity': {
      const timeParts: string[] = []
      if (event.start_time) timeParts.push(formatTime12h(event.start_time))
      if (event.end_time) timeParts.push(formatTime12h(event.end_time))
      const timeStr = timeParts.join(' – ')
      const location = (event.details?.location as string) || ''
      const parts = [timeStr, location, event.reference].filter(Boolean)
      return parts.join(' — ') || event.title
    }

    default: {
      const _exhaustive: never = event.type
      return _exhaustive
    }
  }
}
