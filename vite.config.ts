import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false
      },
      manifest: {
        name: 'Ujianly - Ujian Online',
        short_name: 'Ujianly',
        description: 'Platform Ujian & Kuis Online untuk Guru dan Murid Indonesia',
        theme_color: '#4F6EF7',
        background_color: '#0C0E1A',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ],
  resolve: {
    alias: { '@': '/src' },
  },
  // Strip console.error/warn di production build
  esbuild: mode === 'production' ? {
    drop: ['console', 'debugger'],
  } : {},
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Pisah library besar agar tidak masuk initial bundle
          xlsx: ['xlsx'],
          mammoth: ['mammoth'],
        },
      },
    },
  },
}))
