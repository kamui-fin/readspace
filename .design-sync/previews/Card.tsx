import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
} from '@readspace/web';

/** The canonical card: header (title + description), content, footer action.
 *  Flat paper surface, hairline border, barely-there shadow. */
export function Default() {
  return (
    <Card style={{ maxWidth: 380 }}>
      <CardHeader>
        <CardTitle>Similar feeds</CardTitle>
        <CardDescription>Three sources cover topics close to this feed.</CardDescription>
      </CardHeader>
      <CardContent>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
          Following a feed adds its articles to your inbox in chronological order — no algorithm, no
          reordering.
        </p>
      </CardContent>
      <CardFooter>
        <Button size="sm">Follow all</Button>
      </CardFooter>
    </Card>
  );
}

/** Header + content only — the common list-item / settings-block shape. */
export function HeaderOnly() {
  return (
    <Card style={{ maxWidth: 380 }}>
      <CardHeader>
        <CardTitle>Reading preferences</CardTitle>
        <CardDescription>Applies to every article you open.</CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
          <span>Font size</span>
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>Large</span>
        </div>
      </CardContent>
    </Card>
  );
}

/** Bare card with arbitrary content — no header/footer sub-parts. */
export function Plain() {
  return (
    <Card style={{ maxWidth: 380, padding: 20 }}>
      <div style={{ fontSize: 14, lineHeight: 1.5 }}>
        <strong>12 articles</strong> from <strong>8 sources</strong> covered this story today.
      </div>
    </Card>
  );
}
