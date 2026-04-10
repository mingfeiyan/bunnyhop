import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export type ParsedEntry = {
  type: 'flight' | 'hotel' | 'constraint' | 'note'
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
    "type": "flight" | "hotel" | "constraint" | "note",
    "raw_text": "concise human-readable summary of THIS specific item",
    "details": { ... extracted structured fields ... }
  }
]

Rules:
- Round-trip flights = TWO entries (one outbound, one return).
- Each flight: type="flight", details has airline, flight_number, departure_time, arrival_time, date (YYYY-MM-DD), origin, destination.
- Each hotel: type="hotel", details has name, address, check_in (YYYY-MM-DD), check_out (YYYY-MM-DD).
- Constraints: type="constraint", details has a description.
- Anything else: type="note", details has a "summary" field.
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
