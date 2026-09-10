import { Button } from "@readspace/web"

/** The primary action: forest-green fill, rationed to one per view. */
export function Default() {
  return <Button>Add feed</Button>
}

/** Every variant. `default` is the one green action; `secondary` the meadow green;
 *  `outline` / `ghost` wash to the sage hover surface; `link` is an inline text action;
 *  `destructive` is the signal red. */
export function Variants() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
      <Button variant="default">Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
      <Button variant="destructive">Delete</Button>
    </div>
  )
}

/** The size scale: sm (36px), default (40px), lg (44px), and a square icon button. */
export function Sizes() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Add">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </Button>
    </div>
  )
}

/** Disabled state — 50% opacity, no pointer events. */
export function Disabled() {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <Button disabled>Add feed</Button>
      <Button variant="outline" disabled>
        Cancel
      </Button>
    </div>
  )
}

/** Realistic use: a form's primary + secondary action pair. */
export function InContext() {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", width: 320 }}>
      <Button variant="ghost">Cancel</Button>
      <Button>Save changes</Button>
    </div>
  )
}
