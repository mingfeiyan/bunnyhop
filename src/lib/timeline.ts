import type { TripContext, TimelineEvent } from '@/types'

const EVENT_TYPE_ORDER: Record<string, number> = {
  arrival: 0,
  check_in: 1,
  check_out: 2,
  departure: 3,
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Returns the input string if it is a valid ISO YYYY-MM-DD date, otherwise ''
function validIsoDate(value: unknown): string {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return ''
  const [y, m, d] = value.split('-').map(Number)
  // Sanity check: year 1900-2100, month 1-12, day 1-31
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return ''
  return value
}

// Convert HH:MM 24-hour format to 12-hour format with AM/PM. Returns the input
// unchanged if it doesn't look like HH:MM.
function formatTime12h(value: string): string {
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

export function expandContextToEvents(
  ctx: TripContext,
  familyName: string | null,
  familyColor: string | null
): TimelineEvent[] {
  // Defensive: details may be null or non-object on malformed rows
  const details: Record<string, unknown> = (ctx.details && typeof ctx.details === 'object')
    ? (ctx.details as Record<string, unknown>)
    : {}

  if (ctx.type === 'flight') {
    const date = validIsoDate(details.date)
    const airline = (details.airline as string) || ''
    const flightNumber = (details.flight_number as string) || ''
    const origin = (details.origin as string) || ''
    const destination = (details.destination as string) || ''
    const arrivalTime = formatTime12h((details.arrival_time as string) || '')
    const departureTime = formatTime12h((details.departure_time as string) || '')
    const hasArrival = !!destination
    const eventType = hasArrival ? 'arrival' : 'departure'
    const routeStr = origin && destination ? `${origin} → ${destination}` : ''

    // Show both depart and arrive times when available
    const timeParts: string[] = []
    if (departureTime) timeParts.push(`depart ${departureTime}`)
    if (arrivalTime) timeParts.push(`arrive ${arrivalTime}`)
    const timeStr = timeParts.join(', ')

    const parts = [airline, flightNumber, routeStr, timeStr].filter(Boolean)

    return [{
      id: `${ctx.id}-flight`,
      date,
      type: eventType,
      icon: '✈️',
      title: familyName ? `${familyName} ${eventType === 'arrival' ? 'arrives' : 'departs'}` : (eventType === 'arrival' ? 'Arrival' : 'Departure'),
      description: parts.join(' — ') || ctx.raw_text,
      familyName,
      familyColor,
      rawText: ctx.raw_text,
      dateUnclear: !date,
    }]
  }

  if (ctx.type === 'hotel') {
    const checkIn = validIsoDate(details.check_in)
    const checkOut = validIsoDate(details.check_out)
    const hotelName = (details.name as string) || ''
    const events: TimelineEvent[] = []

    const nights = checkIn && checkOut
      ? Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
      : null
    const nightsStr = nights ? `${nights} night${nights !== 1 ? 's' : ''}` : ''

    events.push({
      id: `${ctx.id}-checkin`,
      date: checkIn,
      type: 'check_in',
      icon: '🏨',
      title: familyName ? `${familyName} checks in` : 'Hotel check-in',
      description: [hotelName, nightsStr].filter(Boolean).join(', ') || ctx.raw_text,
      familyName,
      familyColor,
      rawText: ctx.raw_text,
      dateUnclear: !checkIn,
    })

    events.push({
      id: `${ctx.id}-checkout`,
      date: checkOut,
      type: 'check_out',
      icon: '🏨',
      title: familyName ? `${familyName} checks out` : 'Hotel check-out',
      description: hotelName || ctx.raw_text,
      familyName,
      familyColor,
      rawText: ctx.raw_text,
      dateUnclear: !checkOut,
    })

    return events
  }

  return []
}

export function sortTimelineEvents(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => {
    if (a.dateUnclear && !b.dateUnclear) return 1
    if (!a.dateUnclear && b.dateUnclear) return -1
    if (a.dateUnclear && b.dateUnclear) return 0

    const dateCompare = a.date.localeCompare(b.date)
    if (dateCompare !== 0) return dateCompare

    return (EVENT_TYPE_ORDER[a.type] ?? 99) - (EVENT_TYPE_ORDER[b.type] ?? 99)
  })
}

type FamilyDateRange = {
  familyName: string
  earliest: string
  latest: string
}

export type Overlap = {
  start: string
  end: string
}

export function computeOverlap(familyDateRanges: FamilyDateRange[]): Overlap | null {
  if (familyDateRanges.length < 2) return null

  const latestEarliest = familyDateRanges.reduce(
    (max, f) => (f.earliest > max ? f.earliest : max),
    familyDateRanges[0].earliest
  )

  const earliestLatest = familyDateRanges.reduce(
    (min, f) => (f.latest < min ? f.latest : min),
    familyDateRanges[0].latest
  )

  if (latestEarliest > earliestLatest) return null

  return { start: latestEarliest, end: earliestLatest }
}

export function formatDateHeader(isoDate: string, timezone: string | null): string {
  // Bail out gracefully on invalid input
  if (!validIsoDate(isoDate)) return isoDate || 'Unknown date'

  // Parse date components directly to avoid timezone-shifting issues.
  // We use the target timezone (or UTC) to determine the day-of-week for the
  // given calendar date, then format using those same components.
  const [year, month, day] = isoDate.split('-').map(Number)
  let tz = 'UTC'
  if (timezone) {
    try {
      // Validate the timezone string by attempting to use it
      Intl.DateTimeFormat(undefined, { timeZone: timezone })
      tz = timezone
    } catch {
      // Invalid timezone — fall back to UTC
    }
  }

  // Build a UTC instant that lands on this calendar date at noon in the target
  // timezone.  We approximate the offset by formatting a reference instant and
  // reading back the date it shows in that timezone, then adjusting.
  // Simpler: use Intl.DateTimeFormat to get the weekday for this date directly
  // by constructing an instant that is unambiguously this date in the target tz.
  // Strategy: start at noon UTC, then check what date the target tz shows.
  // If it differs, shift by ±12 h until the target tz shows the right date.
  let utcMs = Date.UTC(year, month - 1, day, 12, 0, 0)

  const checkDate = (ms: number): { y: number; m: number; d: number } => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz,
    }).formatToParts(new Date(ms))
    return {
      y: Number(parts.find(p => p.type === 'year')?.value),
      m: Number(parts.find(p => p.type === 'month')?.value),
      d: Number(parts.find(p => p.type === 'day')?.value),
    }
  }

  // Adjust up to ±14 hours (maximum real timezone offset)
  let checked = checkDate(utcMs)
  if (checked.d !== day || checked.m !== month || checked.y !== year) {
    // Try shifting by -1 day (target tz is ahead of UTC)
    const adjusted = utcMs - 24 * 60 * 60 * 1000
    checked = checkDate(adjusted)
    if (checked.d === day && checked.m === month && checked.y === year) {
      utcMs = adjusted
    }
    // else try shifting by +1 day (target tz is behind UTC)
    else {
      const adjusted2 = utcMs + 24 * 60 * 60 * 1000
      checked = checkDate(adjusted2)
      if (checked.d === day && checked.m === month && checked.y === year) {
        utcMs = adjusted2
      }
    }
  }

  const options: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    weekday: 'short',
    timeZone: tz,
  }
  const formatted = new Date(utcMs).toLocaleDateString('en-US', options)
  // Intl gives "Sat, July 5, 2026" — reformat to "July 5, 2026 (Sat)"
  const parts = formatted.split(', ')
  if (parts.length === 3) {
    return `${parts[1]}, ${parts[2]} (${parts[0]})`
  }
  return formatted
}
