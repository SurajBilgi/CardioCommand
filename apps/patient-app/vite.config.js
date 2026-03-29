import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const trimBaseUrl = (value = '') => value.trim().replace(/\/+$/, '')
const normalizeBaseUrl = (value = '') => {
  const trimmed = trimBaseUrl(value)
  return /your-railway-url/i.test(trimmed) ? '' : trimmed
}
const toWsUrl = (value) => value.replace(/^http/i, 'ws')

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = normalizeBaseUrl(env.VITE_DEV_API_PROXY_TARGET || '') || 'http://localhost:8000'
  const wsTarget = normalizeBaseUrl(env.VITE_DEV_WS_PROXY_TARGET || '') || toWsUrl(apiTarget)

  return {
    plugins: [react()],
    server: {
      port: 5174,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/vitals': {
          target: wsTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  }
})
