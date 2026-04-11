'use client'

import { useState } from 'react'
import PillButton from '@/components/ui/PillButton'
import MonoLabel from '@/components/ui/MonoLabel'

const API_DOCS_URL = 'https://github.com/mingfeiyan/bunnyhop/blob/main/docs/timeline-api.md'

function buildAgentPrompt(endpoint: string): string {
  return `When you find confirmed flight or hotel bookings for my trip, POST them as structured JSON to:

${endpoint}

Schema (each event):
{
  "type": "flight" | "hotel",
  "title": "short label, e.g. 'United UA115 SFO → PPT'",
  "start_date": "YYYY-MM-DD",            // flight: depart date | hotel: check-in
  "end_date": "YYYY-MM-DD",              // optional. flight: arrival if next day | hotel: check-out
  "start_time": "HH:MM",                 // 24-hour, optional. flight: depart | hotel: check-in
  "end_time": "HH:MM",                   // 24-hour, optional. flight: arrival | hotel: check-out
  "origin": "SFO",                       // flights only, IATA code
  "destination": "PPT",                  // flights only, IATA code
  "reference": "UA115",                  // flight number or confirmation code
  "details": { "any extra context": "seats, fare, confirmation, address" }
}

You can POST a single object or an array of objects. Batching is faster.

Rules:
- Dates MUST be ISO YYYY-MM-DD ("2026-06-27", not "June 27 2026").
- Times MUST be 24-hour HH:MM ("13:25", not "1:25 PM").
- Round-trip flights = TWO entries (one outbound, one return).
- Only submit confirmed bookings — skip quotes, holds, waitlists.
- The invite code in the URL is the auth. No API key needed.

Full API reference: ${API_DOCS_URL}`
}

export default function InviteLink({ inviteCode }: { inviteCode: string }) {
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
      {/* === Default tree === */}
      <div className="theme-default-tree">
        <div className="flex items-center gap-3 text-sm">
          <button onClick={copyLink} className="text-blue-600 hover:underline">
            {copiedLink ? 'Copied!' : 'Copy invite link'}
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={() => setShowAgent(!showAgent)}
            className="text-blue-600 hover:underline"
          >
            {showAgent ? 'Hide' : 'For AI agents'}
          </button>
        </div>

        {showAgent && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
            <p className="text-xs text-gray-600">
              Paste these instructions into your AI agent so it can submit confirmed bookings directly to your timeline:
            </p>

            <button
              onClick={copyAgentPrompt}
              className="w-full bg-blue-600 text-white text-xs font-medium px-3 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              {copiedPrompt ? '✓ Copied agent instructions' : 'Copy agent instructions'}
            </button>

            <details className="text-[11px] text-gray-500">
              <summary className="cursor-pointer hover:text-gray-700">Just the endpoint URL</summary>
              <code className="block mt-1 bg-white border rounded px-2 py-1 break-all font-mono text-gray-800">
                {endpoint}
              </code>
            </details>

            <p className="text-xs text-gray-600">
              Full reference:{' '}
              <a
                href={API_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                docs/timeline-api.md →
              </a>
            </p>
            <p className="text-[11px] text-gray-400">
              The invite code in the URL is the auth — no API key needed. Only share with people (or agents) you trust.
            </p>
          </div>
        )}
      </div>

      {/* === Editorial tree === */}
      <div className="theme-editorial-tree">
        <div className="flex items-center gap-2">
          <PillButton onClick={copyLink}>
            {copiedLink ? 'copied' : 'copy invite link'}
          </PillButton>
          <PillButton onClick={() => setShowAgent(!showAgent)}>
            {showAgent ? 'hide agent setup' : 'for ai agents'}
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
      </div>
    </>
  )
}
