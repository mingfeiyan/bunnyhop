export async function searchPlacePhoto(query: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return null

  const searchRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=photos,place_id&key=${apiKey}`
  )
  const searchData = await searchRes.json()

  const place = searchData.candidates?.[0]
  if (!place?.photos?.[0]?.photo_reference) return null

  return `/api/photos?ref=${place.photos[0].photo_reference}`
}