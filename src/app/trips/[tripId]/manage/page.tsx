import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import InviteLink from '@/components/InviteLink'
import CopyInviteButton from '@/components/CopyInviteButton'
import EditTripDetailsButton from '@/components/EditTripDetailsButton'
import PageShell from '@/components/ui/PageShell'
import PageHeader from '@/components/ui/PageHeader'
import MonoLabel from '@/components/ui/MonoLabel'
import { getFamilyColor } from '@/lib/colors'
import { getUserFamilyMap } from '@/lib/family'

export default async function ManageTripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params
  const supabase = await createClient()

  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single()

  if (!trip) notFound()

  const [{ data: participants }, { data: { user } }, userFamilyMap] = await Promise.all([
    supabase.rpc('get_trip_participants_with_email', { p_trip_id: tripId }),
    supabase.auth.getUser(),
    getUserFamilyMap(supabase),
  ])

  const isOrganizer = participants?.some((p: { user_id: string; role: string }) => p.user_id === user?.id && p.role === 'organizer') ?? false

  // Per-family invite codes. RLS returns organizer → all families; member → own family only.
  const { data: invitesRaw } = await supabase
    .from('trip_family_invites')
    .select('invite_code, families(id, name, color)')
    .eq('trip_id', tripId)
  const invites = (invitesRaw ?? []).map(row => {
    const fam = Array.isArray(row.families) ? row.families[0] : row.families
    const f = fam as { id: string; name: string; color: string } | null
    return {
      inviteCode: row.invite_code as string,
      familyId: f?.id ?? null,
      familyName: f?.name ?? 'Unknown family',
      familyColor: f?.color ?? 'indigo',
    }
  })

  const myFamilyId = user
    ? (await supabase.from('family_members').select('family_id').eq('user_id', user.id).maybeSingle()).data?.family_id
    : null
  const myInvite = invites.find(i => i.familyId === myFamilyId)
  const userInviteCode: string = myInvite?.inviteCode ?? trip.invite_code

  const otherInvites = isOrganizer
    ? invites.filter(i => i.familyId !== myFamilyId)
    : []

  const participantCount = participants?.length ?? 0

  return (
    <PageShell back={{ href: `/trips/${tripId}`, label: 'back to trip' }}>
      <PageHeader kicker="manage" title={trip.title} />

      {participantCount > 0 && (
        <section className="px-5 py-4 border-b border-stroke">
          <MonoLabel className="block mb-2">who&apos;s on this trip</MonoLabel>
          <div className="space-y-1">
            {(participants as Array<{ user_id: string; email: string; role: string }>).map(p => {
              const family = userFamilyMap.get(p.user_id)
              const displayName = p.email?.split('@')[0] ?? p.user_id.slice(0, 8)
              return (
                <div key={p.user_id} className="flex items-center gap-2 detail-mono">
                  {family && (
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: getFamilyColor(family.color),
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span>{displayName}</span>
                  {family && (
                    <span style={{ opacity: 0.5 }}>{family.name}</span>
                  )}
                  {p.role === 'organizer' && (
                    <span className="label-mono" style={{ opacity: 0.5 }}>organizer</span>
                  )}
                  {p.user_id === user?.id && (
                    <span className="label-mono" style={{ opacity: 0.5 }}>you</span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="px-5 py-5 border-b border-stroke">
        <InviteLink
          inviteCode={userInviteCode}
          leadingButtons={<EditTripDetailsButton trip={trip} isOrganizer={isOrganizer} />}
        />
      </section>

      {isOrganizer && otherInvites.length > 0 && (
        <section className="px-5 py-5 border-b border-stroke">
          <MonoLabel className="block mb-2">invited families · share these codes</MonoLabel>
          <div className="space-y-2">
            {otherInvites.map(inv => (
              <div key={inv.inviteCode} className="flex items-center gap-3 detail-mono">
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: getFamilyColor(inv.familyColor),
                    flexShrink: 0,
                  }}
                />
                <span>{inv.familyName}</span>
                <CopyInviteButton inviteCode={inv.inviteCode} mode="link" />
              </div>
            ))}
          </div>
        </section>
      )}
    </PageShell>
  )
}
