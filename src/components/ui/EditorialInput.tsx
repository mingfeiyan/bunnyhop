import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'
import MonoLabel from './MonoLabel'

// Editorial form-field primitives. Replaces a 9-property inline-style block
// that was duplicated 14+ times across EditTripDetailsModal, AddCardModal,
// and the new-trip form. The visual identity is: bottom-border-only field
// with a mono kicker label above and serif input text inside.
//
// Three flavors:
//   <EditorialInput label="..." />     — single-line text/date/email/etc
//   <EditorialTextarea label="..." />  — multi-line, full hairline border
//   <EditorialSelect label="..." />    — native select with the same chrome
//
// All three accept any standard HTML props for their tag plus an optional
// `label` (renders a MonoLabel above) and `hint` (mono caption below).

const FIELD_BASE_STYLE: React.CSSProperties = {
  width: '100%',
  fontFamily: 'var(--font-serif), Georgia, serif',
  fontSize: '17px',
  border: 'none',
  borderBottom: '1px solid var(--stroke)',
  padding: '6px 0',
  background: 'transparent',
  color: 'var(--stroke)',
  outline: 'none',
}

const TEXTAREA_BASE_STYLE: React.CSSProperties = {
  ...FIELD_BASE_STYLE,
  border: '1px solid var(--stroke)',
  borderBottom: '1px solid var(--stroke)', // explicit so the spread doesn't drop it
  padding: '8px',
  fontSize: '15px',
  resize: 'vertical',
}

type WithLabel = {
  label?: string
  hint?: ReactNode
  containerClassName?: string
}

type InputProps = WithLabel & Omit<InputHTMLAttributes<HTMLInputElement>, 'style'> & {
  fontSize?: number  // override the default 17px (e.g., 14px for date inputs)
}

export function EditorialInput({
  label,
  hint,
  containerClassName = 'mb-4',
  fontSize,
  ...inputProps
}: InputProps) {
  const style = fontSize ? { ...FIELD_BASE_STYLE, fontSize: `${fontSize}px` } : FIELD_BASE_STYLE
  return (
    <div className={containerClassName}>
      {label && <MonoLabel className="block mb-1">{label}</MonoLabel>}
      <input {...inputProps} style={style} />
      {hint && <p className="detail-mono mt-1" style={{ opacity: 0.6 }}>{hint}</p>}
    </div>
  )
}

type TextareaProps = WithLabel & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'style'>

export function EditorialTextarea({
  label,
  hint,
  containerClassName = 'mb-4',
  ...textareaProps
}: TextareaProps) {
  return (
    <div className={containerClassName}>
      {label && <MonoLabel className="block mb-1">{label}</MonoLabel>}
      <textarea {...textareaProps} style={TEXTAREA_BASE_STYLE} />
      {hint && <p className="detail-mono mt-1" style={{ opacity: 0.6 }}>{hint}</p>}
    </div>
  )
}

type SelectProps = WithLabel & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'style'> & {
  children: ReactNode
}

export function EditorialSelect({
  label,
  hint,
  containerClassName = 'mb-4',
  children,
  ...selectProps
}: SelectProps) {
  return (
    <div className={containerClassName}>
      {label && <MonoLabel className="block mb-1">{label}</MonoLabel>}
      <select {...selectProps} style={FIELD_BASE_STYLE}>
        {children}
      </select>
      {hint && <p className="detail-mono mt-1" style={{ opacity: 0.6 }}>{hint}</p>}
    </div>
  )
}
