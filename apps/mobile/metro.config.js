const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const { withMonicon } = require('@monicon/metro');

const config = getDefaultConfig(__dirname);

const configWithMonicon = withMonicon(config, {
  collections: ['solar'],
});

module.exports = withNativeWind(configWithMonicon, { input: './global.css' });
