/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // Vitest owns the unit/component tests under src/.
    // Playwright browser specs live in browser/ and are run by `npm run test:e2e`.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
