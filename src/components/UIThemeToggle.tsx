'use client'

import { useSyncExternalStore } from 'react'

type Theme = 'default' | 'editorial'

const STORAGE_KEY = 'bunnyhop:ui-theme'

// Tiny external store. The single source of truth for "current theme" is
// the `theme-editorial` class on <html>. The inline script in layout.tsx
// sets that class before React hydrates (reading from localStorage), so
// getSnapshot() always reflects the user's chosen theme on first paint.
const listeners = new Set<() => void>()

function getSnapshot(): Theme {
  return document.documentElement.classList.contains('theme-editorial')
    ? 'editorial'
    : 'default'
}

function getServerSnapshot(): Theme {
  return 'default'
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

function setTheme(next: Theme): void {
  if (next === 'editorial') {
    document.documentElement.classList.add('theme-editorial')
  } else {
    document.documentElement.classList.remove('theme-editorial')
  }
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // localStorage may be disabled in private mode; toggle still works for
    // the current session, just won't persist across reloads.
  }
  listeners.forEach(l => l())
}

// Floating top-right toggle visible on every page. Reads the persisted
// theme via useSyncExternalStore (which is the right hook for "synchronize
// React state with an external mutable source like the DOM"). The button
// label is wrapped in suppressHydrationWarning because the SSR snapshot is
// always 'default' but the client may have hydrated to 'editorial'.
export default function UIThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  function toggle() {
    setTheme(theme === 'editorial' ? 'default' : 'editorial')
  }

  return (
    <button type="button" onClick={toggle} className="ui-theme-toggle">
      <span suppressHydrationWarning>{theme}</span>
    </button>
  )
}
