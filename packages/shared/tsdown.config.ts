import { defineConfig } from 'tsdown'

export default defineConfig({
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    'react',
    'react-dom',
    '@tanstack/react-query',
    'react-hot-toast',
  ]
})