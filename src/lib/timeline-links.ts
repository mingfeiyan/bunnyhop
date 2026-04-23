export const VALID_EVENT_TYPES = new Set([
  'flight',
  'hotel',
  'activity',
  'airbnb',
  'cruise',
  'restaurant',
])

export const VALID_STATUSES = new Set(['planned', 'visited', 'skipped'])

type CardLike = {
  id: string
  metadata: { google_place_id?: string } | null
}

/**
 * Resolve a google_place_id to a card id in the trip. Returns null if
 * zero or multiple cards match — we never guess.
 */
export function matchCardByPlaceId(
  cards: CardLike[],
  placeId: string,
): string | null {
  if (!placeId) return null
  const matches = cards.filter(c => c.metadata?.google_place_id === placeId)
  if (matches.length !== 1) return null
  return matches[0].id
}
