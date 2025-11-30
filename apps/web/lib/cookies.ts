export const LAYOUT_COOKIE_NAME = "react-resizable-panels:layout"

export function getLayoutFromCookie(cookieValue: string | undefined, defaultValue: number[] = [35, 65]): number[] {
    if (!cookieValue) return defaultValue
    try {
        return JSON.parse(cookieValue)
    } catch (error) {
        return defaultValue
    }
}

export function setLayoutCookie(layout: number[]) {
    document.cookie = `${LAYOUT_COOKIE_NAME}=${JSON.stringify(layout)}; path=/; max-age=31536000; SameSite=Lax`
}
