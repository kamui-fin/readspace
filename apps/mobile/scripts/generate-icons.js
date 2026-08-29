#!/usr/bin/env node
/**
 * Generate icon components using Monicon.
 * Only generates icons specified in monicon.config.ts
 */

const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '../src/components/icons');

// Skip if icons already exist (assume they're up-to-date)
if (fs.existsSync(iconsDir) && fs.readdirSync(iconsDir).length > 20) {
  console.log('✅ Icons already generated');
  process.exit(0);
}

console.log('🎨 Generating icons...');

(async () => {
  try {
    const { bootstrap } = await import('@monicon/core');
    const configModule = await import('../monicon.config.ts');
    const config = configModule.default;

    // Force non-watch mode
    const iconConfig = { ...config, watch: false };

    // Timeout to prevent hanging
    const timeout = setTimeout(() => {
      console.warn('⚠️  Generation timeout, exiting...');
      process.exit(0);
    }, 25000);

    try {
      await bootstrap(iconConfig);
      console.log('✅ Icons generated successfully');
      clearTimeout(timeout);
      process.exit(0);
    } catch (error) {
      console.error('❌ Generation error:', error.message);
      clearTimeout(timeout);
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Failed to load config:', error.message);
    process.exit(0);
  }
})();
