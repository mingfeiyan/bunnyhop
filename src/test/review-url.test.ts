import { describe, it, expect } from 'vitest'
import { getReviewUrl } from '@/lib/review-url'
import type { Card } from '@/types'

const baseCard: Card = {
  id: 'c1',
  trip_id: 't1',
  title: 'Test Place',
  tagline: null,
  description: null,
  category: 'restaurant',
  source: 'ai_generated',
  image_url: null,
  metadata: {},
  added_by: null,
  created_at: '2026-04-11T00:00:00Z',
}

describe('getReviewUrl', () => {
  it('returns Google Maps deep link for a restaurant with a place_id', () => {
    const card: Card = {
      ...baseCard,
      category: 'restaurant',
      metadata: { google_place_id: 'ChIJabc123' },
    }
    const url = getReviewUrl(card, 'Bora Bora')
    expect(url).toBe('https://www.google.com/maps/place/?q=place_id:ChIJabc123')
  })

  it('falls back to TripAdvisor search for a restaurant with no place_id', () => {
    const card: Card = {
      ...baseCard,
      category: 'restaurant',
      title: 'Lagoon Restaurant',
      metadata: {},
    }
    const url = getReviewUrl(card, 'Bora Bora')
    expect(url).toBe('https://www.tripadvisor.com/Search?q=Lagoon%20Restaurant%20Bora%20Bora')
  })

  it('returns a TripAdvisor search link for an activity', () => {
    const card: Card = {
      ...baseCard,
      category: 'activity',
      title: 'Shark & Ray Snorkel Tour',
    }
    const url = getReviewUrl(card, 'Bora Bora')
    expect(url).toBe('https://www.tripadvisor.com/Search?q=Shark%20%26%20Ray%20Snorkel%20Tour%20Bora%20Bora')
  })

  it('returns a TripAdvisor search link for sightseeing', () => {
    const card: Card = {
      ...baseCard,
      category: 'sightseeing',
      title: 'Mount Otemanu',
    }
    const url = getReviewUrl(card, 'Bora Bora')
    expect(url).toBe('https://www.tripadvisor.com/Search?q=Mount%20Otemanu%20Bora%20Bora')
  })

  it('URL-encodes special characters in title and destination', () => {
    const card: Card = {
      ...baseCard,
      category: 'sightseeing',
      title: "Bloody Mary's",
    }
    const url = getReviewUrl(card, 'Bora Bora, French Polynesia')
    expect(url).toContain('Bloody%20Mary')
    expect(url).toContain('French%20Polynesia')
  })
})
