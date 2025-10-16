import { config as extensionConfig } from "@readspace/eslint-config/extension"
import globals from "globals"

/** @type {import("eslint").Linter.Config} */
export default [
  ...extensionConfig,
  {
    ignores: ["dist/**", "dist-firefox/**", "web-ext-artifacts/**", "node_modules/**"],
  },
  {
    files: ["**/*.cjs", "scripts/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
]
