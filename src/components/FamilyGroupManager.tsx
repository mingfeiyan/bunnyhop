'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { COLOR_PALETTE, getColorClasses, getFamilyColor } from '@/lib/colors'
import PillButton from '@/components/ui/PillButton'
import MonoLabel from '@/components/ui/MonoLabel'
import type { FamilyGroup, TripParticipant } from '@/types'

type Props = {
  tripId: string
  isOrganizer: boolean
  participants: (TripParticipant & { email?: string })[]
}

export default function FamilyGroupManager({ tripId, isOrganizer, participants }: Props) {
  const supabase = createClient()
  const [groups, setGroups] = useState<FamilyGroup[]>([])
  const [localParticipants, setLocalParticipants] = useState(participants)
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('indigo')
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    supabase
      .from('family_groups')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true })
      .then(({ data }: { data: FamilyGroup[] | null }) => { if (data) setGroups(data) })

    const channel = supabase
      .channel(`family-groups-${tripId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'family_groups',
        filter: `trip_id=eq.${tripId}`,
      }, () => {
        supabase
          .from('family_groups')
          .select('*')
          .eq('trip_id', tripId)
          .order('created_at', { ascending: true })
          .then(({ data }: { data: FamilyGroup[] | null }) => { if (data) setGroups(data) })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId])

  async function createGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setError(null)

    // .select().single() returns the inserted row so we can append it to
    // local state immediately. Without this we'd be waiting on the realtime
    // broadcast to refetch the list, which lags on the same tab.
    const { data: inserted, error: insertError } = await supabase
      .from('family_groups')
      .insert({ trip_id: tripId, name: newName.trim(), color: newColor })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      return
    }

    if (inserted) {
      // Optimistically append. The realtime refetch handler dedupes by id
      // when the broadcast eventually arrives so we don't double-add.
      const newGroup = inserted as FamilyGroup
      setGroups(prev => prev.some(g => g.id === newGroup.id) ? prev : [...prev, newGroup])
    }
    setNewName('')
    setShowForm(false)
  }

  async function assignParticipant(participantId: string, familyGroupId: string | null) {
    const { error: updateError } = await supabase
      .rpc('assign_family_group', {
        p_participant_id: participantId,
        p_family_group_id: familyGroupId,
      })

    if (updateError) {
      setError(updateError.message)
      return
    }
    setLocalParticipants(prev =>
      prev.map(p => p.id === participantId ? { ...p, family_group_id: familyGroupId } : p)
    )
  }

  async function deleteGroup(groupId: string) {
    // FK ON DELETE SET NULL handles unassigning members automatically
    const { error: deleteError } = await supabase
      .from('family_groups')
      .delete()
      .eq('id', groupId)

    if (deleteError) {
      setError(deleteError.message)
      return
    }
    // Optimistically remove from local groups state and unassign any
    // participants. The realtime refetch handler dedupes when the
    // broadcast arrives.
    setGroups(prev => prev.filter(g => g.id !== groupId))
    setLocalParticipants(prev =>
      prev.map(p => p.family_group_id === groupId ? { ...p, family_group_id: null } : p)
    )
  }

  const grouped = groups.map(g => ({
    ...g,
    members: localParticipants.filter(p => p.family_group_id === g.id),
  }))
  const ungrouped = localParticipants.filter(p => !p.family_group_id)

  return (
    <>
      {/* === Default tree === */}
      <div className="theme-default-tree">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between text-left"
          >
            <h2 className="font-semibold text-lg">Family Groups</h2>
            <span className="text-gray-400 text-sm">
              {expanded ? '▲' : '▼'} {groups.length > 0 && `${groups.length}`}
            </span>
          </button>

          {expanded && (
          <div className="mt-4">
          {/* Existing groups */}
          <div className="space-y-3 mb-4">
            {grouped.map(g => {
              const colors = getColorClasses(g.color)
              return (
                <div key={g.id} className={`border-l-4 ${colors.border} rounded-lg p-3 bg-gray-50`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${colors.dot}`} />
                      <span className="font-medium text-sm">{g.name}</span>
                    </div>
                    {isOrganizer && (
                      <button
                        onClick={() => deleteGroup(g.id)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  {g.members.length === 0 ? (
                    <p className="text-xs text-gray-500">No members assigned</p>
                  ) : (
                    <div className="space-y-1 mt-1">
                      {g.members.map(m => (
                        <div key={m.id} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">{m.email ?? m.user_id.slice(0, 8)}</span>
                          {isOrganizer && (
                            <select
                              className="border rounded px-1 py-0.5 text-xs"
                              value={g.id}
                              onChange={(e) => assignParticipant(m.id, e.target.value || null)}
                            >
                              <option value={g.id}>{g.name}</option>
                              {groups.filter(og => og.id !== g.id).map(og => (
                                <option key={og.id} value={og.id}>{og.name}</option>
                              ))}
                              <option value="">Unassign</option>
                            </select>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {groups.length === 0 && (
              <p className="text-sm text-gray-400">No family groups yet.</p>
            )}
          </div>

          {/* Ungrouped participants (organizer sees assignment dropdown) */}
          {ungrouped.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-600 mb-2">Ungrouped</h3>
              <div className="space-y-2">
                {ungrouped.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{p.email ?? p.user_id.slice(0, 8)}</span>
                    {isOrganizer && groups.length > 0 && (
                      <select
                        className="border rounded px-2 py-1 text-xs"
                        value=""
                        onChange={(e) => assignParticipant(p.id, e.target.value || null)}
                      >
                        <option value="">Assign...</option>
                        {groups.map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Create group form (organizer only) */}
          {isOrganizer && (
            <>
              {showForm ? (
                <form onSubmit={createGroup} className="space-y-3 border-t pt-3">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Mingfei's family"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    {COLOR_PALETTE.map(c => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setNewColor(c.name)}
                        className={`w-8 h-8 rounded-full ${c.dot} ${newColor === c.name ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button type="submit"
                      className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition">
                      Create
                    </button>
                    <button type="button" onClick={() => setShowForm(false)}
                      className="text-gray-500 text-sm hover:underline">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setShowForm(true)}
                  className="text-sm text-blue-600 hover:underline">
                  + Create Family Group
                </button>
              )}
            </>
          )}

          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          </div>
          )}
        </div>
      </div>

      {/* === Editorial tree === */}
      <div className="theme-editorial-tree">
        <section className="border-b border-stroke">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between text-left px-5 py-4"
            style={{ background: 'var(--stroke-soft)' }}
          >
            <div>
              <MonoLabel className="block mb-1">groups</MonoLabel>
              <span
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '18px',
                  fontWeight: 700,
                }}
              >
                Family groups
              </span>
            </div>
            <span className="label-mono">
              {groups.length > 0 && `${String(groups.length).padStart(2, '0')} · `}
              {expanded ? 'collapse' : 'expand'}
            </span>
          </button>

          {expanded && (
            <div className="px-5 py-4">
              {/* Existing groups */}
              {groups.length === 0 ? (
                <p
                  style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', fontStyle: 'italic', opacity: 0.7 }}
                  className="mb-4"
                >
                  No family groups yet.
                </p>
              ) : (
                <div className="mb-4">
                  {grouped.map(g => {
                    const accent = getFamilyColor(g.color)
                    return (
                      <div
                        key={g.id}
                        className="py-3 border-b border-stroke last:border-b-0"
                        style={{ borderLeft: `3px solid ${accent}`, paddingLeft: '12px' }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span
                            style={{
                              fontFamily: 'var(--font-serif)',
                              fontSize: '16px',
                              fontWeight: 400,
                            }}
                          >
                            {g.name}
                          </span>
                          {isOrganizer && (
                            <button
                              type="button"
                              onClick={() => deleteGroup(g.id)}
                              className="label-mono"
                              style={{ color: 'var(--stroke)', opacity: 0.5, background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                              del
                            </button>
                          )}
                        </div>
                        {g.members.length === 0 ? (
                          <span className="label-mono" style={{ opacity: 0.5 }}>no members</span>
                        ) : (
                          <div className="space-y-1">
                            {g.members.map(m => (
                              <div key={m.id} className="flex items-center justify-between detail-mono">
                                <span>{m.email ?? m.user_id.slice(0, 8)}</span>
                                {isOrganizer && (
                                  <select
                                    value={g.id}
                                    onChange={(e) => assignParticipant(m.id, e.target.value || null)}
                                    style={{
                                      fontFamily: 'var(--font-mono-editorial), monospace',
                                      fontSize: '11px',
                                      border: '1px solid var(--stroke)',
                                      background: 'transparent',
                                      padding: '2px 6px',
                                      color: 'var(--stroke)',
                                    }}
                                  >
                                    <option value={g.id}>{g.name}</option>
                                    {groups.filter(og => og.id !== g.id).map(og => (
                                      <option key={og.id} value={og.id}>{og.name}</option>
                                    ))}
                                    <option value="">unassign</option>
                                  </select>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Ungrouped participants */}
              {ungrouped.length > 0 && (
                <div className="mb-4">
                  <MonoLabel className="block mb-2">ungrouped</MonoLabel>
                  <div className="space-y-2">
                    {ungrouped.map(p => (
                      <div key={p.id} className="flex items-center justify-between detail-mono">
                        <span>{p.email ?? p.user_id.slice(0, 8)}</span>
                        {isOrganizer && groups.length > 0 && (
                          <select
                            value=""
                            onChange={(e) => assignParticipant(p.id, e.target.value || null)}
                            style={{
                              fontFamily: 'var(--font-mono-editorial), monospace',
                              fontSize: '11px',
                              border: '1px solid var(--stroke)',
                              background: 'transparent',
                              padding: '2px 6px',
                              color: 'var(--stroke)',
                            }}
                          >
                            <option value="">assign…</option>
                            {groups.map(g => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Create group form (organizer only) */}
              {isOrganizer && (
                <>
                  {showForm ? (
                    <form onSubmit={createGroup} className="border-t border-stroke pt-4 mt-2">
                      <MonoLabel className="block mb-2">new group</MonoLabel>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g. Mingfei's family"
                        style={{
                          width: '100%',
                          fontFamily: 'var(--font-serif)',
                          fontSize: '15px',
                          border: 'none',
                          borderBottom: '1px solid var(--stroke)',
                          padding: '6px 0',
                          background: 'transparent',
                          color: 'var(--stroke)',
                          outline: 'none',
                        }}
                      />
                      <MonoLabel className="block mt-3 mb-2">color</MonoLabel>
                      <div className="flex gap-2 mb-3">
                        {COLOR_PALETTE.map(c => {
                          const hex = getFamilyColor(c.name)
                          const selected = newColor === c.name
                          return (
                            <button
                              key={c.name}
                              type="button"
                              onClick={() => setNewColor(c.name)}
                              style={{
                                width: '28px',
                                height: '28px',
                                background: hex,
                                border: selected ? '2px solid var(--stroke)' : '1px solid var(--stroke)',
                                cursor: 'pointer',
                                outline: 'none',
                              }}
                              aria-label={c.name}
                            />
                          )
                        })}
                      </div>
                      <div className="flex gap-2">
                        <PillButton type="submit">create</PillButton>
                        <PillButton type="button" onClick={() => setShowForm(false)}>cancel</PillButton>
                      </div>
                    </form>
                  ) : (
                    <PillButton onClick={() => setShowForm(true)}>+ create family group</PillButton>
                  )}
                </>
              )}

              {error && (
                <p className="detail-mono mt-3" style={{ color: 'var(--consensus-pass)' }}>
                  {error}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
