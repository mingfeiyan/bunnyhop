import { describe, it, expect } from 'vitest'
import {
  VALID_EVENT_TYPES,
  VALID_STATUSES,
  matchCardByPlaceId,
} from '@/lib/timeline-links'

type TestCard = {
  id: string
  trip_id: string
  metadata: { google_place_id?: string } | null
}

describe('VALID_EVENT_TYPES', () => {
  it('includes restaurant', () => {
    expect(VALID_EVENT_TYPES.has('restaurant')).toBe(true)
  })
  it('still includes legacy types', () => {
    ['flight', 'hotel', 'activity', 'airbnb', 'cruise'].forEach(t =>
      expect(VALID_EVENT_TYPES.has(t)).toBe(true),
    )
  })
})

describe('VALID_STATUSES', () => {
  it('lists planned, visited, skipped', () => {
    expect([...VALID_STATUSES].sort()).toEqual(['planned', 'skipped', 'visited'])
  })
})

describe('matchCardByPlaceId', () => {
  const cards: TestCard[] = [
    { id: 'c1', trip_id: 't1', metadata: { google_place_id: 'abc' } },
    { id: 'c2', trip_id: 't1', metadata: { google_place_id: 'def' } },
    { id: 'c3', trip_id: 't1', metadata: { google_place_id: 'abc' } }, // duplicate
    { id: 'c4', trip_id: 't1', metadata: null },
  ]

  it('returns the card id on a single match', () => {
    expect(matchCardByPlaceId(cards, 'def')).toBe('c2')
  })

  it('returns null on zero matches', () => {
    expect(matchCardByPlaceId(cards, 'ghi')).toBeNull()
  })

  it('returns null on multiple matches (never guess)', () => {
    expect(matchCardByPlaceId(cards, 'abc')).toBeNull()
  })

  it('ignores cards with null metadata', () => {
    expect(matchCardByPlaceId(cards, '')).toBeNull()
  })
})
