'use client'

import { useState, useEffect } from 'react'
import { getFamilyColor } from '@/lib/colors'

type Member = {
  id: string
  display_name: string
  member_type: 'human' | 'agent'
  email: string | null
}

type Family = {
  id: string
  name: string
  color: string
  members: Member[]
}

// Read-only view of global families for the admin page. Shows each family
// with its color accent, members, and their type (human/agent). Full CRUD
// management (add family, add member, remove member) is a follow-up.
export default function AdminFamilyList() {
  const [families, setFamilies] = useState<Family[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/families')
      .then(res => res.json())
      .then(data => { setFamilies(data.families ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <p className="detail-mono">loading families…</p>
  }

  if (families.length === 0) {
    return <p className="detail-mono" style={{ opacity: 0.5 }}>No families defined yet.</p>
  }

  return (
    <div className="border-t border-stroke">
      {families.map(f => {
        const accent = getFamilyColor(f.color)
        return (
          <div
            key={f.id}
            className="py-3 px-1 border-b border-stroke"
            style={{ borderLeft: `3px solid ${accent}`, paddingLeft: '12px' }}
          >
            <span
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '16px',
                fontWeight: 400,
              }}
            >
              {f.name}
            </span>
            <div className="mt-2 space-y-1">
              {f.members.map(m => (
                <div key={m.id} className="flex items-center gap-2 detail-mono">
                  <span>{m.display_name}</span>
                  {m.member_type === 'agent' && (
                    <span className="label-mono" style={{ opacity: 0.5 }}>agent</span>
                  )}
                  {m.email && (
                    <span style={{ opacity: 0.5 }}>{m.email}</span>
                  )}
                </div>
              ))}
              {f.members.length === 0 && (
                <span className="detail-mono" style={{ opacity: 0.5 }}>no members</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
