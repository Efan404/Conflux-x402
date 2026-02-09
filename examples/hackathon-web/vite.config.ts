import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const sandboxTarget = env.VITE_API_SANDBOX_BASE?.trim() || 'http://localhost:4021'
  const facilitatorTarget = env.VITE_API_FACILITATOR_BASE?.trim() || 'http://localhost:4022'
  const attestorTarget = env.VITE_API_ATTESTOR_BASE?.trim() || 'http://localhost:3003'

  return {
    plugins: [react()],
    server: {
      port: 3000,
      open: true,
      proxy: {
        '/api/sandbox': {
          target: sandboxTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/sandbox/, ''),
        },
        '/api/facilitator': {
          target: facilitatorTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/facilitator/, ''),
        },
        '/api/attestor': {
          target: attestorTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/attestor/, ''),
        },
      },
    },
  }
})
