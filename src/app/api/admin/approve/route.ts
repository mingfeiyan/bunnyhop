// Admin-only API: approve or revoke a user's trip creation permission.
// POST body: { user_id: string, action: 'approve' | 'revoke' }

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin'

export async function POST(request: Request) {
  const supabase = await createClient()

  const admin = await verifyAdmin(supabase)
  if (!admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  let user_id: string | undefined
  let action: string | undefined
  try {
    const body = await request.json()
    user_id = body.user_id
    action = body.action
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!user_id || (action !== 'approve' && action !== 'revoke')) {
    return NextResponse.json({ error: 'user_id and action (approve|revoke) required' }, { status: 400 })
  }

  // Prevent revoking your own admin access
  if (action === 'revoke' && user_id === admin.id) {
    return NextResponse.json({ error: "Can't revoke your own access" }, { status: 400 })
  }

  const serviceSupabase = createServiceClient()

  if (action === 'approve') {
    const { error } = await serviceSupabase
      .from('approved_creators')
      .upsert({
        user_id,
        is_admin: false,
        approved_by: admin.id,
      }, { onConflict: 'user_id' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ status: 'approved' })
  }

  // revoke
  const { error } = await serviceSupabase
    .from('approved_creators')
    .delete()
    .eq('user_id', user_id)
    .eq('is_admin', false) // never delete admin rows via this endpoint

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ status: 'revoked' })
}
