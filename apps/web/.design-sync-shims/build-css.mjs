// Regenerate the static token+utility stylesheet the converter ships as _ds_bundle.css.
// packages/design-tokens/src/theme.css is NOT browser CSS (it's @import 'tailwindcss'
// + @plugin + @theme). Run this before every re-sync if theme.css or the scoped
// components' classNames changed:  node apps/web/.design-sync-shims/build-css.mjs
import postcss from '../node_modules/postcss/lib/postcss.js'
import tailwind from '../node_modules/@tailwindcss/postcss/dist/index.mjs'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))   // apps/web/.design-sync-shims
const web = resolve(here, '..')                        // apps/web
const repo = resolve(web, '../..')                     // repo root
const themeCss = resolve(repo, 'packages/design-tokens/src/theme.css')
const comps = ['button', 'card', 'input', 'badge', 'tabs']
  .map((n) => resolve(web, `components/ui/${n}.tsx`))

const input = `@import ${JSON.stringify(themeCss)};\n` +
  comps.map((c) => `@source ${JSON.stringify(c)};`).join('\n') + '\n'

const result = await postcss([tailwind()]).process(input, { from: themeCss, to: undefined })
const out = resolve(here, 'readspace-tokens.css')
writeFileSync(out, result.css)
console.log(`wrote ${out} (${(result.css.length / 1024).toFixed(1)} KB)`)
