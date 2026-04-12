// Admin-only API: approve or revoke a user's trip creation permission.
// POST body: { user_id: string, action: 'approve' | 'revoke' }

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
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

  const { user_id, action } = await request.json()
  if (!user_id || (action !== 'approve' && action !== 'revoke')) {
    return NextResponse.json({ error: 'user_id and action (approve|revoke) required' }, { status: 400 })
  }

  // Prevent revoking your own admin access
  if (action === 'revoke' && user_id === user.id) {
    return NextResponse.json({ error: "Can't revoke your own access" }, { status: 400 })
  }

  const serviceSupabase = createServiceClient()

  if (action === 'approve') {
    const { error } = await serviceSupabase
      .from('approved_creators')
      .upsert({
        user_id,
        is_admin: false,
        approved_by: user.id,
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
