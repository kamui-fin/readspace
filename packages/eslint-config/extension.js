import globals from "globals";
import { config as reactInternalConfig } from "./react-internal.js";

/**
 * A custom ESLint configuration for browser extensions that use React.
 * Extends the react-internal config and adds browser extension specific globals.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const config = [
  ...reactInternalConfig,
  {
    languageOptions: {
      globals: {
        ...globals.webextensions,
        chrome: "readonly",
      },
    },
  },
];
