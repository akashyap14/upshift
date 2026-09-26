import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Forward API calls to the Quarkus backend (upshift-backend, port 8080)
    proxy: {
      '/api': process.env.API_TARGET ?? 'http://localhost:8080',
    },
  },
})
