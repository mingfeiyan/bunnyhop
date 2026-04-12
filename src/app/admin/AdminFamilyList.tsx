'use client'

import { useState, useEffect } from 'react'
import { getFamilyColor, FAMILY_COLORS } from '@/lib/colors'
import PillButton from '@/components/ui/PillButton'
import MonoLabel from '@/components/ui/MonoLabel'
import { EditorialInput, EditorialSelect } from '@/components/ui/EditorialInput'

type Member = {
  id: string
  display_name: string
  member_type: 'human' | 'agent'
  email: string | null
  user_id: string | null
}

type Family = {
  id: string
  name: string
  color: string
  members: Member[]
}

type KnownUser = {
  user_id: string
  email: string
}

export default function AdminFamilyList() {
  const [families, setFamilies] = useState<Family[]>([])
  const [knownUsers, setKnownUsers] = useState<KnownUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create family form state
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('indigo')

  // Add member form state (which family, which user or agent)
  const [addingTo, setAddingTo] = useState<string | null>(null) // family_id
  const [memberName, setMemberName] = useState('')
  const [memberType, setMemberType] = useState<'human' | 'agent'>('human')
  const [memberUserId, setMemberUserId] = useState('')

  async function loadData() {
    setError(null)
    const [familiesRes, usersRes] = await Promise.all([
      fetch('/api/admin/families'),
      fetch('/api/admin/users'),
    ])
    if (familiesRes.ok) {
      const data = await familiesRes.json()
      setFamilies(data.families ?? [])
    }
    if (usersRes.ok) {
      const data = await usersRes.json()
      setKnownUsers((data.users ?? []).map((u: { user_id: string; email: string }) => ({
        user_id: u.user_id,
        email: u.email,
      })))
    }
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [])

  async function callManage(body: Record<string, unknown>) {
    setError(null)
    const res = await fetch('/api/admin/families/manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed')
      return false
    }
    return true
  }

  async function createFamily() {
    if (!newName.trim()) return
    if (await callManage({ action: 'create', name: newName, color: newColor })) {
      setNewName('')
      setNewColor('indigo')
      setShowCreate(false)
      loadData()
    }
  }

  async function deleteFamily(familyId: string) {
    if (await callManage({ action: 'delete', family_id: familyId })) {
      loadData()
    }
  }

  async function addMember(familyId: string) {
    if (!memberName.trim()) return
    const body: Record<string, unknown> = {
      action: 'add_member',
      family_id: familyId,
      display_name: memberName,
      member_type: memberType,
    }
    if (memberType === 'human' && memberUserId) {
      body.user_id = memberUserId
    }
    if (memberType === 'agent' && memberName) {
      body.agent_identifier = memberName.trim()
    }
    if (await callManage(body)) {
      setMemberName('')
      setMemberType('human')
      setMemberUserId('')
      setAddingTo(null)
      loadData()
    }
  }

  async function removeMember(memberId: string) {
    if (await callManage({ action: 'remove_member', member_id: memberId })) {
      loadData()
    }
  }

  if (loading) {
    return <p className="detail-mono">loading families…</p>
  }

  const colorNames = Object.keys(FAMILY_COLORS) as Array<keyof typeof FAMILY_COLORS>

  return (
    <div>
      {error && (
        <p className="detail-mono mb-3" style={{ color: 'var(--consensus-pass)' }}>{error}</p>
      )}

      {/* Existing families */}
      <div className="border-t border-stroke">
        {families.map(f => {
          const accent = getFamilyColor(f.color)
          return (
            <div
              key={f.id}
              className="py-4 px-1 border-b border-stroke"
              style={{ borderLeft: `5px solid ${accent}`, paddingLeft: '12px' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '18px',
                    fontWeight: 400,
                  }}
                >
                  {f.name}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAddingTo(addingTo === f.id ? null : f.id)}
                    className="label-mono"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--stroke)' }}
                  >
                    {addingTo === f.id ? 'cancel' : '+ member'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteFamily(f.id)}
                    className="label-mono"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--stroke)', opacity: 0.5 }}
                  >
                    del
                  </button>
                </div>
              </div>

              {/* Members */}
              <div className="space-y-1 mb-2">
                {f.members.map(m => (
                  <div key={m.id} className="flex items-center justify-between detail-mono">
                    <span>
                      {m.display_name}
                      {m.member_type === 'agent' && (
                        <span className="label-mono ml-1" style={{ opacity: 0.5 }}>agent</span>
                      )}
                      {m.email && (
                        <span style={{ opacity: 0.5 }}> · {m.email}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeMember(m.id)}
                      className="label-mono"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--stroke)', opacity: 0.4 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {f.members.length === 0 && (
                  <span className="detail-mono" style={{ opacity: 0.5 }}>no members</span>
                )}
              </div>

              {/* Add member form (inline, toggled per family) */}
              {addingTo === f.id && (
                <div className="mt-3 pt-3 border-t border-stroke">
                  <MonoLabel className="block mb-2">add a member</MonoLabel>
                  <EditorialInput
                    label="display name"
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    placeholder="e.g. Ryan"
                    fontSize={15}
                    containerClassName="mb-3"
                  />
                  <EditorialSelect
                    label="type"
                    value={memberType}
                    onChange={(e) => setMemberType(e.target.value as 'human' | 'agent')}
                    containerClassName="mb-3"
                  >
                    <option value="human">human</option>
                    <option value="agent">agent</option>
                  </EditorialSelect>
                  {memberType === 'human' && (
                    <EditorialSelect
                      label="link to account (optional)"
                      value={memberUserId}
                      onChange={(e) => setMemberUserId(e.target.value)}
                      containerClassName="mb-3"
                    >
                      <option value="">not linked</option>
                      {knownUsers.map(u => (
                        <option key={u.user_id} value={u.user_id}>{u.email}</option>
                      ))}
                    </EditorialSelect>
                  )}
                  <PillButton onClick={() => addMember(f.id)}>add member</PillButton>
                </div>
              )}
            </div>
          )
        })}
        {families.length === 0 && (
          <p className="detail-mono py-4" style={{ opacity: 0.5 }}>No families yet.</p>
        )}
      </div>

      {/* Create family form */}
      {showCreate ? (
        <div className="mt-4 pt-4 border-t border-stroke">
          <MonoLabel className="block mb-3">new family</MonoLabel>
          <EditorialInput
            label="family name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Smith Family"
            fontSize={15}
            containerClassName="mb-3"
          />
          <MonoLabel className="block mb-2">color</MonoLabel>
          <div className="flex gap-2 mb-4">
            {colorNames.map(c => {
              const hex = getFamilyColor(c)
              const selected = newColor === c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  style={{
                    width: '28px',
                    height: '28px',
                    background: hex,
                    border: selected ? '2px solid var(--stroke)' : '1px solid var(--stroke)',
                    cursor: 'pointer',
                  }}
                  aria-label={c}
                />
              )
            })}
          </div>
          <div className="flex gap-2">
            <PillButton onClick={createFamily}>create family</PillButton>
            <PillButton onClick={() => setShowCreate(false)}>cancel</PillButton>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <PillButton onClick={() => setShowCreate(true)}>+ create family</PillButton>
        </div>
      )}
    </div>
  )
}
