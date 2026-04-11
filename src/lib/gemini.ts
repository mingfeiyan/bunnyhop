// Gemini image generation client. Generates one editorial-style cover image
// per trip. Called from /api/trips/[tripId]/generate-cover after trip
// creation.
//
// There are two paths to image generation on the Gemini API:
//
//   1. Imagen 3 / Imagen 4 dedicated models via the `:predict` endpoint —
//      paid tier only via Vertex AI. Free-tier API keys get 404.
//   2. Gemini multimodal generation via the `:generateContent` endpoint —
//      free-tier accessible. Default model: gemini-2.5-flash-image-preview.
//
// We use path #2 by default. Override via the GEMINI_IMAGE_MODEL env var if
// you want a different model. The endpoint is auto-detected: model names
// starting with "imagen-" use :predict, anything else uses :generateContent.

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta'
const DEFAULT_MODEL = 'gemini-2.5-flash-image-preview'

export type GeneratedImage = {
  data: Buffer
  mimeType: string
}

// Read the Gemini API key from any of the common env var names. Vercel
// templates / Google examples use a few different conventions and we don't
// want to force a rename.
function readApiKey(): string | null {
  return (
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    null
  )
}

// Build an editorial-style prompt. The mockup aesthetic is muted, restrained,
// magazine photography — so we ask for the same: golden hour, natural tones,
// negative space, no text overlays, no people in foreground.
function buildPrompt(destination: string): string {
  return [
    `Generate an editorial travel magazine photograph of ${destination}.`,
    `Muted natural tones, soft golden hour light, minimal composition with negative space.`,
    `Film-like grain, restrained earthy color palette with cream and forest green undertones.`,
    `No text, no captions, no overlays, no logos. No people in the foreground.`,
    `Cinematic landscape, wide aspect, single subject focus.`,
  ].join(' ')
}

type ImagenResponse = {
  predictions?: Array<{
    bytesBase64Encoded?: string
    mimeType?: string
  }>
}

type GenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          mimeType?: string
          data?: string
        }
      }>
    }
  }>
}

// Imagen path — uses the :predict endpoint with prompt + parameters.
async function callImagen(model: string, apiKey: string, prompt: string): Promise<GeneratedImage | null> {
  const res = await fetch(
    `${GEMINI_API}/models/${model}:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: '16:9' },
      }),
    }
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Imagen request failed: ${res.status} ${text.slice(0, 500)}`)
  }
  const json = (await res.json()) as ImagenResponse
  const prediction = json.predictions?.[0]
  if (!prediction?.bytesBase64Encoded) return null
  return {
    data: Buffer.from(prediction.bytesBase64Encoded, 'base64'),
    mimeType: prediction.mimeType ?? 'image/png',
  }
}

// Gemini multimodal path — uses the :generateContent endpoint with text part.
// Response includes the image as inlineData inside one of the parts.
async function callGeminiContent(model: string, apiKey: string, prompt: string): Promise<GeneratedImage | null> {
  const res = await fetch(
    `${GEMINI_API}/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gemini generateContent request failed: ${res.status} ${text.slice(0, 500)}`)
  }
  const json = (await res.json()) as GenerateContentResponse
  const parts = json.candidates?.[0]?.content?.parts ?? []
  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        data: Buffer.from(part.inlineData.data, 'base64'),
        mimeType: part.inlineData.mimeType ?? 'image/png',
      }
    }
  }
  return null
}

// Generate one editorial cover image for the destination. Returns null if
// the API returned no image (content filter, etc.). Throws if the API key
// is missing or the request fails outright.
export async function generateCoverImage(destination: string): Promise<GeneratedImage | null> {
  const apiKey = readApiKey()
  if (!apiKey) {
    throw new Error('No Gemini API key found (checked GOOGLE_GEMINI_API_KEY, GEMINI_API_KEY, GOOGLE_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, GOOGLE_AI_API_KEY)')
  }
  const model = process.env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL
  const prompt = buildPrompt(destination)

  // Auto-detect endpoint by model name family
  if (model.startsWith('imagen-')) {
    return callImagen(model, apiKey, prompt)
  }
  return callGeminiContent(model, apiKey, prompt)
}
