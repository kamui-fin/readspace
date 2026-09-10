import { Input } from "@readspace/web"

/** The default field: 36px tall, 6px radius, hairline border, transparent background
 *  (it sits on whatever surface holds it). */
export function Default() {
  return (
    <div style={{ width: 320 }}>
      <Input placeholder="Search feeds" />
    </div>
  )
}

/** With a value filled in. */
export function Filled() {
  return (
    <div style={{ width: 320 }}>
      <Input defaultValue="https://stratechery.com/feed/" />
    </div>
  )
}

/** Common types: text, search, email, password. */
export function Types() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 320 }}>
      <Input type="text" placeholder="Folder name" />
      <Input type="search" placeholder="Search" />
      <Input type="email" placeholder="you@example.com" />
      <Input type="password" defaultValue="supersecret" />
    </div>
  )
}

/** Invalid + disabled states. `aria-invalid` adds the destructive ring and border. */
export function States() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 320 }}>
      <Input aria-invalid defaultValue="not-a-url" />
      <Input disabled placeholder="Disabled" />
    </div>
  )
}

/** Realistic use: a labelled field in a form row. */
export function InContext() {
  return (
    <label style={{ display: "block", width: 320, font: "14px/1.5 Geist, system-ui" }}>
      <span style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>Feed URL</span>
      <Input placeholder="https://example.com/feed.xml" />
    </label>
  )
}
