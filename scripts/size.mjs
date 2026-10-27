import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
for (const format of ['esm', 'cjs', 'umd']) {
  const data = readFileSync(`dist/${format}/index.js`);
  console.log(`${format}: ${data.length} bytes; ${gzipSync(data, { level: 9 }).length} bytes gzip`);
}
