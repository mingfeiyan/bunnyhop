import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
}

// Tiny mono kicker label. Used pervasively above headlines, on tags, in
// stat boxes, etc. Always lowercase via the .label-mono CSS class.
export default function MonoLabel({ children, className = '' }: Props) {
  return <span className={`label-mono ${className}`}>{children}</span>
}
