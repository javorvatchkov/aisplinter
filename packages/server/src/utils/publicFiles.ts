import { access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const moduleDir = dirname(fileURLToPath(import.meta.url));

/** Resolve static files whether running from `dist/` or `src/` (dev). */
export async function resolvePublicFile(name: string): Promise<string> {
  const candidates = [
    join(moduleDir, 'public', name),
    join(moduleDir, '../src/public', name),
    join(moduleDir, '../../src/public', name),
  ];
  for (const path of candidates) {
    try {
      await access(path);
      return path;
    } catch {
      /* try next */
    }
  }
  throw new Error(`Public file not found: ${name}`);
}
