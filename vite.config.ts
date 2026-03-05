import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@psync/core': fileURLToPath(new URL('../psync-core/src/index.ts', import.meta.url)),
    },
  },
  plugins: [react()],
})
