#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const extensionRoot = resolve(scriptDirectory, '..')
const repositoryRoot = resolve(extensionRoot, '../..')
const manifest = JSON.parse(
  readFileSync(join(extensionRoot, 'src/manifest.base.json'), 'utf8')
)
const archiveName = `readspace-${manifest.version}-source.zip`
const artifactsDirectory = join(extensionRoot, 'web-ext-artifacts')
const archivePath = join(artifactsDirectory, archiveName)
const stagingRoot = mkdtempSync(join(tmpdir(), 'readspace-extension-source-'))

const includedPaths = [
  'package.json',
  'bun.lock',
  'apps/extension',
  // Bun validates every workspace recorded in bun.lock during a frozen install.
  // These manifests preserve that validation without including unrelated app source.
  'apps/inbound/package.json',
  'apps/mobile/package.json',
  'apps/web/package.json',
  'packages/shared',
  'packages/design-tokens',
  'packages/eslint-config',
  'packages/typescript-config',
]

const excludedDirectories = new Set([
  '.cache',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'dist-firefox',
  'node_modules',
  'web-ext-artifacts',
])

function includeSourcePath(sourcePath) {
  const name = basename(sourcePath)
  if (excludedDirectories.has(name)) return false
  if (name === '.DS_Store' || name.startsWith('.env')) return false
  if (/\.(?:crx|log|pem)$/i.test(name)) return false
  return true
}

function copyIncludedPath(relativePath) {
  const sourcePath = join(repositoryRoot, relativePath)
  if (!existsSync(sourcePath)) {
    throw new Error(`Required source path is missing: ${relativePath}`)
  }

  const destinationPath = join(stagingRoot, relativePath)
  mkdirSync(dirname(destinationPath), { recursive: true })
  cpSync(sourcePath, destinationPath, {
    recursive: true,
    filter: includeSourcePath,
  })
}

const buildInstructions = `# Readspace Extension ${manifest.version} — Source Build

This archive contains only the source and workspace files required to reproduce
the submitted Firefox extension package. It does not contain dependencies,
compiled output, environment files, private keys, or unrelated applications.

## Requirements

- Node.js 18 or newer
- Bun 1.3.x

## Build

From the extracted archive root, run:

    bun install --frozen-lockfile
    cd apps/extension
    bun run build:firefox

The unpackaged extension is created in \`apps/extension/dist-firefox\`.

To create the submission ZIP, run:

    bun run package:firefox

The resulting file is
\`apps/extension/web-ext-artifacts/readspace-${manifest.version}-firefox.zip\`.

No environment variables, private dependencies, or proprietary build tools are
required.
`

try {
  for (const relativePath of includedPaths) copyIncludedPath(relativePath)
  writeFileSync(
    join(stagingRoot, 'SOURCE_CODE_README.md'),
    buildInstructions,
    'utf8'
  )

  mkdirSync(artifactsDirectory, { recursive: true })
  if (existsSync(archivePath)) unlinkSync(archivePath)

  const result = spawnSync('zip', ['-q', '-r', archivePath, '.'], {
    cwd: stagingRoot,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`zip exited with status ${result.status}`)
  }

  console.log(`Source package ready: ${archivePath}`)
} finally {
  rmSync(stagingRoot, { recursive: true, force: true })
}
