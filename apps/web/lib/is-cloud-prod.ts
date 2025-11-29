export function isCloudProd() {
    if (typeof window === "undefined") return false
    return window.location.hostname === "app.readspace.ai"
}
