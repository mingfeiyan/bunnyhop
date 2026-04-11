export type PlaceResult = {
  photo_url: string | null
  place_id: string | null
  rating: number | null
  rating_count: number | null
}

// Hits Google Places "Find Place from Text" once and returns photo + rating + place_id.
// Backwards-compatible photo-only fetch is preserved as searchPlacePhoto.
export async function searchPlace(query: string): Promise<PlaceResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return { photo_url: null, place_id: null, rating: null, rating_count: null }
  }

  const searchRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=photos,place_id,rating,user_ratings_total&key=${apiKey}`
  )
  const searchData = await searchRes.json()

  const place = searchData.candidates?.[0]
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
