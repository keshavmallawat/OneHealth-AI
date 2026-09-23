import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Bind explicitly to IPv4. Vite's default host is "localhost", which on
    // Windows resolves to ::1 first, so the dev server ends up listening on
    // IPv6 ONLY. Anything checking 127.0.0.1:5173 then sees nothing there.
    host: '127.0.0.1',
    port: 5173,
    // Fail loudly instead of silently sliding to 5174 if the port is taken -
    // a moved port is worse than a clear error right before a demo.
    strictPort: true,
    proxy: {
      // Same reasoning: address the API by IP, not by a name that may resolve
      // to an interface the API is not listening on.
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
})
