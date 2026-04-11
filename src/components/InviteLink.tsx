'use client'

import { useState } from 'react'

const API_DOCS_URL = 'https://github.com/mingfeiyan/bunnyhop/blob/main/docs/timeline-api.md'

export default function InviteLink({ inviteCode }: { inviteCode: string }) {
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedEndpoint, setCopiedEndpoint] = useState(false)
  const [showAgent, setShowAgent] = useState(false)

  async function copyLink() {
    const url = `${window.location.origin}/invite/${inviteCode}`
    await navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  async function copyEndpoint() {
    const endpoint = `${window.location.origin}/api/trips/by-code/${inviteCode}/timeline-events`
    await navigator.clipboard.writeText(endpoint)
    setCopiedEndpoint(true)
    setTimeout(() => setCopiedEndpoint(false), 2000)
  }

  const endpoint = typeof window !== 'undefined'
    ? `${window.location.origin}/api/trips/by-code/${inviteCode}/timeline-events`
    : `/api/trips/by-code/${inviteCode}/timeline-events`

  return (
    <div>
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
        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
          <p className="text-xs text-gray-600">
            Tell your AI agent to POST confirmed bookings to this endpoint:
          </p>
          <div className="flex items-start gap-2">
            <code className="text-[11px] bg-white border rounded px-2 py-1 flex-1 break-all font-mono text-gray-800">
              {endpoint}
            </code>
            <button
              onClick={copyEndpoint}
              className="text-xs text-blue-600 hover:underline shrink-0 mt-1"
            >
              {copiedEndpoint ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-gray-600">
            Full API reference with schema and examples:{' '}
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
  )
}
