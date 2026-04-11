// Gemini Imagen client — generates one editorial-style cover image per trip.
// Called from /api/trips/[tripId]/generate-cover after trip creation.
//
// Uses Imagen 3 (imagen-3.0-generate-002) which is the dedicated image
// generation model on the Gemini API. The Imagen `:predict` endpoint takes
// a prompt + parameters and returns base64 image data. If your project uses
// a different model, override via GEMINI_IMAGE_MODEL env var.

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta'
const DEFAULT_MODEL = 'imagen-3.0-generate-002'

export type GeneratedImage = {
  data: Buffer
  mimeType: string
}

// Build an editorial-style prompt for Imagen. The mockup aesthetic is muted,
// restrained, magazine-photography — so we ask for the same: golden hour,
// natural tones, negative space, no text overlays, no people in foreground.
function buildPrompt(destination: string): string {
  return [
    `Editorial travel magazine photograph of ${destination}.`,
    `Muted natural tones, soft golden hour light, minimal composition with negative space.`,
    `Film-like grain, restrained earthy color palette with cream and forest green undertones.`,
    `No text, no captions, no overlays, no logos. No people in the foreground.`,
    `Cinematic landscape, wide aspect, single subject focus.`,
  ].join(' ')
}

// Call Imagen 3 and return the first sample as a Buffer.
// Returns null if the API returns no image (e.g. content filter).
// Throws if the API key is missing or the request fails outright.
export async function generateCoverImage(destination: string): Promise<GeneratedImage | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set')
  }
  const model = process.env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL

  const prompt = buildPrompt(destination)

  const res = await fetch(
    `${GEMINI_API}/models/${model}:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '16:9',
          // safetyFilterLevel and personGeneration are optional Imagen
          // parameters. Defaults are sensible for travel imagery.
        },
      }),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gemini Imagen request failed: ${res.status} ${text.slice(0, 500)}`)
  }

  const json = await res.json()
  const prediction = json.predictions?.[0]
  if (!prediction?.bytesBase64Encoded) {
    return null
  }

  return {
    data: Buffer.from(prediction.bytesBase64Encoded, 'base64'),
    mimeType: prediction.mimeType ?? 'image/png',
  }
}
