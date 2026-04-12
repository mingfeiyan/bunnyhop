'use client'

import { useState, useEffect } from 'react'
import PillButton from '@/components/ui/PillButton'

type UserRow = {
  user_id: string
  email: string
  is_approved: boolean
  is_admin: boolean
}

export default function AdminCreatorList() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadUsers() {
    const res = await fetch('/api/admin/users')
    if (!res.ok) {
      setError('Failed to load users')
      setLoading(false)
      return
    }
    const data = await res.json()
    setUsers(data.users ?? [])
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsers()
  }, [])

  async function toggleApproval(userId: string, currentlyApproved: boolean) {
    setError(null)
    const action = currentlyApproved ? 'revoke' : 'approve'
    const res = await fetch('/api/admin/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, action }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to update')
      return
    }
    // Optimistic update
    setUsers(prev => prev.map(u =>
      u.user_id === userId ? { ...u, is_approved: !currentlyApproved } : u
    ))
  }

  if (loading) {
    return <p className="detail-mono">loading users…</p>
  }

  return (
    <div>
      {error && (
        <p className="detail-mono mb-3" style={{ color: 'var(--consensus-pass)' }}>
          {error}
        </p>
      )}
      <div className="border-t border-stroke">
        {users.map(u => (
          <div
            key={u.user_id}
            className="flex items-center justify-between py-3 px-1 border-b border-stroke"
          >
            <div className="min-w-0 flex-1">
              <span
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '15px',
                }}
              >
                {u.email}
              </span>
              {u.is_admin && (
                <span className="label-mono ml-2" style={{ opacity: 0.6 }}>admin</span>
              )}
            </div>
            <div className="shrink-0 ml-3">
              {u.is_admin ? (
                <span className="label-mono" style={{ opacity: 0.5 }}>always approved</span>
              ) : (
                <PillButton
                  variant={u.is_approved ? 'active' : 'default'}
                  onClick={() => toggleApproval(u.user_id, u.is_approved)}
                >
                  {u.is_approved ? 'approved' : 'approve'}
                </PillButton>
              )}
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <p className="detail-mono py-4" style={{ opacity: 0.5 }}>
            No users found. Users appear here once they sign in or join a trip.
          </p>
        )}
      </div>
    </div>
  )
}
