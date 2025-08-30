import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Readspace",
        short_name: "Readspace",
        description: "All your reading in one place — a privacy-friendly inbox for RSS, newsletters, threads, and books.",
        start_url: "/articles",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#6A994E",
        scope: "/",
        icons: [
            {
                src: "/android-chrome-192x192.png",
                sizes: "192x192",
                type: "image/png",
            },
            {
                src: "/android-chrome-512x512.png",
                sizes: "512x512",
                type: "image/png",
            },
            {
                src: "/apple-touch-icon.png",
                sizes: "180x180",
                type: "image/png",
            },
        ],
    }
}
