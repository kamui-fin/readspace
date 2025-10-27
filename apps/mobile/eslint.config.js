/* eslint-env node */
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
    expoConfig,
    {
        ignores: ['dist/*', 'showtime-inspo/**/*'],
    },
    {
        rules: {
            'react/display-name': 'off',
        },
    },
]);
