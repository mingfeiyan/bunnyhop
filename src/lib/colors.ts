// Family-group color palette.
//
// Two APIs coexist during the editorial-redesign migration:
//   - getFamilyColor() returns the muted hex value (new API; used by ported components)
//   - getColorClasses() returns Tailwind classes for backwards-compat with not-yet-ported components
//
// The 6 color KEY names (indigo, amber, etc.) are persisted in the database
// (families.color), so the keys MUST stay stable. Only the rendered visual changes.

export const COLOR_PALETTE = [
  { name: 'indigo', bg: 'bg-indigo-100', text: 'text-indigo-800', dot: 'bg-indigo-500', border: 'border-indigo-500' },
  { name: 'amber', bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500', border: 'border-amber-500' },
  { name: 'emerald', bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500', border: 'border-emerald-500' },
  { name: 'rose', bg: 'bg-rose-100', text: 'text-rose-800', dot: 'bg-rose-500', border: 'border-rose-500' },
  { name: 'sky', bg: 'bg-sky-100', text: 'text-sky-800', dot: 'bg-sky-500', border: 'border-sky-500' },
  { name: 'purple', bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-500', border: 'border-purple-500' },
]

export function getColorClasses(colorName: string) {
  return COLOR_PALETTE.find(c => c.name === colorName) ?? COLOR_PALETTE[0]
}

// New muted palette — values match the --family-* CSS variables in globals.css.
// Each color is L≈55 S≈22 — visible against cream, distinguishable from each
// other, but restrained enough to coexist with the editorial mono aesthetic.
export const FAMILY_COLORS = {
  indigo: '#6B7B9E',
  amber: '#A89674',
  emerald: '#7A9080',
  rose: '#A88080',
  sky: '#7B8B9C',
  purple: '#8B7B9B',
} as const

export type FamilyColorName = keyof typeof FAMILY_COLORS

export function getFamilyColor(name: string | null | undefined): string {
  if (name && name in FAMILY_COLORS) {
    return FAMILY_COLORS[name as FamilyColorName]
  }
  return FAMILY_COLORS.indigo
}
