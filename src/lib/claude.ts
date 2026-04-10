import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function parseContext(text: string): Promise<{
  type: 'flight' | 'hotel' | 'constraint' | 'note'
  details: Record<string, unknown>
}> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Parse this travel context into structured data. Return JSON only, no markdown.

Text: "${text}"

Return format:
{
  "type": "flight" | "hotel" | "constraint" | "note",
  "details": { ... extracted structured fields ... }
}

For flights: extract airline, flight_number, departure_time, arrival_time, date (YYYY-MM-DD format), origin, destination.
For hotels: extract name, address, check_in (YYYY-MM-DD format), check_out (YYYY-MM-DD format).
For constraints: extract constraint description and who it applies to.
For anything else: type is "note", details has a "summary" field.

IMPORTANT: All dates MUST be in ISO YYYY-MM-DD format (e.g. "2026-07-05"). Times should be in HH:MM 24-hour format (e.g. "14:30").`
    }],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    return { type: 'note', details: { summary: text } }
  }

  try {
    return JSON.parse(content.text)
  } catch {
    return { type: 'note', details: { summary: text } }
  }
}
