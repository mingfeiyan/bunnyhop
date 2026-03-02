'use client'

import { useState } from 'react'

export default function InviteLink({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    const url = `${window.location.origin}/invite/${inviteCode}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button onClick={copyLink} className="text-sm text-blue-600 hover:underline">
      {copied ? 'Copied!' : 'Copy invite link'}
    </button>
  )
}
