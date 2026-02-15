import {
    EB_Garamond,
    Figtree,
    Geist,
    Geist_Mono,
    Noto_Serif_JP,
    Noto_Serif_SC,
    Noto_Serif_TC,
} from "next/font/google"

export const geistSans = Geist({
    variable: "--font-sans",
    subsets: ["latin"],
})

export const geistMono = Geist_Mono({
    variable: "--font-mono",
    subsets: ["latin"],
})

export const eb_garamond = EB_Garamond({
    variable: "--font-garamond-serif",
    subsets: ["latin"],
})

export const logo = Figtree({
    variable: "--font-logo",
    subsets: ["latin"],
})

export const notoSerifSC = Noto_Serif_SC({
    variable: "--font-noto-serif-sc",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
})

export const notoSerifJP = Noto_Serif_JP({
    variable: "--font-noto-serif-jp",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
})

export const notoSerifTC = Noto_Serif_TC({
    variable: "--font-noto-serif-tc",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
})
