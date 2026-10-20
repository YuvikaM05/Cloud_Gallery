import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' lets the built app load from file:// inside Electron
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/__tests__/setup.js'],
  },
})
