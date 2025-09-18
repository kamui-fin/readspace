/**
 * Color definitions for Readspace Design System
 * TypeScript definitions that match CSS variables
 */

export const colorTokens = {
    background: "hsl(var(--background))",
    foreground: "hsl(var(--foreground))",
    muted: {
        DEFAULT: "hsl(var(--muted))",
        foreground: "hsl(var(--muted-foreground))",
    },
    popover: {
        DEFAULT: "hsl(var(--popover))",
        foreground: "hsl(var(--popover-foreground))",
    },
    card: {
        DEFAULT: "hsl(var(--card))",
        foreground: "hsl(var(--card-foreground))",
    },
    border: "hsl(var(--border))",
    input: "hsl(var(--input))",
    primary: {
        DEFAULT: "hsl(var(--primary))",
        foreground: "hsl(var(--primary-foreground))",
    },
    secondary: {
        DEFAULT: "hsl(var(--secondary))",
        foreground: "hsl(var(--secondary-foreground))",
    },
    accent: {
        DEFAULT: "hsl(var(--accent))",
        foreground: "hsl(var(--accent-foreground))",
    },
    destructive: {
        DEFAULT: "hsl(var(--destructive))",
        foreground: "hsl(var(--destructive-foreground))",
    },
    ring: "hsl(var(--ring))",
    chart: {
        "1": "hsl(var(--chart-1))",
        "2": "hsl(var(--chart-2))",
        "3": "hsl(var(--chart-3))",
        "4": "hsl(var(--chart-4))",
        "5": "hsl(var(--chart-5))",
    },
    sidebar: {
        DEFAULT: "hsl(var(--sidebar))",
        foreground: "hsl(var(--foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",
    },
} as const
