'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import PillButton from '@/components/ui/PillButton'
import MonoLabel from '@/components/ui/MonoLabel'

const API_DOCS_URL = 'https://github.com/mingfeiyan/bunnyhop/blob/main/docs/agent-guide.md'

function buildAgentPrompt(endpoint: string): string {
  return `When you find confirmed travel bookings for my trip — flights, hotels, Airbnbs, cruises, or activities — POST them as structured JSON to:

${endpoint}

Schema (each event):
{
  "type": "flight" | "hotel" | "airbnb" | "cruise" | "activity",
  "title": "short label, e.g. 'United UA115 SFO → PPT' or 'Four Seasons Maui'",
  "start_date": "YYYY-MM-DD",            // flight: depart date | stays: check-in / embark | activity: date
  "end_date": "YYYY-MM-DD",              // optional. flight: arrival if next day | stays: check-out / debark
  "start_time": "HH:MM",                 // 24-hour, optional. flight: depart | activity: start
  "end_time": "HH:MM",                   // 24-hour, optional. flight: arrival | activity: end
  "origin": "SFO",                       // flights only, IATA code
  "destination": "PPT",                  // flights only, IATA code
  "reference": "UA115",                  // flight number or confirmation code
  "details": {                           // free-form. include the address for any stay (hotel/airbnb/cruise)
    "name": "...",                       // for stays + activities
    "address": "...",                    // for stays — used to auto-fill the trip's destination
    "host": "...",                       // airbnb / vrbo only
    "platform": "Airbnb",                // airbnb / vrbo only — exact value 'Airbnb' triggers the airbnb type
    "cruise_line": "Disney Cruise Line", // cruise only
    "confirmation": "..."
  }
}

You can POST a single object or an array of objects. Batching is faster.

Type guide:
- "flight" — any airline ticket. Round-trip flights = TWO entries (one outbound, one return).
- "hotel" — traditional hotels and resorts.
- "airbnb" — Airbnb or VRBO vacation rentals. Same shape as hotel; the type controls the timeline label.
- "cruise" — cruise bookings. start_date = embark, end_date = debark. Use the embark port as details.address so the trip destination auto-fills.
- "activity" — confirmed activity bookings (tours, dinner reservations, museum tickets) with a specific date.

Rules:
- Dates MUST be ISO YYYY-MM-DD ("2026-06-27", not "June 27 2026").
- Times MUST be 24-hour HH:MM ("13:25", not "1:25 PM").
- Only submit confirmed bookings — skip quotes, holds, waitlists.
- The invite code in the URL is the auth. No API key needed.
- Always include details.address on stays — it's how the trip's destination auto-fills.

To READ the trip state (timeline, group consensus, context, families), call:

GET ${endpoint.replace('/timeline-events', '/summary')}

This returns the full trip in one JSON response:
- trip: title, destination, dates, participants
- timeline: all confirmed bookings sorted by date
- context: notes and constraints from the group
- results: every recommendation card with its consensus (everyone_loves / mixed / hard_pass), score, and vote count
- families: who's in which family group

Use this to understand the group's preferences, see what's already booked, identify gaps in the itinerary, and plan further.

Full API reference: ${API_DOCS_URL}`
}

type Props = {
  inviteCode: string
  // Optional pills rendered before the copy/agent buttons in the editorial
  // tree, so callers can append a "edit details" affordance into the same
  // single-line action row instead of stacking it above.
  leadingButtons?: ReactNode
}

export default function InviteLink({ inviteCode, leadingButtons }: Props) {
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [showAgent, setShowAgent] = useState(false)

  async function copyLink() {
    const url = `${window.location.origin}/invite/${inviteCode}`
    await navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  async function copyAgentPrompt() {
    const endpoint = `${window.location.origin}/api/trips/by-code/${inviteCode}/timeline-events`
    await navigator.clipboard.writeText(buildAgentPrompt(endpoint))
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 2000)
  }

  const endpoint = typeof window !== 'undefined'
    ? `${window.location.origin}/api/trips/by-code/${inviteCode}/timeline-events`
    : `/api/trips/by-code/${inviteCode}/timeline-events`

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {leadingButtons}
        <PillButton onClick={copyLink}>
          {copiedLink ? 'copied' : 'invite link'}
        </PillButton>
        <PillButton onClick={() => setShowAgent(!showAgent)}>
          {showAgent ? 'hide agents' : 'for ai agents'}
        </PillButton>
      </div>

      {showAgent && (
        <div className="mt-4 border border-stroke p-4">
          <MonoLabel className="block mb-2">agent instructions</MonoLabel>
          <p className="detail-mono mb-3">
            Paste these instructions into your AI agent so it can submit confirmed bookings directly to your timeline.
          </p>

          <PillButton onClick={copyAgentPrompt}>
            {copiedPrompt ? '✓ copied' : 'copy instructions'}
          </PillButton>

          <div className="mt-4">
            <MonoLabel className="block mb-1">endpoint</MonoLabel>
            <code
              className="block break-all"
              style={{
                fontFamily: 'var(--font-mono-editorial), monospace',
                fontSize: '11px',
                padding: '6px 8px',
                border: '1px solid var(--stroke)',
                background: 'var(--stroke-soft)',
              }}
            >
              {endpoint}
            </code>
          </div>

          <p className="detail-mono mt-4">
            Full reference:{' '}
            <a
              href={API_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--stroke)', textDecoration: 'underline' }}
            >
              docs/timeline-api.md →
            </a>
          </p>
          <p className="detail-mono mt-1" style={{ opacity: 0.6 }}>
            The invite code in the URL is the auth — no API key needed. Only share with people (or agents) you trust.
          </p>
        </div>
      )}
    </>
  )
}
