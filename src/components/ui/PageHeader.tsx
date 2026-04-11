import MonoLabel from './MonoLabel'

type Props = {
  kicker?: string
  title: string
}

// Page-top headline. Optional mono kicker above the serif H1.
// Sized to match the mockup: 42px serif title, lowercase mono kicker.
export default function PageHeader({ kicker, title }: Props) {
  return (
    <header className="px-5 pt-10 pb-5">
      {kicker && <MonoLabel className="mb-2">{kicker}</MonoLabel>}
      <h1
        style={{
          fontFamily: 'var(--font-serif), Georgia, serif',
          fontSize: '42px',
          fontWeight: 400,
          margin: 0,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        }}
      >
        {title}
      </h1>
    </header>
  )
}
