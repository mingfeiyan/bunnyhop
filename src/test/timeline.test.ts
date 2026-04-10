import { describe, it, expect } from 'vitest'
import { expandContextToEvents, sortTimelineEvents, computeOverlap, formatDateHeader } from '@/lib/timeline'
import type { TripContext } from '@/types'

const baseFlight: TripContext = {
  id: 'f1',
  trip_id: 't1',
  type: 'flight',
  raw_text: 'Air Tahiti TN102 LAX to PPT, arrives July 5 at 2:30 PM',
  details: {
    airline: 'Air Tahiti',
    flight_number: 'TN102',
    origin: 'LAX',
    destination: 'PPT',
    date: '2026-07-05',
    arrival_time: '14:30',
  },
  added_by: 'user1',
  source: 'manual',
  created_at: '2026-01-01T00:00:00Z',
}

const baseHotel: TripContext = {
  id: 'h1',
  trip_id: 't1',
  type: 'hotel',
  raw_text: 'Conrad Bora Bora, check-in July 5, check-out July 12',
  details: {
    name: 'Conrad Bora Bora',
    check_in: '2026-07-05',
    check_out: '2026-07-12',
  },
  added_by: 'user1',
  source: 'manual',
  created_at: '2026-01-01T00:00:00Z',
}

describe('expandContextToEvents', () => {
  it('expands a flight into one arrival event', () => {
    const events = expandContextToEvents(baseFlight, "Mingfei's family", 'indigo')
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('arrival')
    expect(events[0].date).toBe('2026-07-05')
    expect(events[0].icon).toBe('✈️')
    expect(events[0].familyName).toBe("Mingfei's family")
    expect(events[0].familyColor).toBe('indigo')
    expect(events[0].dateUnclear).toBe(false)
  })

  it('expands a hotel into check_in and check_out events', () => {
    const events = expandContextToEvents(baseHotel, "Mingfei's family", 'indigo')
    expect(events).toHaveLength(2)
    expect(events[0].type).toBe('check_in')
    expect(events[0].date).toBe('2026-07-05')
    expect(events[1].type).toBe('check_out')
    expect(events[1].date).toBe('2026-07-12')
  })

  it('handles missing dates by setting dateUnclear', () => {
    const noDateFlight: TripContext = {
      ...baseFlight,
      id: 'f2',
      details: { airline: 'Air Tahiti' },
    }
    const events = expandContextToEvents(noDateFlight, null, null)
    expect(events).toHaveLength(1)
    expect(events[0].dateUnclear).toBe(true)
    expect(events[0].date).toBe('')
  })
})

describe('sortTimelineEvents', () => {
  it('sorts events chronologically, arrivals before departures on same date', () => {
    const events = [
      { id: '1', date: '2026-07-08', type: 'check_out' as const, icon: '🏨', title: '', description: '', familyName: null, familyColor: null, rawText: '', dateUnclear: false },
      { id: '2', date: '2026-07-05', type: 'arrival' as const, icon: '✈️', title: '', description: '', familyName: null, familyColor: null, rawText: '', dateUnclear: false },
      { id: '3', date: '2026-07-05', type: 'check_out' as const, icon: '🏨', title: '', description: '', familyName: null, familyColor: null, rawText: '', dateUnclear: false },
    ]
    const sorted = sortTimelineEvents(events)
    expect(sorted[0].id).toBe('2') // arrival on July 5
    expect(sorted[1].id).toBe('3') // check_out on July 5
    expect(sorted[2].id).toBe('1') // check_out on July 8
  })

  it('pushes dateUnclear events to the end', () => {
    const events = [
      { id: '1', date: '', type: 'arrival' as const, icon: '✈️', title: '', description: '', familyName: null, familyColor: null, rawText: '', dateUnclear: true },
      { id: '2', date: '2026-07-05', type: 'arrival' as const, icon: '✈️', title: '', description: '', familyName: null, familyColor: null, rawText: '', dateUnclear: false },
    ]
    const sorted = sortTimelineEvents(events)
    expect(sorted[0].id).toBe('2')
    expect(sorted[1].id).toBe('1')
  })
})

describe('computeOverlap', () => {
  it('computes overlap when two families have overlapping dates', () => {
    const familyDateRanges = [
      { familyName: "Frances' family", earliest: '2026-07-03', latest: '2026-07-08' },
      { familyName: "Mingfei's family", earliest: '2026-07-05', latest: '2026-07-12' },
    ]
    const overlap = computeOverlap(familyDateRanges)
    expect(overlap).toEqual({ start: '2026-07-05', end: '2026-07-08' })
  })

  it('returns null when there is no overlap', () => {
    const familyDateRanges = [
      { familyName: "Frances' family", earliest: '2026-07-03', latest: '2026-07-05' },
      { familyName: "Mingfei's family", earliest: '2026-07-07', latest: '2026-07-12' },
    ]
    const overlap = computeOverlap(familyDateRanges)
    expect(overlap).toBeNull()
  })

  it('handles single-day overlap', () => {
    const familyDateRanges = [
      { familyName: "Frances' family", earliest: '2026-07-03', latest: '2026-07-05' },
      { familyName: "Mingfei's family", earliest: '2026-07-05', latest: '2026-07-12' },
    ]
    const overlap = computeOverlap(familyDateRanges)
    expect(overlap).toEqual({ start: '2026-07-05', end: '2026-07-05' })
  })

  it('returns null when only one family has bookings', () => {
    const familyDateRanges = [
      { familyName: "Mingfei's family", earliest: '2026-07-05', latest: '2026-07-12' },
    ]
    const overlap = computeOverlap(familyDateRanges)
    expect(overlap).toBeNull()
  })

  it('returns null for empty input', () => {
    const overlap = computeOverlap([])
    expect(overlap).toBeNull()
  })
})

describe('formatDateHeader', () => {
  it('formats date as "Month Day (Weekday)"', () => {
    const result = formatDateHeader('2026-07-05', null)
    expect(result).toMatch(/July 5/)
    expect(result).toMatch(/\(Sun\)/)
  })

  it('accepts a timezone parameter', () => {
    const result = formatDateHeader('2026-07-05', 'Pacific/Tahiti')
    expect(result).toMatch(/July/)
  })
})
