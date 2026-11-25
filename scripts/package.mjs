// npm run package: типы → тесты → сборка → проверка размера → dist.zip для загрузки в консоль Яндекс Игр.
import { execSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { zipDir } from './zip.mjs';

const run = (cmd) => { console.log(`\n> ${cmd}`); execSync(cmd, { stdio: 'inherit' }); };
run('npm run typecheck');
run('npm test');
run('npm run build');
run('node scripts/check-size.mjs dist');
if (!existsSync('dist/index.html')) { console.error('FAIL: нет dist/index.html'); process.exit(1); }
const n = zipDir('dist', 'dist.zip');
console.log(`\ndist.zip: ${n} файлов, ${(statSync('dist.zip').size / 1024 / 1024).toFixed(2)} МБ (index.html в корне архива)`);
