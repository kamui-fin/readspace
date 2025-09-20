module.exports = {
  // Firefox-specific configuration for web-ext
  sourceDir: './dist-firefox',
  artifactsDir: './web-ext-artifacts',
  
  // Development configuration
  run: {
    firefox: 'firefox', // Use system Firefox or specify path
    startUrl: ['about:debugging#/runtime/this-firefox'],
  },
  
  // Build configuration
  build: {
    overwriteDest: true,
  },
  
  // Linting configuration
  lint: {
    pretty: true,
    metadata: true,
    output: 'json',
  },
  
  // Ignore files during packaging
  ignoreFiles: [
    'src/',
    'node_modules/',
    'package*.json',
    'vite.config.ts',
    'tsconfig*.json',
    'web-ext-config.cjs',
    'web-ext-config.js',
    '*.md',
    '.git*',
    'dist/',
    'web-ext-artifacts/',
  ],
} 