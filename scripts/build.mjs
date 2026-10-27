import { execFileSync } from 'node:child_process';
import { rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { minify } from 'terser';

rmSync('dist', { recursive: true, force: true });
const tsc = 'node_modules/typescript/bin/tsc';
execFileSync(process.execPath, [tsc], { stdio: 'inherit' });
execFileSync(process.execPath, [tsc, '--module', 'CommonJS', '--outDir', 'dist/cjs'], { stdio: 'inherit' });
writeFileSync('dist/cjs/package.json', '{"type":"commonjs"}\n');
const commonjs = readFileSync('dist/cjs/index.js', 'utf8');
const umd = `(function (root, factory) {
  if (typeof module === 'object' && module.exports) factory(module.exports);
  else if (typeof define === 'function' && define.amd) define(['exports'], factory);
  else factory(root.Raccourci = {});
})(typeof globalThis !== 'undefined' ? globalThis : this, function (exports) {
${commonjs}
${readFileSync('browser/auto.js', 'utf8')}
});\n`;
mkdirSync('dist/umd', { recursive: true });
writeFileSync('dist/umd/index.js', umd);
writeFileSync('dist/umd/package.json', '{"type":"commonjs"}\n');
writeFileSync('dist/umd/index.d.ts', 'export as namespace Raccourci;\n' + readFileSync('dist/esm/index.d.ts', 'utf8'));
for (const format of ['esm', 'cjs', 'umd']) {
  const path = `dist/${format}/index.js`;
  const { code } = await minify(readFileSync(path, 'utf8'), {
    module: format === 'esm',
    // Keep the UMD wrapper intact to avoid hoisting browser globals.
    toplevel: format !== 'umd', compress: { passes: 3 }, mangle: true,
    format: { comments: false },
  });
  if (!code) throw new Error(`Minification failed: ${format}`);
  writeFileSync(path, code + '\n');
}
