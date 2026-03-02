// @ts-nocheck

import { MoniconConfig } from '@monicon/core';
import { loadLocalCollection } from '@monicon/core/loaders';
import { clean, reactNative } from '@monicon/core/plugins';

export default {
  collections: ['solar'],
  loaders: {
    local: loadLocalCollection('assets/icons'),
  },
  plugins: [
    clean({ patterns: ['src/components/icons'] }),
    reactNative({ outputPath: 'src/components/icons' }),
  ],
} satisfies MoniconConfig;
