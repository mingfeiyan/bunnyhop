import type { TripContext, TimelineEvent } from '@/types'

const EVENT_TYPE_ORDER: Record<string, number> = {
  arrival: 0,
  check_in: 1,
  check_out: 2,
  departure: 3,
}

export function expandContextToEvents(
  ctx: TripContext,
  familyName: string | null,
  familyColor: string | null
): TimelineEvent[] {
  const details = ctx.details as Record<string, unknown>

  if (ctx.type === 'flight') {
    const date = (details.date as string) || ''
    const airline = (details.airline as string) || ''
    const flightNumber = (details.flight_number as string) || ''
    const origin = (details.origin as string) || ''
    const destination = (details.destination as string) || ''
    const arrivalTime = (details.arrival_time as string) || ''
    const departureTime = (details.departure_time as string) || ''
    const hasArrival = !!destination
    const eventType = hasArrival ? 'arrival' : 'departure'
    const timeStr = hasArrival ? arrivalTime : departureTime
    const routeStr = origin && destination ? `${origin} → ${destination}` : ''
    const parts = [airline, flightNumber, routeStr, timeStr ? `at ${timeStr}` : ''].filter(Boolean)

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
    const checkIn = (details.check_in as string) || ''
    const checkOut = (details.check_out as string) || ''
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
  const date = new Date(isoDate + 'T12:00:00')
  const options: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: timezone || undefined,
  }
  const formatted = date.toLocaleDateString('en-US', options)
  // Intl gives "Sat, July 5" — reformat to "July 5 (Sat)"
  const parts = formatted.split(', ')
  if (parts.length === 2) {
    return `${parts[1]} (${parts[0]})`
  }
  return formatted
}
