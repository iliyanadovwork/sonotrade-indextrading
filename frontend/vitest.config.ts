import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    // Unit tests live next to the code they test as *.test.ts.
    // Playwright e2e specs live under e2e/ and must NOT run under vitest.
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts', 'components/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
})
