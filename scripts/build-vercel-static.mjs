import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, matchesGlob, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, '.vercel-static');
const ignored = readFileSync(join(root, '.vercelignore'), 'utf8')
  .split(/\r?\n/).map(line => line.trim())
  .filter(line => line && !line.startsWith('#'))
  .map(line => line.replace(/\/$/, ''));

// Work on a generated copy only; never remove QA evidence from the checkout.
rmSync(output, { recursive: true, force: true });
mkdirSync(output);
for (const entry of readdirSync(root)) cpSync(join(root, entry), join(output, entry), {
  recursive: true,
  filter(source) {
    const path = relative(root, source).replaceAll('\\', '/');
    if (!path) return true;
    if (path === '.vercel' || path.startsWith('.vercel/')) return false;
    return !ignored.some(pattern => matchesGlob(path, pattern) || matchesGlob(path, `${pattern}/**`));
  },
});
console.log('Static assets prepared in .vercel-static; docs/qa remains in Git only.');
