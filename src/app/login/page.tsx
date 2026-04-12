'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import MonoLabel from '@/components/ui/MonoLabel'

function LoginForm() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/'

  async function signInWithGoogle() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
  }

  return (
    <div className="w-full max-w-sm text-center px-6">
      <MonoLabel className="block mb-2">bunnyhop</MonoLabel>
      <h1
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '36px',
          fontWeight: 400,
          margin: 0,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        }}
      >
        Plan trips together
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '16px',
          fontStyle: 'italic',
          opacity: 0.75,
          marginTop: '12px',
          marginBottom: '32px',
        }}
      >
        the fun way
      </p>
      <button
        onClick={signInWithGoogle}
        className="pill-btn pill-btn-md"
        style={{ padding: '10px 24px' }}
      >
        continue with google
      </button>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: 'var(--cream)' }}>
      <Suspense fallback={
        <div className="w-full max-w-sm text-center px-6">
          <MonoLabel className="block mb-2">bunnyhop</MonoLabel>
          <p className="label-mono mt-4">loading…</p>
        </div>
      }>
        <LoginForm />
      </Suspense>
      <p className="mt-8 detail-mono text-center" style={{ opacity: 0.5, maxWidth: '280px' }}>
        by signing in, you agree to our{' '}
        <a href="/terms" style={{ color: 'var(--stroke)', textDecoration: 'underline' }}>terms</a>
        {' '}and{' '}
        <a href="/privacy" style={{ color: 'var(--stroke)', textDecoration: 'underline' }}>privacy policy</a>
      </p>
    </div>
  )
}
