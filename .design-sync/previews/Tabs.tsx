import { Tabs, TabsList, TabsTrigger, TabsContent } from '@readspace/web';

/** The canonical tab group: a muted-track pill list, the active tab a
 *  background-filled pill with a faint lift. */
export function Default() {
  return (
    <Tabs defaultValue="all" style={{ width: 420 }}>
      <TabsList>
        <TabsTrigger value="all">All</TabsTrigger>
        <TabsTrigger value="unread">Unread</TabsTrigger>
        <TabsTrigger value="saved">Saved</TabsTrigger>
      </TabsList>
      <TabsContent value="all">
        <p style={{ fontSize: 14, lineHeight: 1.5 }}>
          Every article from your feeds, newest first.
        </p>
      </TabsContent>
      <TabsContent value="unread">
        <p style={{ fontSize: 14, lineHeight: 1.5 }}>Only what you haven't read yet.</p>
      </TabsContent>
      <TabsContent value="saved">
        <p style={{ fontSize: 14, lineHeight: 1.5 }}>Articles you saved to read later.</p>
      </TabsContent>
    </Tabs>
  );
}

/** Two-tab reader toolbar variant — a tighter list used inline above content. */
export function Compact() {
  return (
    <Tabs defaultValue="original" style={{ width: 320 }}>
      <TabsList>
        <TabsTrigger value="original">Original</TabsTrigger>
        <TabsTrigger value="reader">Reader</TabsTrigger>
      </TabsList>
      <TabsContent value="original">
        <p style={{ fontSize: 14 }}>The feed's own HTML, unmodified.</p>
      </TabsContent>
      <TabsContent value="reader">
        <p style={{ fontSize: 14 }}>Extracted article text in the reading serif.</p>
      </TabsContent>
    </Tabs>
  );
}
