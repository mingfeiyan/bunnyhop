import type { Card } from '@/types'

// Returns the URL of the canonical review/photo page for a card.
//   restaurant + place_id  -> Google Maps deep link (canonical)
//   anything else          -> TripAdvisor search results
export function getReviewUrl(card: Card, destination: string): string {
  if (card.category === 'restaurant' && card.metadata.google_place_id) {
    return `https://www.google.com/maps/place/?q=place_id:${card.metadata.google_place_id}`
  }
  const query = encodeURIComponent(`${card.title} ${destination}`)
  return `https://www.tripadvisor.com/Search?q=${query}`
}
