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
