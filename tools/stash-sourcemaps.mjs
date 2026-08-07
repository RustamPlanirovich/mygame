#!/usr/bin/env node
/**
 * Выносит карты кода (.map) из dist/ после сборки (bigplan.md, пункт 34).
 *
 * ЗАЧЕМ
 * Карты полезно собирать: без них присланный игроком стектрейс нечитаем, а серверного сбора
 * ошибок в проекте нет — разобрать проблему больше нечем. Но всё, что лежит в dist/, раздаётся
 * наружу: запрос /assets/index-*.js.map отдавал 2.8 МБ полных исходников проекта.
 *
 * ПОЧЕМУ ПЕРЕНОС, А НЕ УДАЛЕНИЕ И НЕ sourcemap:false
 * Удалить — значит потерять возможность разобрать стектрейс. Выключить сборку карт — то же
 * самое. Перенос рядом со сборкой сохраняет и то и то: файлы под рукой у разработчика, но их
 * физически нет в раздаваемой папке — и это работает независимо от того, кто раздаёт статику
 * (сейчас `vite preview`, в production-режиме — express).
 *
 * Дополнительно в vite.config.ts стоит `sourcemap: 'hidden'`: в бандлах нет ссылки
 * `//# sourceMappingURL=`, поэтому браузер не пытается их подтянуть и не пишет 404 в консоль.
 */

import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
// Папку сборки можно передать аргументом: production собирается в dist.next и подменяет dist
// одним переименованием уже после того, как карты вынесены (tools/publish-dist.mjs).
const DIST = join(ROOT, process.argv[2] ?? 'dist');
const TARGET = join(ROOT, 'sourcemaps');

if (!existsSync(DIST)) {
  console.log(`stash-sourcemaps: ${process.argv[2] ?? 'dist'}/ нет, нечего переносить`);
  process.exit(0);
}

// Предыдущие карты не нужны: они от старой сборки и к новым бандлам не подходят.
if (existsSync(TARGET)) rmSync(TARGET, { recursive: true, force: true });

let moved = 0;
let bytes = 0;

/** Рекурсивно переносит .map, сохраняя относительные пути. */
function walk(dir, relative = '') {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, join(relative, entry));
      continue;
    }
    if (!entry.endsWith('.map')) continue;

    const destDir = join(TARGET, relative);
    mkdirSync(destDir, { recursive: true });
    bytes += statSync(full).size;
    renameSync(full, join(destDir, entry));
    moved++;
  }
}

walk(DIST);

if (moved === 0) {
  console.log('stash-sourcemaps: карт не найдено (sourcemap выключен?)');
} else {
  console.log(
    `stash-sourcemaps: ${moved} карт (${(bytes / 1024 / 1024).toFixed(1)} МБ) перенесено ` +
      `из ${process.argv[2] ?? 'dist'}/ в sourcemaps/ — наружу они больше не раздаются`,
  );
}
