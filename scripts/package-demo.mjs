import { copyFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const destination = resolve(root, 'site');
copyFileSync(resolve(root, 'dist/umd/index.cjs'), resolve(destination, 'raccourci.umd.js'));
copyFileSync(resolve(root, 'LICENSE'), resolve(destination, 'LICENSE'));
writeFileSync(resolve(destination, '.nojekyll'), '');
console.log('Added the standalone browser build, license, and .nojekyll to the demo.');
