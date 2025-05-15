import { Metadata, Viewport } from "next"
import { EB_Garamond, Figtree, Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const geistSans = Geist({
    variable: "--font-sans",
    subsets: ["latin"],
})

const geistMono = Geist_Mono({
    variable: "--font-mono",
    subsets: ["latin"],
})

const eb_garamond = EB_Garamond({
    variable: "--font-garamond-serif",
    subsets: ["latin"],
})

const logo = Figtree({
    variable: "--font-logo",
    subsets: ["latin"],
})

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://beta.readspace.ai"

export const metadata: Metadata = {
    title: "Readspace Beta | Your AI-powered reading workspace",
    description:
        "Access your personalized reading space powered by AI. Read, understand, and retain what matters — all in one place.",
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
        title: "Readspace Beta | Your AI-powered reading workspace",
        description:
            "Access your personalized reading space powered by AI. Read, understand, and retain what matters — all in one place.",
        url: baseUrl,
        siteName: "Readspace",
        locale: "en_US",
        type: "website",
    },
    twitter: {
        card: "summary",
        title: "Readspace Beta | Your AI-powered reading workspace",
        description:
            "Access your personalized reading space powered by AI. Read, understand, and retain what matters — all in one place.",
        creator: "@readspace_ai",
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
        <html lang="en" suppressHydrationWarning>
            <head>
                {/* <script src="https://unpkg.com/react-scan/dist/auto.global.js" /> */}
            </head>
            <body
                className={`${geistSans.variable} ${geistMono.variable} ${eb_garamond.variable} ${logo.variable} font-sans antialiased mt-0`}
            >
                <main className="w-full">{children}</main>
            </body>
        </html>
    )
}
