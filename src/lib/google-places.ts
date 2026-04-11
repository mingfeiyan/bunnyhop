export type PlaceResult = {
  photo_url: string | null
  place_id: string | null
  rating: number | null
  rating_count: number | null
}

// Hits Google Places to look up a query and returns photo + rating + place_id.
// Tries findplacefromtext first (canonical, fast); falls back to textsearch
// (more lenient, better for fuzzy/descriptive queries).
// Backwards-compatible photo-only fetch is preserved as searchPlacePhoto.
export async function searchPlace(query: string): Promise<PlaceResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return { photo_url: null, place_id: null, rating: null, rating_count: null }
  }

  // Try the precise endpoint first
  const findRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=photos,place_id,rating,user_ratings_total&key=${apiKey}`
  )
  const findData = await findRes.json()
  let place = findData.candidates?.[0]

  // Fall back to the lenient text search endpoint
  if (!place) {
    const textRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`
    )
    const textData = await textRes.json()
    place = textData.results?.[0]
  }

  if (!place) {
    return { photo_url: null, place_id: null, rating: null, rating_count: null }
  }

  const photoRef = place.photos?.[0]?.photo_reference
  return {
    photo_url: photoRef ? `/api/photos?ref=${photoRef}` : null,
    place_id: place.place_id ?? null,
    rating: typeof place.rating === 'number' ? place.rating : null,
    rating_count: typeof place.user_ratings_total === 'number' ? place.user_ratings_total : null,
  }
}

// Legacy wrapper kept for any old call sites; delegates to searchPlace.
export async function searchPlacePhoto(query: string): Promise<string | null> {
  const result = await searchPlace(query)
  return result.photo_url
}

// Fetch a single photo for a known place_id via Place Details. Cheaper and
// safer than re-running findplacefromtext (which can fuzzy-resolve to a
// different place and cause us to overwrite cached rating data).
export async function fetchPlacePhoto(placeId: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return null

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=photos&key=${apiKey}`
  )
  const data = await res.json()
  const photoRef = data.result?.photos?.[0]?.photo_reference
  return photoRef ? `/api/photos?ref=${photoRef}` : null
}
