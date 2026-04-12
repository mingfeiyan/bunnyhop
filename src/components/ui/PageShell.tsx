import Link from 'next/link'
import type { ReactNode } from 'react'

type BackProps = {
  href: string
  label: string
}

type Props = {
  children: ReactNode
  back?: BackProps
  maxWidth?: 'sm' | 'md' | 'lg'
}

// Full-page shell. Cream background, min-h-screen, centered max-width column.
// Optional back link rendered above the main content slot in mono.
export default function PageShell({ children, back, maxWidth = 'md' }: Props) {
  const maxClass = maxWidth === 'sm' ? 'max-w-sm' : maxWidth === 'lg' ? 'max-w-2xl' : 'max-w-md'

  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      <div className={`${maxClass} mx-auto`}>
        {back && (
          <div className="px-5 pt-5">
            <Link
              href={back.href}
              className="label-mono"
              style={{ color: 'var(--stroke)', textDecoration: 'none' }}
            >
              ← {back.label}
            </Link>
          </div>
        )}
        {children}

        {/* Site-wide footer */}
        <footer className="px-5 py-6 mt-8 text-center">
          <a href="/privacy" className="label-mono" style={{ color: 'var(--stroke)', opacity: 0.35, textDecoration: 'none' }}>
            privacy
          </a>
          <span className="label-mono mx-2" style={{ opacity: 0.2 }}>·</span>
          <a href="/terms" className="label-mono" style={{ color: 'var(--stroke)', opacity: 0.35, textDecoration: 'none' }}>
            terms
          </a>
        </footer>
      </div>
    </div>
  )
}
