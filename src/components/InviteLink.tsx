'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import PillButton from '@/components/ui/PillButton'
import MonoLabel from '@/components/ui/MonoLabel'

const API_DOCS_URL = 'https://github.com/mingfeiyan/bunnyhop/blob/main/docs/agent-guide.md'

function buildAgentPrompt(endpoint: string): string {
  return `POST confirmed bookings (flights, hotels, Airbnbs, cruises, activities) as JSON to:
${endpoint}

Schema: { "type": "flight"|"hotel"|"airbnb"|"cruise"|"activity", "title": "short label", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "start_time": "HH:MM", "end_time": "HH:MM", "origin": "SFO", "destination": "PPT", "reference": "UA115", "details": { "address": "...", "confirmation": "..." } }

Key rules:
- Dates: YYYY-MM-DD. Times: 24-hour HH:MM. Only confirmed bookings.
- Round-trip flights = TWO entries. Always include details.address on stays.
- POST single object or array. Invite code in URL = auth, no API key needed.

To READ trip state (timeline, consensus, context, families):
GET ${endpoint.replace('/timeline-events', '/summary')}

Full docs: ${API_DOCS_URL}`
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
