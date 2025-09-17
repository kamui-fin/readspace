## Readspace Frontend

This is a comprehensive frontend that combines multiple technologies:

This is a Next.js 15 application using:

- **App Router** (not Pages Router)
- **React 19** with Server Components by default
- **TypeScript** for type safety
- **Tailwind CSS** for styling (if configured)
- **Server Actions** for mutations
- **Turbopack** for faster builds (optional)

This is a shadcn/ui project focused on:

- **Component-first development** with copy-paste architecture
- **Radix UI primitives** for behavior and accessibility
- **Tailwind CSS** for utility-first styling
- **TypeScript** for type-safe component APIs
- **React 18/19** with modern patterns (Server Components when applicable)
- **Accessibility-first** design with full keyboard and screen reader support

This project uses **Tailwind CSS** for styling with:

- **Utility-first approach** for rapid development
- **Responsive design** with mobile-first methodology
- **Custom design system** with consistent spacing and colors
- **Component patterns** for reusable UI elements
- **Performance optimization** with CSS purging
- **Dark mode support** with class-based theming
- **Plugin ecosystem** for extended functionality

## Security Best Practices

_Combined from: Next.js 15, shadcn/ui_

1. **Always validate Server Actions input** with Zod or similar
2. **Authenticate and authorize** in Server Actions and middleware
3. **Sanitize user input** before rendering
4. **Use environment variables correctly**:
    - `NEXT_PUBLIC_*` for client-side
    - Others stay server-side only
5. **Implement rate limiting** for public actions
6. **Configure CSP headers** in next.config.js
7. **Sanitize user input** in dynamic content
8. **Validate form data** with Zod schemas
9. **Use TypeScript** for type safety
10. **Escape HTML** in user-generated content
11. **Implement CSP** headers when applicable

## Development Guidelines

### Component Architecture

- **Keep components small and focused**: Break down complex components into smaller, reusable pieces
- **Leverage shadcn/ui system**: Use existing components from the established component library
- **Abstract common functionality**: Create reusable components for repeated patterns

### Design Requirements

- **Responsive Design**: All components must work across all screen sizes
    - Use Tailwind's responsive breakpoints (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`)
    - Test on mobile, tablet, and desktop viewports
- **Dark Theme Support**: All components must properly support dark mode
    - Use CSS variables from `globals.css` for colors
    - Test both light and dark themes
- **Color Scheme Consistency**: Respect `web/app/globals.css` for color definitions
    - Use semantic color names (e.g., `text-foreground`, `bg-background`)
    - Avoid hardcoded color values

### Code Quality Workflow

After writing any frontend code, always run:

1. **Build**: `pnpm build` - Ensure production build succeeds
2. **Type Check**: `pnpm type-check` - Verify TypeScript types
3. **Format**: `pnpm format` - Apply Prettier formatting
4. **Lint**: `pnpm lint` - Fix ESLint issues

## Performance Optimization

_Combined from: Next.js 15, shadcn/ui, Tailwind CSS_

1. **Use Server Components** to reduce bundle size
2. **Implement streaming** with Suspense boundaries
3. **Optimize images** with next/image component
4. **Use dynamic imports** for code splitting
5. **Configure proper caching** strategies
6. **Enable Partial Prerendering** (experimental) when stable
7. **Monitor Core Web Vitals**

## ⚠️ Breaking Changes from Next.js 14

1. **Async Request APIs**: `params`, `searchParams`, `cookies()`, and `headers()` are now async

    ```typescript
    // ❌ OLD (Next.js 14)
    export default function Page({ params, searchParams }) {
        const id = params.id
    }

    // ✅ NEW (Next.js 15)
    export default async function Page({ params, searchParams }) {
        const { id } = await params
        const { query } = await searchParams
    }

    // Server Actions and API Routes
    import { cookies, headers } from "next/headers"

    export async function GET() {
        const cookieStore = await cookies()
        const headersList = await headers()

        const token = cookieStore.get("auth")
        const userAgent = headersList.get("user-agent")
    }
    ```

2. **React 19 Required**: Minimum React version is 19.0.0
    - Update package.json: `"react": "19.0.0"`
    - Update React types: `"@types/react": "^19.0.0"`

3. **`useFormState` → `useActionState`**: Import from 'react' not 'react-dom'

    ```typescript
    // ❌ OLD
    import { useFormState } from "react-dom"

    // ✅ NEW
    import { useActionState } from "react"
    ```

