'use client'

import { useState } from 'react'

type Props = {
  inviteCode: string
  // What to copy: the full /invite/<code> URL (default) or the raw code.
  mode?: 'link' | 'code'
  label?: string
}

export default function CopyInviteButton({ inviteCode, mode = 'link', label }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const text = mode === 'link'
      ? `${window.location.origin}/invite/${inviteCode}`
      : inviteCode
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="label-mono"
      style={{
        background: 'none',
        border: '1px solid var(--stroke)',
        borderRadius: '999px',
        padding: '2px 10px',
        cursor: 'pointer',
        color: 'var(--ink)',
        fontSize: '11px',
      }}
    >
      {copied ? 'copied' : (label ?? (mode === 'link' ? 'copy link' : 'copy code'))}
    </button>
  )
}
