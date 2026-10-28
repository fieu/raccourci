import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('./demo', import.meta.url)),
  base: './',
  build: {
    outDir: fileURLToPath(new URL('./site', import.meta.url)),
    emptyOutDir: true,
    target: 'es2020',
    minify: 'terser',
  },
});
