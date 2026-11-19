import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')
  const certDirectory = path.resolve(process.cwd(), '../certs')

  return {
    plugins: [react()],
    server: {
      port: 3000, 
      https: {
        key: fs.readFileSync(path.join(certDirectory, 'localhost-key.pem')),
        cert: fs.readFileSync(path.join(certDirectory, 'localhost.pem')),
      },
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'https://localhost:5000',
          secure: false,
          changeOrigin: true,
        },
      },
    },
  }
})
