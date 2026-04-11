'use client'

import Link from 'next/link'
import type { ReactNode, MouseEventHandler } from 'react'

type Variant = 'default' | 'active'
type Size = 'sm' | 'md'

type CommonProps = {
  children: ReactNode
  variant?: Variant
  size?: Size
  className?: string
}

type LinkProps = CommonProps & {
  href: string
  external?: boolean
  onClick?: never
  type?: never
  disabled?: never
}

type ButtonProps = CommonProps & {
  href?: undefined
  onClick?: MouseEventHandler<HTMLButtonElement>
  type?: 'button' | 'submit'
  disabled?: boolean
}

type Props = LinkProps | ButtonProps

// Outlined pill button. The mockup uses these as the only button style in
// the app. Three states: rest (transparent), hover (soft fill — desktop),
// active/click (full inversion). Pass variant="active" to render the
// inverted state permanently (e.g., for the selected tab in a toggle group).
//
// All visual styling lives in globals.css under .pill-btn / .pill-btn-sm /
// .pill-btn-md so React doesn't re-emit a <style> tag per render.
export default function PillButton(props: Props) {
  const { children, variant = 'default', size = 'sm', className = '' } = props
  const sizeClass = size === 'md' ? 'pill-btn-md' : 'pill-btn-sm'
  const isActive = variant === 'active' || undefined
  const finalClass = `pill-btn ${sizeClass} ${className}`

  if ('href' in props && props.href !== undefined) {
    const { href, external } = props
    if (external) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={finalClass}
          data-active={isActive}
        >
          {children}
        </a>
      )
    }
    return (
      <Link href={href} className={finalClass} data-active={isActive}>
        {children}
      </Link>
    )
  }

  const { onClick, type = 'button', disabled } = props
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={finalClass}
      data-active={isActive}
    >
      {children}
    </button>
  )
}
