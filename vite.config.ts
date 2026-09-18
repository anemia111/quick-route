import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
export default defineConfig({
  base: '/quick-route/',
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['apple-touch-icon.png', 'icon.svg'],
    manifest: { name: 'Quick Route', short_name: 'Quick Route', description: 'いつもの2駅をワンタップで。', lang: 'ja', id: '/quick-route/', start_url: '/quick-route/', scope: '/quick-route/', display: 'standalone', theme_color: '#203f36', background_color: '#f6f8f7', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] },
    workbox: { globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'], navigateFallback: 'index.html', cleanupOutdatedCaches: true },
  })],
  test: { environment: 'jsdom', setupFiles: './src/test-setup.ts', clearMocks: true },
})
