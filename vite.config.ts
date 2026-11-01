import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' keeps every asset path relative, so the same build works under
// username.github.io/<repo>/ and on a root domain without changes.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900, // maplibre-gl is a lazy chunk, it only loads with the map
  },
  server: { port: 5180, host: '127.0.0.1' },
  preview: { port: 8770, host: '127.0.0.1' },
});
