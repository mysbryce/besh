import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./web', import.meta.url)) } },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': process.env.BESH_API_URL ?? 'http://127.0.0.1:3000',
      '/run': process.env.BESH_API_URL ?? 'http://127.0.0.1:3000',
      '/graphql': process.env.BESH_API_URL ?? 'http://127.0.0.1:3000',
      '/health': process.env.BESH_API_URL ?? 'http://127.0.0.1:3000',
      '/setup': process.env.BESH_API_URL ?? 'http://127.0.0.1:3000',
    },
  },
})
