// Pass `hostname` explicitly from server contexts (middleware, route handlers)
// where `window` doesn't exist — e.g. isCloudProd(request.nextUrl.hostname).
// Falls back to NEXT_PUBLIC_APP_URL when neither is available (e.g. Sentry's
// server/edge config, which runs at module-init time before any request exists).
export function isCloudProd(hostname?: string) {
    const host =
        hostname ??
        (typeof window === "undefined"
            ? safeHostname(process.env.NEXT_PUBLIC_APP_URL)
            : window.location.hostname)
    return host === "app.readspace.ai"
}

function safeHostname(url: string | undefined) {
    if (!url) return undefined
    try {
        return new URL(url).hostname
    } catch {
        return undefined
    }
}
