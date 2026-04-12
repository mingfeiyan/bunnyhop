'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PillButton from '@/components/ui/PillButton'
import MonoLabel from '@/components/ui/MonoLabel'
import { EditorialInput, EditorialTextarea, EditorialSelect } from '@/components/ui/EditorialInput'

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

        <EditorialInput
          label="name"
          id="title"
          name="title"
          required
          placeholder="Amazing Sushi Place"
          fontSize={15}
        />

        <EditorialInput
          label="one-liner (optional)"
          id="tagline"
          name="tagline"
          placeholder="Best sushi outside of Japan"
          fontSize={15}
        />

        <EditorialSelect
          label="category"
          id="category"
          name="category"
          required
        >
          <option value="restaurant">Restaurant</option>
          <option value="activity">Activity</option>
          <option value="sightseeing">Sightseeing</option>
        </EditorialSelect>

        <EditorialTextarea
          label="why should we go? (optional)"
          id="description"
          name="description"
          rows={3}
          placeholder="My coworker said this place is incredible..."
          containerClassName="mb-5"
        />

        <div className="flex gap-3">
          <PillButton type="button" onClick={onClose}>cancel</PillButton>
          <PillButton type="submit" disabled={loading}>
            {loading ? 'adding…' : 'add card'}
          </PillButton>
        </div>
      </form>
    </div>
  )
}
