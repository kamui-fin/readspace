const { withUniwindConfig } = require('uniwind/metro');
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

// Configure SVG transformer for icon imports
const { transformer, resolver } = config;
config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};
config.resolver = {
  ...resolver,
  assetExts: (resolver.assetExts || []).filter((ext) => ext !== 'svg'),
  sourceExts: [...(resolver.sourceExts || []), 'svg'],
};

// Link custom icon font
if (!config.project) {
  config.project = {};
}
config.project.ios = {
  project: path.join(projectRoot, 'ios'),
};

module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
});
