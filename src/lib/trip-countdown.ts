// Pure date math: where is "today" relative to a trip's date range?
// Returns one of:
//   - "X days to go"           (today < start)
//   - "in progress · day X of Y" (start <= today <= end)
//   - "ended X days ago"       (today > end)
//   - null                     (start or end is null — caller should hide the strip)
//
// Used in MetaStrips on trip pages — gives at-a-glance trip status without
// needing a separate "status" field on the trips table.
export function tripCountdown(start: string | null, end: string | null): string | null {
  if (!start || !end) return null
  const today = new Date().toISOString().slice(0, 10)
  const dayMs = 1000 * 60 * 60 * 24
  const startMs = new Date(start).getTime()
  const endMs = new Date(end).getTime()
  const todayMs = new Date(today).getTime()

  if (todayMs < startMs) {
    const days = Math.round((startMs - todayMs) / dayMs)
    return `${days} day${days === 1 ? '' : 's'} to go`
  }
  if (todayMs > endMs) {
    const days = Math.round((todayMs - endMs) / dayMs)
    return `ended ${days} day${days === 1 ? '' : 's'} ago`
  }
  const dayNum = Math.round((todayMs - startMs) / dayMs) + 1
  const totalDays = Math.round((endMs - startMs) / dayMs) + 1
  return `in progress · day ${dayNum} of ${totalDays}`
}
