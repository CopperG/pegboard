import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'frontend',
          include: ['src/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          environmentOptions: {
            jsdom: {
              url: 'http://localhost',
            },
          },
          setupFiles: ['./src/test/setup.ts'],
        },
      },
      {
        test: {
          name: 'claude-bridge',
          include: ['claude-bridge/**/*.test.mjs'],
          environment: 'node',
        },
      },
    ],
  },
})
