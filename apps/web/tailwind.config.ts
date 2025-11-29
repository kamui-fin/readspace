import { readspaceConfig } from "./design-tokens/tailwind.config"
import type { Config } from "tailwindcss"

const config: Config = {
    ...readspaceConfig,
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
}

export default config
