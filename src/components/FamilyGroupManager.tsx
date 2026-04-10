'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { FamilyGroup, TripParticipant } from '@/types'

const COLOR_PALETTE = [
  { name: 'indigo', bg: 'bg-indigo-100', text: 'text-indigo-800', dot: 'bg-indigo-500', border: 'border-indigo-500' },
  { name: 'amber', bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500', border: 'border-amber-500' },
  { name: 'emerald', bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500', border: 'border-emerald-500' },
  { name: 'rose', bg: 'bg-rose-100', text: 'text-rose-800', dot: 'bg-rose-500', border: 'border-rose-500' },
  { name: 'sky', bg: 'bg-sky-100', text: 'text-sky-800', dot: 'bg-sky-500', border: 'border-sky-500' },
  { name: 'purple', bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-500', border: 'border-purple-500' },
]

export function getColorClasses(colorName: string) {
  return COLOR_PALETTE.find(c => c.name === colorName) ?? COLOR_PALETTE[0]
}

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

    const { error: insertError } = await supabase
      .from('family_groups')
      .insert({ trip_id: tripId, name: newName.trim(), color: newColor })

    if (insertError) {
      setError(insertError.message)
      return
    }
    setNewName('')
    setShowForm(false)
  }

  async function assignParticipant(participantId: string, familyGroupId: string | null) {
    const { error: updateError } = await supabase
      .from('trip_participants')
      .update({ family_group_id: familyGroupId })
      .eq('id', participantId)

    if (updateError) {
      setError(updateError.message)
      return
    }
    setLocalParticipants(prev =>
      prev.map(p => p.id === participantId ? { ...p, family_group_id: familyGroupId } : p)
    )
  }

  const grouped = groups.map(g => ({
    ...g,
    members: localParticipants.filter(p => p.family_group_id === g.id),
  }))
  const ungrouped = localParticipants.filter(p => !p.family_group_id)

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <h2 className="font-semibold text-lg mb-3">Family Groups</h2>

      {/* Existing groups */}
      <div className="space-y-3 mb-4">
        {grouped.map(g => {
          const colors = getColorClasses(g.color)
          return (
            <div key={g.id} className={`border-l-4 ${colors.border} rounded-lg p-3 bg-gray-50`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-3 h-3 rounded-full ${colors.dot}`} />
                <span className="font-medium text-sm">{g.name}</span>
              </div>
              <div className="text-xs text-gray-500">
                {g.members.length === 0
                  ? 'No members assigned'
                  : g.members.map(m => m.email ?? m.user_id.slice(0, 8)).join(', ')}
              </div>
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
  )
}
