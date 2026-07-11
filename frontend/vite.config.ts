import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Все запросы к /api уходят на Go-бэкенд — в dev нет проблем с CORS.
      '/api': { target: 'http://localhost:8090', changeOrigin: true },
    },
  },
  test: {
    // jsdom: the lib code under test touches localStorage and window.
    environment: 'jsdom',
  },
})
