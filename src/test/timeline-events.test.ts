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

  it('returns null for note/constraint entries', () => {
    const noteEntry: ParsedEntry = {
      type: 'note',
      raw_text: 'remember sunscreen',
      details: { summary: 'remember sunscreen' },
    }
    expect(parsedEntryToTimelineEvent(noteEntry)).toBeNull()
  })

  it('converts a parsed activity entry to a timeline event row', () => {
    const entry: ParsedEntry = {
      type: 'activity',
      raw_text: 'Sunset catamaran cruise Jun 28 5pm',
      details: {
        name: 'Sunset Catamaran Cruise',
        date: '2026-06-28',
        start_time: '17:00',
        end_time: '19:30',
        location: 'Vaitape Harbor',
        confirmation: 'CRUISE-789',
      },
    }
    const result = parsedEntryToTimelineEvent(entry)
    expect(result).not.toBeNull()
    expect(result?.type).toBe('activity')
    expect(result?.title).toBe('Sunset Catamaran Cruise')
    expect(result?.start_date).toBe('2026-06-28')
    expect(result?.start_time).toBe('17:00')
    expect(result?.end_time).toBe('19:30')
    expect(result?.reference).toBe('CRUISE-789')
  })

  it('returns null for activity without a valid date', () => {
    const entry: ParsedEntry = {
      type: 'activity',
      raw_text: 'Some snorkeling',
      details: { name: 'Snorkeling' },
    }
    expect(parsedEntryToTimelineEvent(entry)).toBeNull()
  })

  it('drops malformed time strings on activity', () => {
    const entry: ParsedEntry = {
      type: 'activity',
      raw_text: 'Tour at 7pm',
      details: {
        name: 'Garden Tour',
        date: '2026-06-28',
        start_time: '7pm', // not HH:MM 24h
      },
    }
    const result = parsedEntryToTimelineEvent(entry)
    expect(result).not.toBeNull()
    expect(result?.start_time).toBeNull()
  })

  it('converts a parsed airbnb entry preserving the airbnb type', () => {
    const entry: ParsedEntry = {
      type: 'airbnb',
      raw_text: 'Scenic Retreat Aug 26-30',
      details: {
        name: 'Scenic Retreat w/ River Views & Private Suite',
        address: '1631 Bellerive Ln, Coeur d\'Alene, ID 83814, USA',
        check_in: '2026-08-26',
        check_out: '2026-08-30',
      },
    }
    const result = parsedEntryToTimelineEvent(entry)
    expect(result).not.toBeNull()
    expect(result?.type).toBe('airbnb')
    expect(result?.start_date).toBe('2026-08-26')
    expect(result?.end_date).toBe('2026-08-30')
    expect(result?.title).toBe('Scenic Retreat w/ River Views & Private Suite')
    expect(result?.details.address).toBe('1631 Bellerive Ln, Coeur d\'Alene, ID 83814, USA')
  })

  it('converts a parsed cruise entry preserving the cruise type', () => {
    const entry: ParsedEntry = {
      type: 'cruise',
      raw_text: 'Disney 5-night Bahamian Nov 25-30',
      details: {
        name: 'Disney Cruise — 5-Night Very Merrytime Bahamian',
        address: 'Port Everglades, Fort Lauderdale, FL',
        check_in: '2026-11-25',
        check_out: '2026-11-30',
        cruise_line: 'Disney Cruise Line',
      },
    }
    const result = parsedEntryToTimelineEvent(entry)
    expect(result).not.toBeNull()
    expect(result?.type).toBe('cruise')
    expect(result?.start_date).toBe('2026-11-25')
    expect(result?.end_date).toBe('2026-11-30')
    expect(result?.title).toBe('Disney Cruise — 5-Night Very Merrytime Bahamian')
  })

  it('returns null for airbnb without check_in', () => {
    const entry: ParsedEntry = {
      type: 'airbnb',
      raw_text: 'A rental',
      details: { name: 'A rental' },
    }
    expect(parsedEntryToTimelineEvent(entry)).toBeNull()
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

  it('appends the address to a hotel description when present', () => {
    const hotel: TimelineEventRow = {
      ...baseEvent,
      type: 'hotel',
      title: 'Four Seasons Maui',
      start_date: '2026-05-01',
      end_date: '2026-05-05',
      start_time: null,
      end_time: null,
      origin: null,
      destination: null,
      reference: null,
      details: { address: '3900 Wailea Alanui Drive, Kihei HI 96753' },
    }
    const result = formatTimelineEventDescription(hotel)
    expect(result).toContain('4 nights')
    expect(result).toContain('3900 Wailea Alanui Drive, Kihei HI 96753')
  })

  it('formats an airbnb description like a hotel', () => {
    const airbnb: TimelineEventRow = {
      ...baseEvent,
      type: 'airbnb',
      title: 'Scenic Retreat',
      start_date: '2026-08-26',
      end_date: '2026-08-30',
      start_time: null,
      end_time: null,
      origin: null,
      destination: null,
      reference: null,
      details: { address: '1631 Bellerive Ln, Coeur d\'Alene, ID 83814, USA' },
    }
    const result = formatTimelineEventDescription(airbnb)
    expect(result).toContain('4 nights')
    expect(result).toContain('1631 Bellerive Ln')
  })

  it('formats a cruise description like a hotel', () => {
    const cruise: TimelineEventRow = {
      ...baseEvent,
      type: 'cruise',
      title: 'Disney 5-Night Bahamian',
      start_date: '2026-11-25',
      end_date: '2026-11-30',
      start_time: null,
      end_time: null,
      origin: null,
      destination: null,
      reference: null,
      details: { address: 'Port Everglades, Fort Lauderdale, FL' },
    }
    const result = formatTimelineEventDescription(cruise)
    expect(result).toContain('5 nights')
    expect(result).toContain('Port Everglades')
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
