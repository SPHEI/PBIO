import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.mainModule ? process.cwd() : '', '')

  return {
    plugins: [react()],
    server: {
      port: 3000, 
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:5000', 
          changeOrigin: true,
        },
      },
    },
  }
})