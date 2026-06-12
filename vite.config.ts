/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Centsible',
        short_name: 'Centsible',
        description: 'Local-first expense tracker. Your money data never leaves your device.',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
  },
});
