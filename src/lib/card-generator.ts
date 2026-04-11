import Anthropic from '@anthropic-ai/sdk'
import type { TripContext, TimelineEventRow } from '@/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Convert HH:MM 24-hour to a friendly 12-hour string for the prompt
function fmtTime(t: string | null): string {
  if (!t) return ''
  const m = t.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return t
  const h = Number(m[1])
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${m[2]} ${period}`
}

// Build a single-line summary of a timeline_events row for the prompt
function summarizeTimelineEvent(ev: TimelineEventRow): string {
  if (ev.type === 'flight') {
    const route = ev.origin && ev.destination ? `${ev.origin} → ${ev.destination}` : ''
    const time = ev.start_time ? ` at ${fmtTime(ev.start_time)}` : ''
    return `[flight] ${ev.start_date}${time} — ${ev.title}${route ? ` (${route})` : ''}`
  }
  if (ev.type === 'hotel') {
    const range = ev.end_date ? `${ev.start_date} → ${ev.end_date}` : ev.start_date
    const address = (ev.details?.address as string) || ''
    return `[hotel] ${range} — ${ev.title}${address ? ` (${address})` : ''}`
  }
  // activity
  const time = ev.start_time ? ` at ${fmtTime(ev.start_time)}` : ''
  return `[activity] ${ev.start_date}${time} — ${ev.title}`
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

export async function generateCards(
  destination: string,
  dateStart: string,
  dateEnd: string,
  contexts: TripContext[],
  timelineEvents: TimelineEventRow[] = [],
  existingTitles: string[] = []
): Promise<GeneratedCard[]> {
  const contextSummary = contexts
    .map(c => `[${c.type}] ${c.raw_text}`)
    .join('\n')

  const timelineSummary = timelineEvents
    .map(summarizeTimelineEvent)
    .join('\n')

  const existingList = existingTitles.length > 0
    ? `\n\nAlready suggested (do NOT duplicate): ${existingTitles.join(', ')}`
    : ''

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: `You are a travel recommendation expert. Generate 20-25 recommendations for a trip.

Destination: ${destination}
Dates: ${dateStart} to ${dateEnd}
${timelineSummary ? `\nConfirmed bookings (use these to anchor recommendations — suggest things near the hotels, schedule around flights and existing activities, and don't double-book the same time slots):\n${timelineSummary}` : ''}
${contextSummary ? `\nTraveler notes & constraints:\n${contextSummary}` : ''}
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
