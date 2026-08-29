/**
 * Generate icon components using Monicon, then filter to keep only needed icons.
 *
 * Note: Monicon's icons array feature doesn't work (Object.entries error),
 * so we generate all icons then delete unused ones to keep git footprint small.
 */

import { bootstrap } from '@monicon/core';
import config from '../monicon.config';
import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

const iconsDir = path.join(import.meta.dir, '../src/components/icons');

// Skip if icons already exist and are recent
if (fs.existsSync(iconsDir) && fs.readdirSync(iconsDir).length > 50) {
  console.log('✅ Icons already generated');
  process.exit(0);
}

console.log('🎨 Generating icons...');

// Icons actually imported in the app - add more here when needed
const NEEDED_SOLAR = new Set([
  'add-circle-bold-duotone', 'add-folder-bold', 'alt-arrow-right-linear', 'alt-arrow-right-outline',
  'archive-up-minimlistic-linear', 'arrow-left-linear', 'bookmark-bold', 'bookmark-broken', 'bookmark-linear',
  'calendar-bold', 'check-circle-bold', 'check-circle-bold-duotone', 'check-circle-linear', 'checklist-minimalistic-linear',
  'clock-circle-linear', 'clock-circle-outline', 'close-circle-bold', 'close-circle-linear', 'cloud-bold', 'compass-bold',
  'copy-bold', 'copy-linear', 'crown-bold', 'danger-triangle-bold', 'document-text-bold', 'document-text-linear',
  'download-linear', 'earth-bold', 'eye-bold', 'eye-closed-bold', 'eye-linear', 'feed-linear', 'folder-bold-duotone',
  'folder-linear', 'folder-open-bold', 'folder-open-linear', 'folder-with-files-bold', 'folder-with-files-linear',
  'global-bold', 'history-broken', 'history-linear', 'inbox-bold', 'inbox-broken', 'inbox-line-linear', 'info-circle-bold',
  'info-circle-linear', 'layers-minimalistic-linear', 'letter-bold', 'letter-opened-linear', 'library-bold-duotone',
  'link-minimalistic-2-bold', 'logout-2-linear', 'magnifer-linear', 'menu-dots-bold', 'notes-bold-duotone', 'palette-linear',
  'rocket-bold', 'server-bold', 'share-bold', 'shield-check-bold', 'shield-keyhole-minimalistic-linear', 'sort-bold',
  'star-bold', 'trash-bin-trash-bold', 'user-circle-linear',
]);

const NEEDED_LOCAL = new Set([
  'close-circle', 'discord', 'expand-vertical', 'github', 'google', 'languages', 'plus',
  'readspace-logo', 'rss', 'sparkle', 'wifi-off',
]);

const timeout = setTimeout(() => {
  console.warn('⚠️  Generation timeout, filtering and exiting...');
  filterIcons();
  process.exit(0);
}, 30000);

try {
  const iconConfig = { ...config, watch: false };
  await bootstrap(iconConfig);
  console.log('✅ Icons generated, filtering to needed set...');
  clearTimeout(timeout);
  filterIcons();
  process.exit(0);
} catch (error) {
  if (error instanceof Error) {
    console.warn('⚠️  Generation error:', error.message, '- filtering generated icons...');
  }
  clearTimeout(timeout);
  filterIcons();
  process.exit(0);
}

function filterIcons() {
  const solarDir = path.join(iconsDir, 'solar');
  const localDir = path.join(iconsDir, 'local');

  // Delete unwanted solar icons
  if (fs.existsSync(solarDir)) {
    const files = fs.readdirSync(solarDir);
    let deleted = 0;
    for (const file of files) {
      const name = file.replace('.tsx', '');
      if (!NEEDED_SOLAR.has(name)) {
        fs.unlinkSync(path.join(solarDir, file));
        deleted++;
      }
    }
    console.log(`  Kept ${NEEDED_SOLAR.size} Solar icons, removed ${deleted} unused`);
  }

  // Delete unwanted local icons
  if (fs.existsSync(localDir)) {
    const files = fs.readdirSync(localDir);
    let deleted = 0;
    for (const file of files) {
      const name = file.replace('.tsx', '');
      if (!NEEDED_LOCAL.has(name)) {
        fs.unlinkSync(path.join(localDir, file));
        deleted++;
      }
    }
    if (deleted > 0) {
      console.log(`  Kept ${NEEDED_LOCAL.size} local icons, removed ${deleted} unused`);
    }
  }

  const solarCount = fs.existsSync(solarDir) ? fs.readdirSync(solarDir).length : 0;
  const localCount = fs.existsSync(localDir) ? fs.readdirSync(localDir).length : 0;
  console.log(`✅ Filtered: ${solarCount + localCount} total icons kept`);
}
