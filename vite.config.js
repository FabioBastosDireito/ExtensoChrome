import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        popup: 'popup.html',
        options: 'options.html'
      }
    }
  },
  server: {
    port: 5173,
    hmr: {
      protocol: 'ws'
    }
  }
});