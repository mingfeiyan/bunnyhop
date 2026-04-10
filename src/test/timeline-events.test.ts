import { describe, it, expect } from 'vitest'
import { parsedEntryToTimelineEvent, formatTimelineEventDescription } from '@/lib/timeline-events'
import type { ParsedEntry } from '@/lib/claude'
import type { TimelineEventRow } from '@/types'

describe('parsedEntryToTimelineEvent', () => {
  it('converts a parsed flight entry to a timeline event row', () => {
    const entry: ParsedEntry = {
      type: 'flight',
      raw_text: 'United UA115 SFO→PPT June 27',
      details: {
        airline: 'United',
        flight_number: 'UA115',
        date: '2026-06-27',
        origin: 'SFO',
        destination: 'PPT',
        departure_time: '13:25',
        arrival_time: '21:30',
      },
    }
    const result = parsedEntryToTimelineEvent(entry)
    expect(result).not.toBeNull()
    expect(result?.type).toBe('flight')
    expect(result?.start_date).toBe('2026-06-27')
    expect(result?.start_time).toBe('13:25')
    expect(result?.end_time).toBe('21:30')
    expect(result?.origin).toBe('SFO')
    expect(result?.destination).toBe('PPT')
    expect(result?.reference).toBe('UA115')
    expect(result?.title).toBe('United UA115 SFO → PPT')
  })

  it('converts a parsed hotel entry to a timeline event row', () => {
    const entry: ParsedEntry = {
      type: 'hotel',
      raw_text: 'Conrad Bora Bora June 28 - July 4',
      details: {
        name: 'Conrad Bora Bora',
        check_in: '2026-06-28',
        check_out: '2026-07-04',
      },
    }
    const result = parsedEntryToTimelineEvent(entry)
    expect(result).not.toBeNull()
    expect(result?.type).toBe('hotel')
    expect(result?.start_date).toBe('2026-06-28')
    expect(result?.end_date).toBe('2026-07-04')
    expect(result?.title).toBe('Conrad Bora Bora')
  })

  it('returns null for flight without a valid date', () => {
    const entry: ParsedEntry = {
      type: 'flight',
      raw_text: 'United flight',
      details: { airline: 'United' },
    }
    expect(parsedEntryToTimelineEvent(entry)).toBeNull()
  })

  it('returns null for hotel without check_in', () => {
    const entry: ParsedEntry = {
      type: 'hotel',
      raw_text: 'A hotel',
      details: { name: 'Some Hotel' },
    }
    expect(parsedEntryToTimelineEvent(entry)).toBeNull()
  })

  it('returns null for non-flight non-hotel entries', () => {
    const noteEntry: ParsedEntry = {
      type: 'note',
      raw_text: 'remember sunscreen',
      details: { summary: 'remember sunscreen' },
    }
    expect(parsedEntryToTimelineEvent(noteEntry)).toBeNull()
  })
})

describe('formatTimelineEventDescription', () => {
  const baseEvent: TimelineEventRow = {
    id: '1',
    trip_id: 't1',
    type: 'flight',
    title: 'United UA115 SFO → PPT',
    start_date: '2026-06-27',
    end_date: null,
    start_time: '13:25',
    end_time: '21:30',
    origin: 'SFO',
    destination: 'PPT',
    reference: 'UA115',
    details: {},
    added_by: 'u1',
    source: 'manual',
    created_at: '2026-01-01T00:00:00Z',
  }

  it('formats flight description with route and 12-hour times', () => {
    const result = formatTimelineEventDescription(baseEvent)
    expect(result).toContain('SFO → PPT')
    expect(result).toContain('depart 1:25 PM')
    expect(result).toContain('arrive 9:30 PM')
    expect(result).toContain('UA115')
  })

  it('formats hotel description with nights count', () => {
    const hotel: TimelineEventRow = {
      ...baseEvent,
      type: 'hotel',
      title: 'Conrad Bora Bora',
      start_date: '2026-06-28',
      end_date: '2026-07-04',
      start_time: null,
      end_time: null,
      origin: null,
      destination: null,
      reference: null,
    }
    const result = formatTimelineEventDescription(hotel)
    expect(result).toContain('6 nights')
    expect(result).toContain('check-out 2026-07-04')
  })

  it('handles flight with no times', () => {
    const noTime: TimelineEventRow = {
      ...baseEvent,
      start_time: null,
      end_time: null,
    }
    const result = formatTimelineEventDescription(noTime)
    expect(result).toContain('SFO → PPT')
    expect(result).not.toContain('depart')
  })
})
