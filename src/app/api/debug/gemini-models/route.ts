// One-shot debug endpoint: lists every Gemini model the configured API key
// has access to, plus which generation methods each one supports. Used to
// figure out the right model name for image generation when the docs are
// stale or the user's tier doesn't include the obvious choices.
//
// Filters to image-capable models (those that support generateContent and
// have "image" in the name, OR Imagen models that support predict).
//
// Use:
//   curl https://<host>/api/debug/gemini-models
//
// Safe to leave deployed — it only reads model metadata, never returns the
// API key or any user data.

import { NextResponse } from 'next/server'

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

type GeminiModel = {
  name: string
  displayName?: string
  description?: string
  supportedGenerationMethods?: string[]
}

export async function GET() {
  const apiKey = readApiKey()
  if (!apiKey) {
    return NextResponse.json({ error: 'No Gemini API key found' }, { status: 500 })
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`
  )
  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json(
      { error: `ListModels failed: ${res.status} ${text.slice(0, 1000)}` },
      { status: 500 }
    )
  }
  const json = await res.json()
  const models: GeminiModel[] = json.models ?? []

  // Surface anything that looks like image generation
  const imageModels = models.filter(m => {
    const name = m.name.toLowerCase()
    const methods = m.supportedGenerationMethods ?? []
    return (
      name.includes('image') ||
      name.includes('imagen') ||
      methods.includes('predict')
    )
  })

  return NextResponse.json({
    image_capable_count: imageModels.length,
    image_capable: imageModels.map(m => ({
      name: m.name,
      displayName: m.displayName,
      methods: m.supportedGenerationMethods,
    })),
    total_models: models.length,
    all_model_names: models.map(m => m.name),
  })
}
