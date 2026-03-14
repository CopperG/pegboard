import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark' | 'vintage' | 'doodle' | 'blaze' | 'system'

export const BUILTIN_THEMES = ['light', 'dark', 'vintage', 'doodle', 'blaze'] as const

/** Get all theme CSS class names (built-in + custom). */
export function getAllThemeClasses(): string[] {
  const custom: string[] = JSON.parse(localStorage.getItem('pegboard-custom-themes') || '[]')
  return [...BUILTIN_THEMES, ...custom]
}

interface ThemeContextValue {
  theme: Theme | string
  setTheme: (t: Theme | string) => void
  /** The resolved theme (never 'system') */
  resolved: string
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme | string>(() => {
    return localStorage.getItem('theme') || 'system'
  })

  const [resolved, setResolved] = useState<string>(() => {
    if (theme !== 'system') return theme
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  const setTheme = (t: Theme | string) => {
    setThemeState(t)
    localStorage.setItem('theme', t)
  }

  useEffect(() => {
    const root = document.documentElement
    const allClasses = getAllThemeClasses()
    root.classList.remove(...allClasses)

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const apply = (dark: boolean) => {
        root.classList.remove(...getAllThemeClasses())
        root.classList.add(dark ? 'dark' : 'light')
        setResolved(dark ? 'dark' : 'light')
      }
      apply(mq.matches)

      const listener = (e: MediaQueryListEvent) => apply(e.matches)
      mq.addEventListener('change', listener)
      return () => mq.removeEventListener('change', listener)
    } else {
      // SECURITY: Validate theme name before adding to classList
      if (/^[a-z0-9-]{1,64}$/.test(theme)) {
        root.classList.add(theme)
        setResolved(theme)
      } else {
        console.warn('[theme] Invalid theme name rejected:', theme)
        root.classList.add('light')
        setResolved('light')
      }
    }
  }, [theme])

  // Listen for external theme changes (e.g. from WebSocket agent control)
  useEffect(() => {
    const handler = (e: Event) => {
      const themeName = (e as CustomEvent<string>).detail
      if (themeName) setTheme(themeName)
    }
    window.addEventListener('pegboard-theme-change', handler)
    return () => window.removeEventListener('pegboard-theme-change', handler)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
