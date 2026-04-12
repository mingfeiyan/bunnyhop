// Admin-only API: returns all known users (from trip_participants) with
// their email and approval status. Uses the service role to access
// auth.users emails. Requires the caller to be a site admin.

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  // Verify the caller is an admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: adminCheck } = await supabase
    .from('approved_creators')
    .select('is_admin')
    .eq('user_id', user.id)
    .eq('is_admin', true)
    .maybeSingle()

  if (!adminCheck) {
    return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
  }

  // Use service role to get all unique users with emails
  const serviceSupabase = createServiceClient()

  // Get all unique user_ids from trip_participants + approved_creators
  const { data: participants } = await serviceSupabase
    .from('trip_participants')
    .select('user_id')

  const { data: creators } = await serviceSupabase
    .from('approved_creators')
    .select('user_id, is_admin')

  const allUserIds = new Set<string>()
  for (const p of participants ?? []) allUserIds.add(p.user_id)
  for (const c of creators ?? []) allUserIds.add(c.user_id)

  // Get emails via auth.admin API
  const approvedMap = new Map(
    (creators ?? []).map(c => [c.user_id, c])
  )

  // Build the user list with emails
  const users: Array<{
    user_id: string
    email: string
    is_approved: boolean
    is_admin: boolean
  }> = []

  for (const uid of allUserIds) {
    // Get email from auth.users via admin API
    const { data: authUser } = await serviceSupabase.auth.admin.getUserById(uid)
    const email = authUser?.user?.email ?? uid.slice(0, 8) + '...'
    const approved = approvedMap.get(uid)
    users.push({
      user_id: uid,
      email,
      is_approved: Boolean(approved),
      is_admin: approved?.is_admin ?? false,
    })
  }

  // Sort: admins first, then approved, then others
  users.sort((a, b) => {
    if (a.is_admin !== b.is_admin) return a.is_admin ? -1 : 1
    if (a.is_approved !== b.is_approved) return a.is_approved ? -1 : 1
    return a.email.localeCompare(b.email)
  })

  return NextResponse.json({ users })
}
