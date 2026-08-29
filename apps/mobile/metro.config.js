const { withUniwindConfig } = require('uniwind/metro');
const { withMonicon } = require('@monicon/metro');
const path = require('node:path');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getSentryExpoConfig(projectRoot);

// Add monorepo support
config.watchFolders = Array.from(
  new Set([...(config.watchFolders || []), projectRoot, monorepoRoot])
);
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

const configWithMonicon = withMonicon(config);

module.exports = withUniwindConfig(configWithMonicon, {
  cssEntryFile: './global.css',
});
