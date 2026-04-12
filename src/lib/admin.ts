// Shared admin verification helper. Used by all /api/admin/* routes.
// Returns the authenticated user if they're a site admin (approved_creators.
// is_admin = true), otherwise null.

import type { SupabaseClient } from '@supabase/supabase-js'

export async function verifyAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('approved_creators')
    .select('is_admin')
    .eq('user_id', user.id)
    .eq('is_admin', true)
    .maybeSingle()
  return data ? user : null
}
