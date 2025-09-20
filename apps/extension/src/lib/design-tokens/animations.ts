/**
 * Animation definitions for Readspace Design System
 * Can be used to extend Tailwind animations
 */

export const animationKeyframes = {
  'accordion-down': {
    from: { height: '0' },
    to: { height: 'var(--radix-accordion-content-height)' },
  },
  'accordion-up': {
    from: { height: 'var(--radix-accordion-content-height)' },
    to: { height: '0' },
  },
  gradient: {
    to: { backgroundPosition: 'var(--bg-size, 300%) 0' },
  },
  'shiny-text': {
    '0%, 90%, 100%': {
      'background-position': 'calc(-100% - var(--shiny-width)) 0',
    },
    '30%, 60%': {
      'background-position': 'calc(100% + var(--shiny-width)) 0',
    },
  },
  typing: {
    '0%, 100%': { transform: 'translateY(0)', opacity: '0.5' },
    '50%': { transform: 'translateY(-2px)', opacity: '1' },
  },
  'loading-dots': {
    '0%, 100%': { opacity: '0' },
    '50%': { opacity: '1' },
  },
  wave: {
    '0%, 100%': { transform: 'scaleY(1)' },
    '50%': { transform: 'scaleY(0.6)' },
  },
  blink: {
    '0%, 100%': { opacity: '1' },
    '50%': { opacity: '0' },
  },
  shimmer: {
    '0%': { backgroundPosition: '200% 50%' },
    '100%': { backgroundPosition: '-200% 50%' },
  },
} as const

export const animations = {
  'accordion-down': 'accordion-down 0.2s ease-out',
  'accordion-up': 'accordion-up 0.2s ease-out',
  gradient: 'gradient 8s linear infinite',
  'shiny-text': 'shiny-text 8s infinite',
  typing: 'typing 1.5s infinite',
  'loading-dots': 'loading-dots 1.4s infinite',
  wave: 'wave 1.2s infinite',
  blink: 'blink 1s infinite',
  shimmer: 'shimmer 2s infinite',
} as const
