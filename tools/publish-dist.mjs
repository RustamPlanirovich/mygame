#!/usr/bin/env node
/**
 * ПОДМЕНЯЕТ РАБОЧУЮ СБОРКУ ОДНИМ ПЕРЕИМЕНОВАНИЕМ (dist.next -> dist).
 *
 * ЗАЧЕМ
 * `npm run deploy:pm2` — это «собрать, потом перезапустить», и всё время сборки старый процесс
 * продолжает раздавать dist/. А vite ЧИСТИТ выходную папку в самом начале, поэтому на десятки
 * секунд сборки dist/ пустеет под живым сервером. Наблюдалось живьём 07.08.2026:
 *
 *   [server] необработанная ошибка GET /: ENOENT: no such file or directory,
 *            stat '/root/mygame/dist/index.html'
 *
 * — игрок в этот момент получал ошибку на любой перезагрузке страницы, а в логе это выглядело
 * как поломка сервера. Хуже того, сборка ест CPU целиком: запросы, которые в это время шли,
 * упирались в 30-секундный таймаут (см. requestTimeout в server/http-middleware.js).
 *
 * ПОЧЕМУ ИМЕННО ПЕРЕИМЕНОВАНИЕ
 * rename в пределах одной ФС — операция ядра, а не копирование: окно, в котором dist/ не на
 * месте, сокращается с «вся сборка» до пары системных вызовов. Полностью атомарно поменять две
 * ПАПКИ местами POSIX не даёт (renameat2/RENAME_EXCHANGE из Node недоступен), поэтому на этот
 * остаток окна в SPA-fallback стоит честный 503 с Retry-After вместо ENOENT-стектрейса.
 *
 * Битую сборку не публикуем: если в dist.next нет index.html, выходим с ошибкой и оставляем
 * рабочую версию на месте — пусть деплой упадёт на этом шаге, а не наполовину.
 */

import { existsSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const STAGING = join(ROOT, 'dist.next');
const LIVE = join(ROOT, 'dist');
const PREVIOUS = join(ROOT, 'dist.prev');

if (!existsSync(join(STAGING, 'index.html'))) {
  console.error(
    `publish-dist: в ${STAGING} нет index.html — публиковать нечего, dist/ оставлен без изменений`,
  );
  process.exit(1);
}

// Остаток от прерванного деплоя: dist.prev мог не удалиться, и тогда rename ниже упадёт.
rmSync(PREVIOUS, { recursive: true, force: true });

if (existsSync(LIVE)) renameSync(LIVE, PREVIOUS);
renameSync(STAGING, LIVE);
rmSync(PREVIOUS, { recursive: true, force: true });

console.log('publish-dist: dist.next -> dist (сборка опубликована)');
