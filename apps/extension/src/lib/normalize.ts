import normalizeUrl from 'normalize-url'

export function normalizeKey(url: string) {
    return normalizeUrl(url, {
        stripWWW: false,
        removeTrailingSlash: true,
        stripHash: true,
        removeDirectoryIndex: true,
        stripProtocol: false, // include protocol (http/https) or change based on your needs
    })
}
