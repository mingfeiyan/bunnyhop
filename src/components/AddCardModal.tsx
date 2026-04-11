'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PillButton from '@/components/ui/PillButton'
import MonoLabel from '@/components/ui/MonoLabel'

type Props = {
  tripId: string
  onClose: () => void
  onAdded: () => void
}

export default function AddCardModal({ tripId, onClose, onAdded }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('cards').insert({
      trip_id: tripId,
      title: form.get('title') as string,
      tagline: form.get('tagline') as string || null,
      description: form.get('description') as string || null,
      category: form.get('category') as string,
      source: 'user_added',
      metadata: {},
      added_by: user.id,
    })

    setLoading(false)
    onAdded()
    onClose()
  }

  return (
    <>
      {/* === Default tree === */}
      <div className="theme-default-tree">
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-xl font-bold">Add a Recommendation</h2>

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input id="title" name="title" required placeholder="Amazing Sushi Place"
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>

            <div>
              <label htmlFor="tagline" className="block text-sm font-medium text-gray-700 mb-1">One-liner (optional)</label>
              <input id="tagline" name="tagline" placeholder="Best sushi outside of Japan"
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select id="category" name="category" required className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="restaurant">Restaurant</option>
                <option value="activity">Activity</option>
                <option value="sightseeing">Sightseeing</option>
              </select>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Why should we go? (optional)</label>
              <textarea id="description" name="description" rows={3} placeholder="My coworker said this place is incredible..."
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 border rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {loading ? 'Adding...' : 'Add Card'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* === Editorial tree === */}
      <div className="theme-editorial-tree">
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(51,61,41,0.4)', backdropFilter: 'blur(4px)' }}
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-sm"
            style={{
              background: 'var(--cream)',
              border: '1px solid var(--stroke)',
              padding: '24px',
            }}
          >
            <div className="mb-5">
              <MonoLabel className="block mb-1">add card</MonoLabel>
              <h2
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '24px',
                  fontWeight: 400,
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}
              >
                A new recommendation
              </h2>
            </div>

            <div className="mb-4">
              <MonoLabel className="block mb-1">name</MonoLabel>
              <input
                id="title"
                name="title"
                required
                placeholder="Amazing Sushi Place"
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
            </div>

            <div className="mb-4">
              <MonoLabel className="block mb-1">one-liner (optional)</MonoLabel>
              <input
                id="tagline"
                name="tagline"
                placeholder="Best sushi outside of Japan"
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
            </div>

            <div className="mb-4">
              <MonoLabel className="block mb-1">category</MonoLabel>
              <select
                id="category"
                name="category"
                required
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
              >
                <option value="restaurant">Restaurant</option>
                <option value="activity">Activity</option>
                <option value="sightseeing">Sightseeing</option>
              </select>
            </div>

            <div className="mb-5">
              <MonoLabel className="block mb-1">why should we go? (optional)</MonoLabel>
              <textarea
                id="description"
                name="description"
                rows={3}
                placeholder="My coworker said this place is incredible..."
                style={{
                  width: '100%',
                  fontFamily: 'var(--font-serif)',
                  fontSize: '15px',
                  border: '1px solid var(--stroke)',
                  padding: '8px',
                  background: 'transparent',
                  color: 'var(--stroke)',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>

            <div className="flex gap-3">
              <PillButton type="button" onClick={onClose}>cancel</PillButton>
              <PillButton type="submit" disabled={loading}>
                {loading ? 'adding…' : 'add card'}
              </PillButton>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
