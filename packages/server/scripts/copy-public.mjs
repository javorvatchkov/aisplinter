import { cp, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src/public');
const dest = join(root, 'dist/public');

await mkdir(dest, { recursive: true });
await cp(src, dest, { recursive: true });
console.log('Copied public assets to dist/public');
