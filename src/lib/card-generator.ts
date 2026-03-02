import Anthropic from '@anthropic-ai/sdk'
import type { TripContext } from '@/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

type GeneratedCard = {
  title: string
  tagline: string
  description: string
  category: 'restaurant' | 'activity' | 'sightseeing'
  metadata: {
    price_range?: string
    hours?: string
    address?: string
    duration?: string
    kid_friendly?: boolean
    booking_required?: boolean
    rating?: number
    why_this?: string
    photo_search_query?: string
  }
}

export async function generateCards(
  destination: string,
  dateStart: string,
  dateEnd: string,
  contexts: TripContext[],
  existingTitles: string[] = []
): Promise<GeneratedCard[]> {
  const contextSummary = contexts
    .map(c => `[${c.type}] ${c.raw_text}`)
    .join('\n')

  const existingList = existingTitles.length > 0
    ? `\n\nAlready suggested (do NOT duplicate): ${existingTitles.join(', ')}`
    : ''

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `You are a travel recommendation expert. Generate 20-25 recommendations for a trip.

Destination: ${destination}
Dates: ${dateStart} to ${dateEnd}
${contextSummary ? `\nTrip context:\n${contextSummary}` : ''}
${existingList}

Return a JSON array (no markdown, no code fences) of recommendations. Mix of restaurants (8-10), activities (8-10), and sightseeing (4-6).

Each item:
{
  "title": "Place name",
  "tagline": "One punchy, fun sentence — magazine style, not Yelp",
  "description": "2-3 sentences about the experience. What makes it special.",
  "category": "restaurant" | "activity" | "sightseeing",
  "metadata": {
    "price_range": "$" | "$$" | "$$$" | "$$$$",
    "duration": "e.g. 2 hours",
    "kid_friendly": true/false,
    "booking_required": true/false,
    "why_this": "1-2 sentences about why this is a great fit for THIS specific group based on their context",
    "photo_search_query": "specific Google Places search query to find a good photo of this place"
  }
}

Make taglines engaging and personality-filled. Use the trip context to personalize recommendations.`
    }],
  })

  const content = message.content[0]
  if (content.type !== 'text') return []

  try {
    return JSON.parse(content.text)
  } catch {
    // Try to extract JSON from the response if wrapped in markdown
    const match = content.text.match(/\[[\s\S]*\]/)
    if (match) return JSON.parse(match[0])
    return []
  }
}
