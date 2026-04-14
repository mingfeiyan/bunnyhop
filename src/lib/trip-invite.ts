import type { SupabaseClient } from '@supabase/supabase-js'

export type ResolvedInvite<T = Record<string, unknown>> = {
  trip: T & { id: string; created_by: string }
  familyId: string | null
}

// Resolves an invite code to a (trip, family) pair. Looks up the new per-family
// invite table first (migration 019). Falls back to the legacy
// `trips.invite_code` column so pre-migration codes still work — in that case
// familyId is null and the caller attributes events via the legacy path
// (added_by = trip.created_by, no family_id on the row).
export async function resolveInviteCode<T = Record<string, unknown>>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  code: string,
  tripSelect: string = 'id, created_by'
): Promise<ResolvedInvite<T> | null> {
  const { data: tfi } = await supabase
    .from('trip_family_invites')
    .select('trip_id, family_id')
    .eq('invite_code', code)
    .maybeSingle()

  if (tfi) {
    const { data: trip } = await supabase
      .from('trips')
      .select(tripSelect)
      .eq('id', tfi.trip_id)
      .maybeSingle()
    if (!trip) return null
    return {
      trip: trip as unknown as T & { id: string; created_by: string },
      familyId: tfi.family_id as string,
    }
  }

  const { data: legacyTrip } = await supabase
    .from('trips')
    .select(tripSelect)
    .eq('invite_code', code)
    .maybeSingle()
  if (!legacyTrip) return null
  return {
    trip: legacyTrip as unknown as T & { id: string; created_by: string },
    familyId: null,
  }
}
