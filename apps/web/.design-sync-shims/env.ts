// design-sync shim: the real @/env (@t3-oss/env-nextjs createEnv) validates required
// NEXT_PUBLIC_* vars at import and throws outside a Next build. The scoped UI primitives
// (Button/Card/Input/Badge/Tabs) only use `cn`, which never reads env.
export const env: Record<string, string | undefined> = new Proxy(
    {},
    { get: () => undefined }
)