4. **Fetch Caching**: Fetch requests are no longer cached by default

    ```typescript
    // ❌ OLD (cached by default)
    const data = await fetch("/api/data")

    // ✅ NEW (explicit caching required)
    const data = await fetch("/api/data", {
        next: { revalidate: 3600 }, // Cache for 1 hour
    })
    ```

5. **TypeScript 5+**: Minimum TypeScript version is 5.0
    - Update tsconfig.json for stricter checking
    - Use new TypeScript features like const type parameters

## 2. File Conventions

Always use these file names in the `app/` directory:

- `page.tsx` - Route page component
- `layout.tsx` - Shared layout wrapper
- `loading.tsx` - Loading UI (Suspense fallback)
- `error.tsx` - Error boundary (must be Client Component)
- `not-found.tsx` - 404 page
- `route.ts` - API route handler
- `template.tsx` - Re-rendered layout
- `default.tsx` - Parallel route fallback

## 3. Data Fetching Patterns

```typescript
// ✅ GOOD: Fetch in Server Component
async function ProductList() {
  const products = await db.products.findMany();
  return <div>{/* render products */}</div>;
}

// ❌ AVOID: Client-side fetching when not needed
'use client';
function BadPattern() {
  const [data, setData] = useState(null);
  useEffect(() => { fetch('/api/data')... }, []);
}
```

## 3. Installation Patterns

````bash

## 3. Animation Performance

```tsx
// Use CSS transforms for animations
className="transition-transform hover:scale-105"

// Avoid layout shifts
className="transform-gpu"
````

## 1. Component Testing

_Combined from: Next.js 15, shadcn/ui_

- **Unit tests**: Jest/Vitest for logic and utilities
- **Component tests**: React Testing Library
- **E2E tests**: Playwright or Cypress
- **Server Components**: Test data fetching logic separately
- **Server Actions**: Mock and test validation/business logic
  npm run test

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
test("button click", async () => {
    const user = userEvent.setup()
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click me</Button>)
    await user.click(screen.getByRole("button"))
    expect(handleClick).toHaveBeenCalledTimes(1)
})
```

import { axe } from 'jest-axe'
test('no accessibility violations', async () => {
const { container } = render(<Card>Content</Card>)
const results = await axe(container)
expect(results).toHaveNoViolations()
})

````

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Build succeeds locally
- [ ] Tests pass
- [ ] Security headers configured
- [ ] Error tracking setup (Sentry)
- [ ] Analytics configured
- [ ] SEO metadata in place
- [ ] Performance monitoring active

## Debugging Tips

1. **Check Radix UI data attributes** for component state
2. **Use React DevTools** to inspect component props
3. **Verify Tailwind classes** are being applied
4. **Check CSS variable values** in browser DevTools
5. **Test keyboard navigation** manually
6. **Validate ARIA attributes** with accessibility tools

## Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Tailwind UI Components](https://tailwindui.com)
- [Headless UI](https://headlessui.com)
- [Heroicons](https://heroicons.com)
- [Tailwind Play](https://play.tailwindcss.com)
- [Tailwind Community](https://github.com/tailwindlabs/tailwindcss/discussions)

Remember: **Utility-first, mobile-first, performance-first. Embrace constraints, compose with utilities, and maintain consistency!**

# shadcn/ui Development Assistant

*Combined from: Next.js 15, shadcn/ui, Tailwind CSS*

You are an expert Next.js 15 developer with deep knowledge of the App Router, React Server Components, and modern web development best practices.
You are an expert shadcn/ui developer with deep knowledge of React component architecture, Tailwind CSS, Radix UI primitives, and modern web accessibility standards. You specialize in building beautiful, accessible, and performant UI components following shadcn/ui patterns and conventions.
You are an expert in Tailwind CSS with deep knowledge of utility-first styling, responsive design, component patterns, and modern CSS architecture.

## 1. Server Components First

- **Default to Server Components** - Only use Client Components when you need interactivity
- **Data fetching on the server** - Direct database access, no API routes needed for SSR
- **Zero client-side JavaScript** for static content
- **Async components** are supported and encouraged

## 4. Caching Strategy

- Use `fetch()` with Next.js extensions for HTTP caching
- Configure with `{ next: { revalidate: 3600, tags: ['products'] } }`
- Use `revalidatePath()` and `revalidateTag()` for on-demand updates
- Consider `unstable_cache()` for expensive computations

## Development

*Combined from: Next.js 15, shadcn/ui*

```bash
npm run dev          # Start dev server with hot reload
npm run dev:turbo    # Start with Turbopack (faster)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # TypeScript validation
````

## Code Generation

```bash
npx create-next-app@latest  # Create new app
npx @next/codemod@latest    # Run codemods for upgrades
```

## Project Structure

```text
app/
├── (auth)/          # Route group (doesn't affect URL)
├── api/             # API routes
│   └── route.ts     # Handler for /api
├── products/
│   ├── [id]/        # Dynamic route
│   │   ├── page.tsx
│   │   ├── loading.tsx
│   │   └── error.tsx
│   └── page.tsx
├── layout.tsx       # Root layout
├── page.tsx         # Home page
└── globals.css      # Global styles
```

## Server Action with Form

```typescript
// actions.ts
'use server';
export async function createItem(prevState: any, formData: FormData) {
  // Validate, mutate, revalidate
  const validated = schema.parse(Object.fromEntries(formData));
  await db.items.create({ data: validated });
  revalidatePath('/items');
}

// form.tsx
'use client';
import { useActionState } from 'react';
export function Form() {
  const [state, formAction] = useActionState(createItem, {});
  return <form action={formAction}>...</form>;
}
```

## Optimistic Updates

```typescript
"use client"
import { useOptimistic } from "react"
export function OptimisticList({ items, addItem }) {
    const [optimisticItems, addOptimisticItem] = useOptimistic(
        items,
        (state, newItem) => [...state, newItem]
    )
    // Use optimisticItems for immediate UI update
}
```

## Memory Integration

This CLAUDE.md follows Claude Code memory management patterns:

- **Project memory** - Shared shadcn/ui component patterns with team
- **Component library** - Reusable UI component definitions
- **Design system** - Consistent styling and accessibility standards
- **Auto-discovery** - Loaded when working with components/ui/ files

## Available Commands

_Combined from: shadcn/ui, Tailwind CSS_

Project-specific slash commands for shadcn/ui development:

- `/shadcn-add [component]` - Add shadcn/ui component to project
- `/shadcn-theme [variant]` - Update theme configuration
- `/shadcn-custom [name]` - Create custom component following patterns
- `/shadcn-compose [components]` - Compose complex component from primitives
- `/shadcn-test [component]` - Generate accessibility and unit tests
  Project-specific slash commands for Tailwind development:
- `/tw-component [name]` - Generate component with utility classes
- `/tw-responsive [breakpoints]` - Create responsive design patterns
- `/tw-theme [section]` - Update tailwind.config.js theme
- `/tw-plugin [name]` - Add and configure Tailwind plugin
- `/tw-optimize` - Analyze and optimize CSS bundle size

## Core Technologies

- **React 18/19** - Component framework
- **TypeScript** - Type-safe development
- **Tailwind CSS v3.4+** - Utility-first styling
- **Radix UI** - Unstyled, accessible primitives
- **Class Variance Authority (CVA)** - Component variants
- **tailwind-merge** - Intelligent class merging
- **clsx** - Conditional classes
- **Lucide React** - Icon system

## Framework Support

- **Next.js 13-15** (App Router preferred)
- **Vite** with React
- **Remix** with React Router
- **Astro** with React integration
- **Laravel** with Inertia.js
- **TanStack Router/Start**
- **React Router**

## 1. Copy-Paste Architecture

- **No npm package** - Components are copied into your project
- **Full ownership** - The code is yours to modify
- **Direct customization** - Edit components directly
- **No abstraction layers** - See exactly what's happening

## 2. Component Anatomy

Every component follows this structure:

```tsx
// Root component with forwardRef
const Component = React.forwardRef<HTMLElement, ComponentProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div"
    return (
      <Comp
        ref={ref}
        className={cn(componentVariants({ variant, size, className }))}
        {...props}
      />
    )
  }
)
Component.displayName = "Component"

// Sub-components for composition
const ComponentTrigger = React.forwardRef<...>()
const ComponentContent = React.forwardRef<...>()
const ComponentItem = React.forwardRef<...>()

// Export all parts
export { Component, ComponentTrigger, ComponentContent, ComponentItem }
```

# CLI installation (recommended)

npx shadcn@latest init
npx shadcn@latest add [component]

# 3. Update imports

````

## 4. File Structure

```text
components/
└── ui/
    ├── accordion.tsx
    ├── alert-dialog.tsx
    ├── alert.tsx
    ├── button.tsx
    ├── card.tsx
    ├── dialog.tsx
    ├── form.tsx
    ├── input.tsx
    ├── label.tsx
    ├── select.tsx
    └── ...
lib/
└── utils.ts        # cn() helper function
````

## 1. Variant System with CVA

```tsx
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                default:
                    "bg-primary text-primary-foreground shadow hover:bg-primary/90",
                destructive:
                    "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
                outline:
                    "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
                secondary:
                    "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
                ghost: "hover:bg-accent hover:text-accent-foreground",
                link: "text-primary underline-offset-4 hover:underline",
            },
            size: {
                default: "h-9 px-4 py-2",
                sm: "h-8 rounded-md px-3 text-xs",
                lg: "h-10 rounded-md px-8",
                icon: "h-9 w-9",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)
```

## 2. Polymorphic Components with asChild

```tsx
import { Slot } from "@radix-ui/react-slot"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return <Comp ref={ref} className={cn(...)} {...props} />
  }
)
```

## 3. Controlled/Uncontrolled Pattern

```tsx
// Controlled
<Select value={value} onValueChange={setValue}>
  <SelectTrigger>...</SelectTrigger>
  <SelectContent>...</SelectContent>
</Select>

// Uncontrolled
<Select defaultValue="apple">
  <SelectTrigger>...</SelectTrigger>
  <SelectContent>...</SelectContent>
</Select>
```

## 4. Form Integration with React Hook Form

```tsx
<Form {...form}>
    <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
            <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                    <Input placeholder="email@example.com" {...field} />
                </FormControl>
                <FormDescription>Enter your email address</FormDescription>
                <FormMessage />
            </FormItem>
        )}
    />
</Form>
```

## CSS Variables Structure

```css
@layer base {
    :root {
        --background: 0 0% 100%;
        --foreground: 222.2 84% 4.9%;
        --card: 0 0% 100%;
        --card-foreground: 222.2 84% 4.9%;
        --popover: 0 0% 100%;
        --popover-foreground: 222.2 84% 4.9%;
        --primary: 222.2 47.4% 11.2%;
        --primary-foreground: 210 40% 98%;
        --secondary: 210 40% 96.1%;
        --secondary-foreground: 222.2 47.4% 11.2%;
        --muted: 210 40% 96.1%;
        --muted-foreground: 215.4 16.3% 46.9%;
        --accent: 210 40% 96.1%;
        --accent-foreground: 222.2 47.4% 11.2%;
        --destructive: 0 84.2% 60.2%;
        --destructive-foreground: 210 40% 98%;
        --border: 214.3 31.8% 91.4%;
        --input: 214.3 31.8% 91.4%;
        --ring: 222.2 84% 4.9%;
        --radius: 0.5rem;
    }

    .dark {
        --background: 222.2 84% 4.9%;
        --foreground: 210 40% 98%;
        /* ... dark theme variables ... */
    }
}
```

## Color Convention

- Each color has a **base** and **foreground** variant
- Base: Background color
- Foreground: Text color on that background
- Ensures proper contrast automatically

## 1. ARIA Attributes

```tsx
// Proper ARIA labeling
<Dialog>
    <DialogTrigger asChild>
        <Button>Open</Button>
    </DialogTrigger>
    <DialogContent>
        <DialogHeader>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>
                Description for screen readers
            </DialogDescription>
        </DialogHeader>
    </DialogContent>
</Dialog>
```

## 2. Keyboard Navigation

All components support:

- **Tab/Shift+Tab** - Focus navigation
- **Enter/Space** - Activation
- **Escape** - Close/cancel
- **Arrow keys** - List navigation
- **Home/End** - Boundary navigation

## 3. Focus Management

```tsx
// Visible focus indicators
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

// Focus trap in modals
<FocusTrap>
  <DialogContent>...</DialogContent>
</FocusTrap>
```

## 1. Tables with TanStack Table

```tsx
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
})

<Table>
  <TableHeader>
    {table.getHeaderGroups().map((headerGroup) => (
      <TableRow key={headerGroup.id}>
        {headerGroup.headers.map((header) => (
          <TableHead key={header.id}>
            {flexRender(header.column.columnDef.header, header.getContext())}
          </TableHead>
        ))}
      </TableRow>
    ))}
  </TableHeader>
  <TableBody>
    {table.getRowModel().rows.map((row) => (
      <TableRow key={row.id}>
        {row.getVisibleCells().map((cell) => (
          <TableCell key={cell.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
    ))}
  </TableBody>
</Table>
```

## 2. Charts with Recharts

```tsx
<ChartContainer config={chartConfig}>
    <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <ChartTooltip />
        <Area
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--chart-1))"
            fill="hsl(var(--chart-1))"
        />
    </AreaChart>
</ChartContainer>
```

# Initialize shadcn/ui

npx shadcn@latest init

# Add components

npx shadcn@latest add button card dialog form

# Add all components

npx shadcn@latest add --all

# Update components

npx shadcn@latest add button --overwrite

# Build custom registry

npx shadcn@latest build

````

## Component Development

```bash

# Development server

npm run dev

# Type checking

npm run type-check

# Linting

npm run lint

# Build

npm run build
````

## 1. Bundle Size

- Only import what you use
- Components are tree-shakeable
- No runtime overhead from library

## 2. Code Splitting

```tsx
// Lazy load heavy components
const HeavyChart = lazy(() => import('@/components/ui/chart'))

<Suspense fallback={<Skeleton />}>
  <HeavyChart />
</Suspense>
```

## Form Controls

- Input, Textarea, Select, Checkbox, RadioGroup, Switch
- Slider, DatePicker, Form, Label

## Overlays

- Dialog, AlertDialog, Sheet, Popover
- DropdownMenu, ContextMenu, Tooltip, HoverCard

## Navigation

- NavigationMenu, Tabs, Breadcrumb
- Pagination, Sidebar

## Data Display

- Table, DataTable, Card, Badge
- Avatar, Chart, Progress

## Layout

- Accordion, Collapsible, ResizablePanels
- ScrollArea, Separator, AspectRatio

## Feedback

- Alert, Toast (Sonner), Skeleton
- Progress, Loading states

## 1. Utility-First Methodology

- **Use utility classes** for styling instead of custom CSS
- **Compose complex components** from simple utilities
- **Maintain consistency** with predefined design tokens
- **Optimize for performance** with automatic CSS purging
- **Embrace constraints** of the design system

## 2. Responsive Design

- **Mobile-first approach** with `sm:`, `md:`, `lg:`, `xl:`, `2xl:` breakpoints
- **Consistent breakpoint usage** across the application
- **Responsive typography** and spacing
- **Flexible grid systems** with CSS Grid and Flexbox
- **Responsive images** and media handling

## 3. Design System Integration

- **Custom color palettes** defined in configuration
- **Consistent spacing scale** using rem units
- **Typography hierarchy** with font sizes and line heights
- **Shadow and border radius** system for depth
- **Animation and transition** utilities for micro-interactions

## Basic Tailwind Config Example

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            // Custom configuration here
        },
    },
    plugins: [],
}
```

## Design System Configuration Example

```javascript
// tailwind.config.js
module.exports = {
    content: ["./src/**/*.{js,ts,jsx,tsx}"],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                brand: {
                    50: "#f0f9ff",
                    100: "#e0f2fe",
                    200: "#bae6fd",
                    300: "#7dd3fc",
                    400: "#38bdf8",
                    500: "#0ea5e9",
                    600: "#0284c7",
                    700: "#0369a1",
                    800: "#075985",
                    900: "#0c4a6e",
                    950: "#082f49",
                },
                gray: {
                    50: "#f9fafb",
                    100: "#f3f4f6",
                    200: "#e5e7eb",
                    300: "#d1d5db",
                    400: "#9ca3af",
                    500: "#6b7280",
                    600: "#4b5563",
                    700: "#374151",
                    800: "#1f2937",
                    900: "#111827",
                    950: "#030712",
                },
            },
            fontFamily: {
                sans: ["Inter", "system-ui", "sans-serif"],
                mono: ["JetBrains Mono", "Consolas", "monospace"],
            },
            spacing: {
                18: "4.5rem",
                88: "22rem",
            },
            animation: {
                "fade-in": "fadeIn 0.5s ease-in-out",
                "slide-up": "slideUp 0.3s ease-out",
                "bounce-gentle": "bounceGentle 2s infinite",
            },
            keyframes: {
                fadeIn: {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" },
                },
                slideUp: {
                    "0%": { transform: "translateY(10px)", opacity: "0" },
                    "100%": { transform: "translateY(0)", opacity: "1" },
                },
                bounceGentle: {
                    "0%, 100%": { transform: "translateY(-5%)" },
                    "50%": { transform: "translateY(0)" },
                },
            },
        },
    },
    plugins: [
        require("@tailwindcss/typography"),
        require("@tailwindcss/forms"),
        require("@tailwindcss/aspect-ratio"),
        require("@tailwindcss/container-queries"),
    ],
}
```

## Advanced Configuration with CSS Variables

```javascript
// tailwind.config.js
module.exports = {
    theme: {
        extend: {
            colors: {
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
        },
    },
}
```

## Layout Components

```jsx
// Responsive Container
function Container({ children, className = "" }) {
    return (
        <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>
            {children}
        </div>
    )
}

// Responsive Grid
function Grid({ children, cols = 1, className = "" }) {
    const colsMap = {
        1: "grid-cols-1",
        2: "grid-cols-1 md:grid-cols-2",
        3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
        4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
    }

    return (
        <div className={`grid gap-6 ${colsMap[cols]} ${className}`}>
            {children}
        </div>
    )
}

// Responsive Stack
function Stack({ children, spacing = "md", className = "" }) {
    const spacingMap = {
        sm: "space-y-2",
        md: "space-y-4",
        lg: "space-y-6",
        xl: "space-y-8",
    }

    return (
        <div className={`flex flex-col ${spacingMap[spacing]} ${className}`}>
            {children}
        </div>
    )
}
```

## Interactive Components

```jsx
// Animated Button
function Button({
    children,
    variant = "primary",
    size = "md",
    className = "",
    ...props
}) {
    const baseClasses =
        "inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"

    const variants = {
        primary:
            "bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-500",
        secondary:
            "bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-500",
        outline:
            "border border-gray-300 bg-transparent hover:bg-gray-50 focus-visible:ring-gray-500",
        ghost: "hover:bg-gray-100 focus-visible:ring-gray-500",
    }

    const sizes = {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4",
        lg: "h-11 px-6 text-lg",
    }

    return (
        <button
            className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
            {...props}
        >
            {children}
        </button>
    )
}

// Card Component
function Card({ children, className = "", hover = false }) {
    return (
        <div
            className={`
      rounded-lg border border-gray-200 bg-white p-6 shadow-sm
      ${hover ? "transition-shadow hover:shadow-md" : ""}
      dark:border-gray-800 dark:bg-gray-900
      ${className}
    `}
        >
            {children}
        </div>
    )
}
```

## Form Components

```jsx
// Input Field
function Input({ label, error, className = "", ...props }) {
    return (
        <div className="space-y-1">
            {label && (
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {label}
                </label>
            )}
            <input
                className={`
          block w-full rounded-md border border-gray-300 px-3 py-2 text-sm
          placeholder-gray-400 shadow-sm transition-colors
          focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500
          disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500
          dark:border-gray-600 dark:bg-gray-800 dark:text-white
          dark:placeholder-gray-500 dark:focus:border-brand-400
          ${error ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}
          ${className}
        `}
                {...props}
            />
            {error && (
                <p className="text-sm text-red-600 dark:text-red-400">
                    {error}
                </p>
            )}
        </div>
    )
}

// Select Field
function Select({ label, error, children, className = "", ...props }) {
    return (
        <div className="space-y-1">
            {label && (
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {label}
                </label>
            )}
            <select
                className={`
          block w-full rounded-md border border-gray-300 px-3 py-2 text-sm
          shadow-sm transition-colors focus:border-brand-500 focus:outline-none
          focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed
          disabled:bg-gray-50 disabled:text-gray-500
          dark:border-gray-600 dark:bg-gray-800 dark:text-white
          dark:focus:border-brand-400
          ${error ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}
          ${className}
        `}
                {...props}
            >
                {children}
            </select>
            {error && (
                <p className="text-sm text-red-600 dark:text-red-400">
                    {error}
                </p>
            )}
        </div>
    )
}
```

## Mobile-First Approach

```jsx
// Responsive Navigation
function Navigation() {
    return (
        <nav
            className="
      flex flex-col space-y-4
      md:flex-row md:items-center md:space-x-6 md:space-y-0
    "
        >
            <a
                href="/"
                className="
        text-gray-700 hover:text-brand-600
        md:text-sm
        lg:text-base
      "
            >
                Home
            </a>
            <a
                href="/about"
                className="
        text-gray-700 hover:text-brand-600
        md:text-sm
        lg:text-base
      "
            >
                About
            </a>
        </nav>
    )
}

// Responsive Hero Section
function Hero() {
    return (
        <section
            className="
      px-4 py-12 text-center
      sm:px-6 sm:py-16
      md:py-20
      lg:px-8 lg:py-24
      xl:py-32
    "
        >
            <h1
                className="
        text-3xl font-bold tracking-tight text-gray-900
        sm:text-4xl
        md:text-5xl
        lg:text-6xl
        xl:text-7xl
      "
            >
                Welcome to Our Site
            </h1>
            <p
                className="
        mt-4 text-lg text-gray-600
        sm:mt-6 sm:text-xl
        lg:mt-8 lg:text-2xl
      "
            >
                Building amazing experiences with Tailwind CSS
            </p>
        </section>
    )
}
```

## Container Queries

```jsx
// Using container queries for component-level responsiveness
function ProductCard() {
    return (
        <div className="@container">
            <div
                className="
        flex flex-col space-y-4
        @md:flex-row @md:space-x-4 @md:space-y-0
        @lg:space-x-6
      "
            >
                <img
                    className="
          h-48 w-full object-cover
          @md:h-32 @md:w-32
          @lg:h-40 @lg:w-40
        "
                />
                <div className="flex-1">
                    <h3
                        className="
            text-lg font-semibold
            @lg:text-xl
          "
                    >
                        Product Name
                    </h3>
                </div>
            </div>
        </div>
    )
}
```

## CSS Variables Approach

```css
/* globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
    :root {
        --background: 0 0% 100%;
        --foreground: 222.2 84% 4.9%;
        --primary: 221.2 83.2% 53.3%;
        --primary-foreground: 210 40% 98%;
        --secondary: 210 40% 96%;
        --secondary-foreground: 222.2 84% 4.9%;
    }

    .dark {
        --background: 222.2 84% 4.9%;
        --foreground: 210 40% 98%;
        --primary: 217.2 91.2% 59.8%;
        --primary-foreground: 222.2 84% 4.9%;
        --secondary: 217.2 32.6% 17.5%;
        --secondary-foreground: 210 40% 98%;
    }
}
```

## Theme Toggle Component

```jsx
// Theme toggle with smooth transitions
function ThemeToggle() {
    const [theme, setTheme] = useState("light")

    const toggleTheme = () => {
        const newTheme = theme === "light" ? "dark" : "light"
        setTheme(newTheme)
        document.documentElement.classList.toggle("dark", newTheme === "dark")
    }

    return (
        <button
            onClick={toggleTheme}
            className="
        rounded-lg p-2 transition-colors duration-200
        hover:bg-gray-100 dark:hover:bg-gray-800
        focus:outline-none focus:ring-2 focus:ring-brand-500
      "
            aria-label="Toggle theme"
        >
            {theme === "light" ? (
                <MoonIcon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            ) : (
                <SunIcon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            )}
        </button>
    )
}
```

## Content Configuration

```javascript
// Optimized content paths for better purging
module.exports = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/**/*.{js,ts,jsx,tsx,mdx}",
        // Include node_modules if using component libraries
        "./node_modules/@my-ui-lib/**/*.{js,ts,jsx,tsx}",
    ],
    safelist: [
        // Keep dynamic classes that might be missed by purging
        {
            pattern: /bg-(red|green|blue)-(100|500|900)/,
            variants: ["hover", "focus"],
        },
    ],
}
```

## Custom Utilities

```css
/* Custom utilities for common patterns */
@layer utilities {
    .text-balance {
        text-wrap: balance;
    }

    .animation-delay-200 {
        animation-delay: 200ms;
    }

    .animation-delay-400 {
        animation-delay: 400ms;
    }

    .mask-gradient-to-r {
        mask-image: linear-gradient(
            to right,
            transparent,
            black 20%,
            black 80%,
            transparent
        );
    }
}
```

## Component Layer

```css
@layer components {
    .btn {
        @apply inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50;
    }

    .btn-primary {
        @apply bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-500;
    }

    .card {
        @apply rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900;
    }

    .input {
        @apply block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white;
    }
}
```

## Custom Animations

```javascript
// Advanced animations in Tailwind config
module.exports = {
    theme: {
        extend: {
            animation: {
                "spin-slow": "spin 3s linear infinite",
                "pulse-fast": "pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                "bounce-x": "bounceX 1s infinite",
                "fade-in-up": "fadeInUp 0.5s ease-out",
                "slide-in-right": "slideInRight 0.3s ease-out",
                "scale-in": "scaleIn 0.2s ease-out",
            },
            keyframes: {
                bounceX: {
                    "0%, 100%": { transform: "translateX(-25%)" },
                    "50%": { transform: "translateX(0)" },
                },
                fadeInUp: {
                    "0%": { opacity: "0", transform: "translateY(20px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                slideInRight: {
                    "0%": { opacity: "0", transform: "translateX(20px)" },
                    "100%": { opacity: "1", transform: "translateX(0)" },
                },
                scaleIn: {
                    "0%": { opacity: "0", transform: "scale(0.95)" },
                    "100%": { opacity: "1", transform: "scale(1)" },
                },
            },
        },
    },
}
```

## Staggered Animations

```jsx
// Staggered animation component
function StaggeredList({ items }) {
    return (
        <div className="space-y-4">
            {items.map((item, index) => (
                <div
                    key={item.id}
                    className={`
            animate-fade-in-up opacity-0
            animation-delay-${index * 100}
          `}
                    style={{ animationFillMode: "forwards" }}
                >
                    {item.content}
                </div>
            ))}
        </div>
    )
}
```

## Truncated Text

```jsx
// Text truncation with tooltips
function TruncatedText({ text, maxLength = 100 }) {
  const truncated = text.length > maxLength;
  const displayText = truncated ? `${text.slice(0, maxLength)}...` : text;

  return (
    <span
      className={`${truncated ? 'cursor-help' : ''}`}
      title={truncated ? text : undefined}
    >
      {displayText}
    </span>
  );
}

// CSS-only truncation
function CSSLimTruncate() {
  return (
    <p className="truncate">This text will be truncated if it's too long</p>
    // Or for multiple lines:
    <p className="line-clamp-3">
      This text will be clamped to 3 lines and show ellipsis
    </p>
  );
}
```

## Aspect Ratio Containers

```jsx
// Responsive aspect ratio containers
function AspectRatioImage({ src, alt, ratio = "aspect-video" }) {
    return (
        <div className={`relative overflow-hidden rounded-lg ${ratio}`}>
            <img
                src={src}
                alt={alt}
                className="absolute inset-0 h-full w-full object-cover"
            />
        </div>
    )
}

// Custom aspect ratios
function CustomAspectRatio() {
    return (
        <div className="aspect-[4/3]">
            {/* Content with 4:3 aspect ratio */}
        </div>
    )
}
```

## Focus Management

```jsx
// Accessible focus styles
function FocusExample() {
    return (
        <div className="space-y-4">
            <button
                className="
        rounded-md bg-brand-600 px-4 py-2 text-white
        focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
        focus-visible:ring-2 focus-visible:ring-brand-500
      "
            >
                Accessible Button
            </button>

            <input
                className="
        rounded-md border border-gray-300 px-3 py-2
        focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500
        invalid:border-red-500 invalid:focus:border-red-500 invalid:focus:ring-red-500
      "
            />
        </div>
    )
}
```

## Typography Plugin

```javascript
// @tailwindcss/typography configuration
module.exports = {
    plugins: [
        require("@tailwindcss/typography")({
            className: "prose",
        }),
    ],
    theme: {
        extend: {
            typography: {
                DEFAULT: {
                    css: {
                        maxWidth: "none",
                        color: "inherit",
                        a: {
                            color: "inherit",
                            textDecoration: "none",
                            fontWeight: "500",
                        },
                        "a:hover": {
                            color: "#0ea5e9",
                        },
                    },
                },
            },
        },
    },
}
```

## Forms Plugin

```javascript
// @tailwindcss/forms configuration
module.exports = {
    plugins: [
        require("@tailwindcss/forms")({
            strategy: "class", // or 'base'
        }),
    ],
}
```

---

## Configuration Metadata

### Included Configurations

- **Next.js 15** v15.0.0: Next.js 15 with App Router, React 19, and Server Components
- **shadcn/ui** v0.8.0: Beautiful, accessible components with Radix UI and Tailwind CSS
- **Tailwind CSS** v3.4.0: Utility-first CSS framework for rapid UI development

### Dependencies

#### Required Engines

- **node**: >=18.17.0, >=18.0.0

#### Peer Dependencies

These packages should be installed in your project:

- **next**: >=15.0.0
- **react**: >=19.0.0 or >=18.0.0
- **react-dom**: >=19.0.0 or >=18.0.0
- **typescript**: >=5.0.0
- **tailwindcss**: >=3.4.0
- **postcss**: >=8.0.0
- **autoprefixer**: >=10.0.0
