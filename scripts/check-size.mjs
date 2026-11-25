import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const dir = process.argv[2] ?? 'dist';
const walk = (d) => readdirSync(d).reduce((s, f) => { const p = join(d, f); return s + (statSync(p).isDirectory() ? walk(p) : statSync(p).size); }, 0);
const mb = walk(dir) / 1024 / 1024;
console.log(`dist size: ${mb.toFixed(2)} MB`);
if (mb > 100) { console.error('FAIL: > 100 MB'); process.exit(1); }
if (mb > 30) console.warn('WARN: > 30 MB');
