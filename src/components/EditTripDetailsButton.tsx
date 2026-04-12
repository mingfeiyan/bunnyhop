'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import EditTripDetailsModal from './EditTripDetailsModal'
import PillButton from '@/components/ui/PillButton'
import type { Trip } from '@/types'

type Props = {
  trip: Trip
  isOrganizer: boolean
}

// Tiny client wrapper that holds the modal open state and renders the trigger.
// Lives inside the server-rendered trip hub. Renders nothing for non-organizers
// (the UPDATE RLS policy on trips also enforces this server-side).
export default function EditTripDetailsButton({ trip, isOrganizer }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  if (!isOrganizer) return null

  return (
    <>
      <PillButton onClick={() => setOpen(true)}>edit details</PillButton>

      {open && (
        <EditTripDetailsModal
          trip={trip}
          onClose={() => setOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </>
  )
}
