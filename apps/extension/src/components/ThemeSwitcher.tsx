import { Switch } from '@/components/ui/switch'
import { MoonIcon, SunIcon } from 'lucide-react'
import { useId, useState, useEffect, useCallback } from 'react'
import { useExtensionStore } from '@/store'

export default function ThemeSwitcher() {
  const { settings, updateSettings } = useExtensionStore()
  const id = useId()

  // Determine the effective theme (resolve "system" to actual theme)
  const getEffectiveTheme = useCallback(() => {
    if (settings.theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    }
    return settings.theme
  }, [settings.theme])

  const [isLight, setIsLight] = useState(() => getEffectiveTheme() === 'light')

  // Update theme class on document
  useEffect(() => {
    const effectiveTheme = getEffectiveTheme()
    const isDark = effectiveTheme === 'dark'

    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    setIsLight(!isDark)
  }, [settings.theme, getEffectiveTheme])

  // Listen for system theme changes
  useEffect(() => {
    if (settings.theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      const isDark = e.matches
      if (isDark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      setIsLight(!isDark)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [settings.theme])

  const toggleSwitch = () => {
    const newTheme = !isLight ? 'light' : 'dark'
    updateSettings({ theme: newTheme })
    setIsLight((prev) => !prev)
  }

  return (
    <div
      className="group inline-flex items-center gap-2"
      data-state={isLight ? 'checked' : 'unchecked'}
    >
      <span
        id={`${id}-off`}
        className="group-data-[state=checked]:text-muted-foreground/70 flex-1 cursor-pointer text-right text-sm font-medium"
        aria-controls={id}
        onClick={() => {
          updateSettings({ theme: 'dark' })
          setIsLight(false)
        }}
      >
        <MoonIcon size={16} aria-hidden="true" />
      </span>
      <Switch
        id={id}
        checked={isLight}
        onCheckedChange={toggleSwitch}
        aria-labelledby={`${id}-off ${id}-on`}
        aria-label="Toggle between dark and light mode"
      />
      <span
        id={`${id}-on`}
        className="group-data-[state=unchecked]:text-muted-foreground/70 flex-1 cursor-pointer text-left text-sm font-medium"
        aria-controls={id}
        onClick={() => {
          updateSettings({ theme: 'light' })
          setIsLight(true)
        }}
      >
        <SunIcon size={16} aria-hidden="true" />
      </span>
    </div>
  )
}
