import Anthropic from '@anthropic-ai/sdk'
import { formatTime12h } from '@/lib/timeline-events'
import type { TripContext, TimelineEventRow } from '@/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Build a single-line summary of a timeline_events row for the prompt.
// Includes location/address/raw context where available so Claude has enough
// signal to suggest nearby things and de-duplicate against confirmed activities.
function summarizeTimelineEvent(ev: TimelineEventRow): string {
  switch (ev.type) {
    case 'flight': {
      const route = ev.origin && ev.destination ? `${ev.origin} → ${ev.destination}` : ''
      const time = ev.start_time ? ` at ${formatTime12h(ev.start_time)}` : ''
      return `[flight] ${ev.start_date}${time} — ${ev.title}${route ? ` (${route})` : ''}`
    }
    case 'hotel':
    case 'airbnb':
    case 'cruise': {
      const range = ev.end_date ? `${ev.start_date} → ${ev.end_date}` : ev.start_date
      const address = (ev.details?.address as string) || ''
      return `[${ev.type}] ${range} — ${ev.title}${address ? ` (${address})` : ''}`
    }
    case 'activity': {
      const time = ev.start_time ? ` at ${formatTime12h(ev.start_time)}` : ''
      const location = (ev.details?.location as string) || ''
      const organizer = (ev.details?.organizer as string) || ''
      const extras = [location, organizer].filter(Boolean).join(', ')
      return `[activity] ${ev.start_date}${time} — ${ev.title}${extras ? ` (${extras})` : ''}`
    }
    case 'restaurant': {
      const time = ev.start_time ? ` at ${formatTime12h(ev.start_time)}` : ''
      const address = (ev.details?.address as string) || ''
      const organizer = (ev.details?.organizer as string) || ''
      const extras = [address, organizer].filter(Boolean).join(', ')
      return `[restaurant] ${ev.start_date}${time} — ${ev.title}${extras ? ` (${extras})` : ''}`
    }
    default: {
      const _exhaustive: never = ev.type
      return `[unknown:${_exhaustive}] ${ev.start_date} — ${ev.title}`
    }
  }
}

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

export type GenerateCardsOptions = {
  destination: string                // required — caller must reject null first
  dateStart: string | null           // optional; falls back to "not yet set"
  dateEnd: string | null
  contexts?: TripContext[]
  timelineEvents?: TimelineEventRow[]
  existingTitles?: string[]
  targetCount?: number               // how many cards to generate (default 20)
}

// Proportional split: ~40% restaurants, ~40% activities, ~20% sightseeing,
// with a guard that every category gets at least 1.
function categorySplit(total: number): { restaurants: number; activities: number; sightseeing: number } {
  const restaurants = Math.max(1, Math.round(total * 0.4))
  const sightseeing = Math.max(1, Math.round(total * 0.2))
  const activities = Math.max(1, total - restaurants - sightseeing)
  return { restaurants, activities, sightseeing }
}

export async function generateCards(opts: GenerateCardsOptions): Promise<GeneratedCard[]> {
  const {
    destination,
    dateStart,
    dateEnd,
    contexts = [],
    timelineEvents = [],
    existingTitles = [],
    targetCount = 20,
  } = opts
  const split = categorySplit(targetCount)

  const contextSummary = contexts
    .map(c => `[${c.type}] ${c.raw_text}`)
    .join('\n')

  const timelineSummary = timelineEvents
    .map(summarizeTimelineEvent)
    .join('\n')

  const existingList = existingTitles.length > 0
    ? `\n\nAlready suggested (do NOT duplicate): ${existingTitles.join(', ')}`
    : ''

  const datesLine = dateStart && dateEnd
    ? `${dateStart} to ${dateEnd}`
    : 'not yet set — suggest year-round options'

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: `You are a travel recommendation expert. Generate exactly ${targetCount} recommendations for a trip.

Destination: ${destination}
Dates: ${datesLine}
${timelineSummary ? `\nConfirmed bookings (use these to anchor recommendations — suggest things near the hotels, schedule around flights and existing activities, and don't double-book the same time slots):\n${timelineSummary}` : ''}
${contextSummary ? `\nTraveler notes & constraints:\n${contextSummary}` : ''}
${existingList}

Return a JSON array (no markdown, no code fences) of exactly ${targetCount} recommendations. Aim for roughly ${split.restaurants} restaurants, ${split.activities} activities, and ${split.sightseeing} sightseeing items.

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

Make taglines engaging and personality-filled. Use the trip context AND the confirmed bookings to personalize recommendations:
- If there are hotels listed, suggest restaurants and activities NEAR each hotel (mention proximity in why_this when relevant).
- If the trip spans multiple cities/islands, balance recommendations across the locations the travelers will actually visit.
- Avoid suggesting things that conflict with confirmed activity bookings (don't recommend a sunset cruise if they already have one booked).
- Honor traveler constraints strictly (e.g. "no water activities", "kid-friendly only", "vegetarian").
- Tailor the why_this field to reflect the specific group composition and preferences mentioned in the notes.`
    }],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    console.error('Claude returned non-text content:', content.type)
    return []
  }

  console.log('Claude response length:', content.text.length)
  console.log('Claude response preview:', content.text.substring(0, 200))
  console.log('Claude stop reason:', message.stop_reason)

  try {
    return JSON.parse(content.text)
  } catch (e1) {
    console.log('Direct JSON parse failed, trying regex extraction...')
    // Try to extract JSON from the response if wrapped in markdown
    const match = content.text.match(/\[[\s\S]*\]/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch (e2) {
        console.error('Regex JSON parse also failed:', e2)
        console.error('Extracted text:', match[0].substring(0, 500))
      }
    }
    console.error('Could not parse Claude response as JSON')
    return []
  }
}
