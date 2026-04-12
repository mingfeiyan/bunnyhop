import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export type ParsedEntry = {
  type: 'flight' | 'hotel' | 'activity' | 'airbnb' | 'cruise' | 'constraint' | 'note'
  raw_text: string
  details: Record<string, unknown>
}

export async function parseContext(text: string): Promise<ParsedEntry[]> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `Parse this travel context into a JSON array of structured entries. Return JSON only, no markdown, no code fences.

Text: """
${text}
"""

The input may contain ONE booking or MANY mixed together. Identify each distinct item and return one entry per item.

Return format (always an array, even for a single item):
[
  {
    "type": "flight" | "hotel" | "airbnb" | "cruise" | "activity" | "constraint" | "note",
    "raw_text": "concise human-readable summary of THIS specific item",
    "details": { ... extracted structured fields ... }
  }
]

Rules:
- Round-trip flights = TWO entries (one outbound, one return).
- Each flight: type="flight", details has airline, flight_number, departure_time, arrival_time, date (YYYY-MM-DD), origin, destination.
- Each HOTEL or RESORT booking: type="hotel", details has name, address, check_in (YYYY-MM-DD), check_out (YYYY-MM-DD).
- Each AIRBNB / VRBO / vacation rental booking: type="airbnb", same details shape as hotel (name, address, check_in, check_out). Detect by sender (airbnb.com, vrbo.com), the word "Airbnb" or "VRBO" in the body, or phrases like "your host" / "the listing" / "vacation rental".
- Each CRUISE booking: type="cruise", details has name (the cruise itinerary or ship name, e.g. "Disney Cruise — 5-Night Bahamian"), address (the embark port, e.g. "Port Everglades, Fort Lauderdale, FL"), check_in (embark date), check_out (debark date), and any additional cruise_line / ship_name / itinerary fields you can extract.
- Each CONFIRMED activity booking (e.g. scheduled tour, dinner reservation, spa appointment, museum tickets with a date — anything that has been booked and has a specific date): type="activity", details has name, date (YYYY-MM-DD), start_time, end_time, location, organizer, confirmation. ONLY use "activity" if the booking is real and has a date — not for vague wishes like "we want to go snorkeling".
- Constraints/preferences/wishes/general info that aren't bookings: type="constraint" if it's a rule/limitation (e.g. "no water activities", "kid is afraid of heights", "vegetarian"), or type="note" for everything else (e.g. "traveling with husband and 2 kids"). Both have details with a "summary" or "description" field.
- The "raw_text" field should be a SHORT summary of just THIS item (e.g. "United UA115 SFO→PPT, Jun 27 2026"), not the full input.
- Only include items that look like real bookings or trip facts. Skip generic notes like "suggestions welcome".

IMPORTANT: All dates MUST be in ISO YYYY-MM-DD format (e.g. "2026-07-05"). Times in HH:MM 24-hour format (e.g. "14:30").`
    }],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    return [{ type: 'note', raw_text: text, details: { summary: text } }]
  }

  const fallback: ParsedEntry[] = [{ type: 'note', raw_text: text, details: { summary: text } }]

  try {
    const parsed = JSON.parse(content.text)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
    return fallback
  } catch {
    // Try to extract JSON array from response
    const match = content.text.match(/\[[\s\S]*\]/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      } catch {
        // fall through
      }
    }
    return fallback
  }
}
