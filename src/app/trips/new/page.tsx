import NewTripForm from './NewTripForm'

// force-dynamic skips static prerender, which would otherwise try to
// construct a Supabase client at build time. Build-time envs aren't
// guaranteed on preview deploys; the form is auth-gated and data-driven
// at runtime anyway, so there's nothing to prerender.
export const dynamic = 'force-dynamic'

export default function NewTripPage() {
  return <NewTripForm />
}
