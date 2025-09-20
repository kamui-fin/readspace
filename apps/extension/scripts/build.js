#!/usr/bin/env node

import { execSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

console.log('🚀 Readspace Extension Build Script')
console.log('==================================')

function runCommand(command, description) {
  console.log(`\n📦 ${description}...`)
  try {
    execSync(command, { 
      cwd: projectRoot, 
      stdio: 'inherit',
      encoding: 'utf-8'
    })
    console.log(`✅ ${description} completed`)
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message)
    process.exit(1)
  }
}

function ensureDirectory(path) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true })
    console.log(`📁 Created directory: ${path}`)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const target = args[0] || 'chrome'
const shouldPackage = args.includes('--package')

if (!['chrome', 'firefox', 'all'].includes(target)) {
  console.error('❌ Invalid target. Use: chrome, firefox, or all')
  process.exit(1)
}

console.log(`🎯 Target: ${target}`)
console.log(`📦 Package: ${shouldPackage ? 'Yes' : 'No'}`)

// Ensure output directories exist
ensureDirectory(join(projectRoot, 'dist'))
ensureDirectory(join(projectRoot, 'dist-firefox'))
ensureDirectory(join(projectRoot, 'web-ext-artifacts'))

try {
  // Install dependencies if node_modules doesn't exist
  if (!existsSync(join(projectRoot, 'node_modules'))) {
    runCommand('npm install', 'Installing dependencies')
  }

  // Build based on target
  if (target === 'chrome' || target === 'all') {
    runCommand('npm run build:chrome', 'Building Chrome extension')
    
    if (shouldPackage) {
      runCommand('npm run package:chrome', 'Packaging Chrome extension')
    }
  }

  if (target === 'firefox' || target === 'all') {
    runCommand('npm run build:firefox', 'Building Firefox extension')
    
    if (shouldPackage) {
      runCommand('npm run package:firefox', 'Packaging Firefox extension')
    }
  }

  console.log('\n🎉 Build completed successfully!')
  
  if (target === 'chrome' || target === 'all') {
    console.log(`📁 Chrome extension: ./dist/`)
  }
  
  if (target === 'firefox' || target === 'all') {
    console.log(`📁 Firefox extension: ./dist-firefox/`)
    if (shouldPackage) {
      console.log(`📦 Firefox package: ./web-ext-artifacts/`)
    }
  }

  console.log('\n📖 Next steps:')
  if (target === 'chrome' || target === 'all') {
    console.log('  Chrome: Load ./dist/ as unpacked extension in chrome://extensions/')
  }
  if (target === 'firefox' || target === 'all') {
    console.log('  Firefox: Use "npm run dev:firefox" for development')
    console.log('           Or load ./dist-firefox/ in about:debugging')
  }

} catch (error) {
  console.error('❌ Build process failed:', error)
  process.exit(1)
} 