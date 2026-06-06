import { MoniconConfig } from '@monicon/core';
import { loadLocalCollection } from '@monicon/core/loaders';
import { reactNative } from '@monicon/core/plugins';

export default {
  collections: ['solar'],
  loaders: {
    local: loadLocalCollection('assets/icons'),
  },
  plugins: [
    reactNative({ outputPath: 'src/components/icons' }),
  ],
} satisfies MoniconConfig;
