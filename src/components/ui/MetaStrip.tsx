import type { ReactNode } from 'react'

type Props = {
  left: ReactNode
  right?: ReactNode
}

// Flex space-between row that sits under PageHeader. Used for date range +
// trip countdown, breadcrumbs + status, etc. Mono typography on both sides.
export default function MetaStrip({ left, right }: Props) {
  return (
    <div className="flex justify-between items-center px-5 pb-3">
      <span className="label-mono">{left}</span>
      {right && <span className="detail-mono">{right}</span>}
    </div>
  )
}
