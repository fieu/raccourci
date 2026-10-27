import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, normalizePath } from 'vite';
import dts from 'vite-plugin-dts';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  const umd = mode === 'umd';
  return {
    plugins: umd ? [] : [dts({
      include: ['src/index.ts'],
      outDir: 'dist/esm',
      afterDiagnostic(diagnostics) {
        if (diagnostics.some(diagnostic => diagnostic.category === 1)) {
          throw new Error('TypeScript declaration generation failed');
        }
      },
      afterBuild(files) {
        const types = files.get(normalizePath(resolve(root, 'dist/esm/index.d.ts')));
        if (!types) throw new Error('Missing core declaration output');
        // Declaration variants keep Node ESM/CJS and script-tag types accurate.
        for (const format of ['cjs', 'umd']) {
          const directory = resolve(root, 'dist', format);
          mkdirSync(directory, { recursive: true });
          writeFileSync(resolve(directory, 'index.d.cts'),
            (format === 'umd' ? 'export as namespace Raccourci;\n' : '') + types);
        }
      },
    })],
    build: {
      target: 'es2020',
      emptyOutDir: !umd,
      minify: 'terser',
      terserOptions: { compress: { passes: 3 }, format: { comments: false } },
      lib: {
        entry: resolve(root, umd ? 'browser/index.ts' : 'src/index.ts'),
        name: 'Raccourci',
        formats: umd ? ['umd'] : ['es', 'cjs'],
        fileName: format => format === 'es' ? 'esm/index.js' : `${format}/index.cjs`,
      },
      rollupOptions: { output: { exports: 'named' } },
    },
  };
});
