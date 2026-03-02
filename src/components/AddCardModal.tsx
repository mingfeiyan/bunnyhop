'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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
  )
}
