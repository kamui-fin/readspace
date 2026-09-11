import { Badge } from '@readspace/web';

/** The default forest-green badge — the emphasis chip (a plan tier, a "New" marker). */
export function Default() {
  return <Badge>Pro</Badge>;
}

/** Every variant side by side. `default` and `secondary` are the two greens; `accent` is
 *  the quiet informational chip; `success` / `orange` / `destructive` are status. */
export function Variants() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="accent">3 unread</Badge>
      <Badge variant="success">Synced</Badge>
      <Badge variant="orange">Beta</Badge>
      <Badge variant="destructive">Failed</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  );
}

/** Realistic use: status pills next to a feed name in a management list. */
export function InContext() {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 10, font: '14px/1.4 Geist, system-ui' }}>
      <span style={{ fontWeight: 600 }}>Stratechery</span>
      <Badge variant="accent">42 unread</Badge>
      <Badge variant="success">Active</Badge>
    </div>
  );
}
