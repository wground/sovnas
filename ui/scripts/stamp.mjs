// Append a content hash to asset urls in the built index.html so that
// immutable caching of /apps/sovnas/assets/* is safe across releases,
// and check that every built file has a clay-friendly name.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const web = new URL('../../desk/web/', import.meta.url).pathname;
let html = readFileSync(join(web, 'index.html'), 'utf8');
html = html.replace(/(\/apps\/sovnas\/assets\/[a-z0-9._-]+\.(?:js|css))/g, (url) => {
  const file = join(web, url.replace('/apps/sovnas/', ''));
  const h = createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 10);
  return `${url}?v=${h}`;
});
writeFileSync(join(web, 'index.html'), html);

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const bad = walk(web).filter((f) => !/^[a-z0-9._~-]+$/.test(f.slice(web.length).split('/').join('')));
if (bad.length) {
  console.error('files clay cannot hold (paths must be lowercase knots):', bad);
  process.exit(1);
}
const exts = new Set(walk(web).map((f) => f.split('.').pop()));
console.log('stamped index.html; web files use marks:', [...exts].join(', '));
