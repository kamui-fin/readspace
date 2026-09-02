import { Toaster } from "@/components/ui/toaster"
import { Metadata, Viewport } from "next"
import { Figtree, Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { PostHogProvider } from "./providers"

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
})

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
})

const figtree = Figtree({
    variable: "--font-figtree",
    subsets: ["latin"],
})

// Define base URL for absolute URLs
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://readspace.ai"

export const metadata: Metadata = {
    title: "Readspace | AI that makes reading stick",
    description:
        "Stop forgetting what you read. Whether tackling complex technical material, philosophy, or business strategy, Readspace transforms reading into an active process.",
    metadataBase: new URL(baseUrl),
    generator: "Next.js",
    applicationName: "Readspace",
    referrer: "origin-when-cross-origin",
    keywords: [
        "reading",
        "AI",
        "learning",
        "retention",
        "knowledge management",
    ],
    authors: [{ name: "Readspace Team" }],
    creator: "Readspace",
    publisher: "Readspace",
    formatDetection: {
        email: false,
        telephone: false,
        address: false,
    },
    icons: {
        icon: [
            { url: "/favicon.ico", sizes: "any" },
            { url: "/icon.svg", type: "image/svg+xml" },
        ],
        apple: [{ url: "/apple-touch-icon.png" }],
    },
    openGraph: {
        title: "Readspace | AI that makes reading stick",
        description:
            "Stop forgetting what you read. Whether tackling complex technical material, philosophy, or business strategy, Readspace transforms reading into an active process.",
        url: baseUrl,
        siteName: "Readspace",
        images: [
            {
                url: "/banner.png",
                width: 1200,
                height: 630,
                alt: "Readspace - AI that makes reading stick",
            },
        ],
        locale: "en_US",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Readspace | AI that makes reading stick",
        description:
            "Stop forgetting what you read. Whether tackling complex technical material, philosophy, or business strategy, Readspace transforms reading into an active process.",
        images: ["/banner.png"],
        creator: "@readspace",
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
        },
    },
}

// Define viewport settings
export const viewport: Viewport = {
    themeColor: "#6A994E",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
}

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang="en">
            <body
                className={`${geistSans.variable} ${geistMono.variable} ${figtree.variable} font-sans antialiased mt-0`}
            >
                <PostHogProvider>{children}</PostHogProvider>
                <Toaster />
            </body>
        </html>
    )
}
