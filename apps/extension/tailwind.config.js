import { readspaceConfig } from "./src/lib/design-tokens/tailwind.config"

/** @type {import('tailwindcss').Config} */
export default {
  ...readspaceConfig,
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
} 