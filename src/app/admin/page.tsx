import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageShell from '@/components/ui/PageShell'
import PageHeader from '@/components/ui/PageHeader'
import MonoLabel from '@/components/ui/MonoLabel'
import AdminCreatorList from './AdminCreatorList'
import AdminFamilyList from './AdminFamilyList'

export default async function AdminPage() {
  const supabase = await createClient()

  // Check if the current user is an admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin')

  const { data: adminCheck } = await supabase
    .from('approved_creators')
    .select('is_admin')
    .eq('user_id', user.id)
    .eq('is_admin', true)
    .maybeSingle()

  if (!adminCheck) {
    return (
      <PageShell back={{ href: '/trips', label: 'back to trips' }}>
        <PageHeader title="Not authorized" />
        <p className="px-5 detail-mono" style={{ opacity: 0.7 }}>
          This page is only accessible to site admins.
        </p>
      </PageShell>
    )
  }

  return (
    <PageShell back={{ href: '/trips', label: 'back to trips' }}>
      <PageHeader kicker="admin" title="Site settings" />
      <section className="px-5 py-4 border-b border-stroke">
        <MonoLabel className="block mb-3">trip creation whitelist</MonoLabel>
        <p className="detail-mono mb-4" style={{ opacity: 0.7 }}>
          Only users on this list can create new trips. Everyone else can still view and participate in trips they&apos;re invited to.
        </p>
        <AdminCreatorList />
      </section>

      <section className="px-5 py-4">
        <MonoLabel className="block mb-3">families</MonoLabel>
        <p className="detail-mono mb-4" style={{ opacity: 0.7 }}>
          Global family groups. Members automatically get their family&apos;s color accent on any trip timeline they appear in. No per-trip setup needed.
        </p>
        <AdminFamilyList />
      </section>
    </PageShell>
  )
}
