// Pass `hostname` explicitly from server contexts (middleware, route handlers)
// where `window` doesn't exist — e.g. isCloudProd(request.nextUrl.hostname).
export function isCloudProd(hostname?: string) {
    const host =
        hostname ??
        (typeof window === "undefined" ? undefined : window.location.hostname)
    return host === "app.readspace.ai"
}
