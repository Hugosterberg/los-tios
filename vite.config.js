import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api/loyverse': {
        target: 'https://api.loyverse.com/v1.0',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/loyverse/, ''),
      },
      '/api/clip/payments': {
        target: 'https://api.payclip.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/clip\/payments/, ''),
      },
      '/api/clip/settlements': {
        target: 'https://api-gw.payclip.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/clip\/settlements/, ''),
      },
    },
  },
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true'
    }),
    react(),
  ]
});
