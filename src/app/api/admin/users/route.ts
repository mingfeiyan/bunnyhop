// Admin-only API: returns all known users (from trip_participants) with
// their email and approval status. Uses the service role to access
// auth.users emails. Requires the caller to be a site admin.

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin'

export async function GET() {
  const supabase = await createClient()

  const admin = await verifyAdmin(supabase)
  if (!admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
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

  // Get emails via auth.admin API — single listUsers() call instead of N getUserById calls
  const { data: { users: authUsers } } = await serviceSupabase.auth.admin.listUsers()
  const emailMap = new Map<string, string>()
  for (const u of authUsers) {
    if (u.email) emailMap.set(u.id, u.email)
  }

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
    const email = emailMap.get(uid) ?? uid.slice(0, 8) + '...'
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
