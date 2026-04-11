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

  const googleSvg = (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )

  return (
    <>
      {/* === Default tree === */}
      <div className="theme-default-tree">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center">
          <h1 className="text-3xl font-bold mb-2">Bunnyhop</h1>
          <p className="text-gray-500 mb-8">Plan trips together, the fun way</p>
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-700 font-medium hover:bg-gray-50 transition"
          >
            {googleSvg}
            Continue with Google
          </button>
        </div>
      </div>

      {/* === Editorial tree === */}
      <div className="theme-editorial-tree">
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
            className="pill-btn pill-btn-md inline-flex items-center justify-center"
            style={{ gap: '12px', padding: '10px 24px' }}
          >
            {googleSvg}
            continue with google
          </button>
        </div>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <>
      {/* === Default tree === */}
      <div className="theme-default-tree">
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
          <Suspense fallback={
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center">
              <h1 className="text-3xl font-bold mb-2">Bunnyhop</h1>
              <p className="text-gray-500 mb-8">Loading...</p>
            </div>
          }>
            <LoginForm />
          </Suspense>
        </div>
      </div>

      {/* === Editorial tree === */}
      <div className="theme-editorial-tree">
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--cream)' }}>
          <Suspense fallback={
            <div className="w-full max-w-sm text-center px-6">
              <MonoLabel className="block mb-2">bunnyhop</MonoLabel>
              <p className="label-mono mt-4">loading…</p>
            </div>
          }>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </>
  )
}
