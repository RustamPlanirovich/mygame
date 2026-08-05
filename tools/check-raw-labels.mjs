#!/usr/bin/env node
/**
 * Гард против сырых игровых id в интерфейсе.
 *
 * Зачем: словарь RESOURCE_LABEL существовал давно, но импортировали его 8 файлов из ~50, и
 * вкладки «Аналитика», «Галактика», «Цепочки», выбор карты печатали идентификаторы вместо
 * названий — то есть дефект добавлялся каждым новым компонентом и замечался только игроком.
 * Ловим два самых частых способа это сделать:
 *
 *   1. `{resource}` / `{node.resource}` / `{deposit}` как текст в JSX;
 *   2. `id.replace(/_/g, ' ')` — самодельная «локализация», дающая «integrated circuit».
 *
 * Правильно: resourceLabel() / depositLabel() / technologyLabel() из src/core/i18n/label.ts.
 *
 * Запуск: node tools/check-raw-labels.mjs  (входит в `npm run lint`)
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

// Файлам из этого списка сырые id разрешены по существу их работы.
const ALLOWLIST = new Set([
  'src/core/i18n/label.ts',              // сам резолвер
  'src/core/constants/labels.ts',        // словари
  'src/utils/testCommands.ts',           // отладочная консоль, не UI
  'src/components/game/CheatPanel.tsx',  // чит-панель: id там и есть смысл
  'src/components/admin/AdminPlayerDetail.tsx', // админка смотрит на данные, а не на подписи
]);

/** Имена переменных, которые почти всегда держат id ресурса/месторождения/технологии. */
const ID_NAMES = String.raw`resource|resourceType|res|deposit|depositType|technologyId|techId|resourceId`;

const PATTERNS = [
  {
    re: new RegExp(String.raw`\{\s*(?:[a-zA-Z_$][\w$]*\.)?(?:${ID_NAMES})\s*\}`, 'g'),
    message: 'сырой id как текст — оберните в resourceLabel()/depositLabel()/technologyLabel()',
  },
  {
    re: /\.replace\(\s*\/_\/g\s*,\s*['"` ]/g,
    message: 'самодельная локализация через replace(/_/g, " ") — используйте resourceLabel()',
  },
];

/**
 * JSX-атрибуты, значение которых видит игрок. Всё остальное (key, value, id, пробрасывание
 * пропа `resource={x}`) — служебное, там сырой id нормален.
 */
const TEXT_ATTRIBUTES = new Set(['title', 'placeholder', 'label', 'aria-label', 'alt']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Находится ли позиция внутри значения служебного JSX-атрибута:
 *   - `key={res}`      — атрибут начинается прямо перед совпадением;
 *   - `key={`${res}-1`}` — совпадение вложено в значение атрибута.
 * Значение видимых игроку атрибутов (title, placeholder, …) служебным не считается.
 */
function isServiceAttributeValue(lineText, column) {
  const before = lineText.slice(0, column);

  const direct = before.match(/([\w-]+)\s*=\s*$/);
  if (direct) return !TEXT_ATTRIBUTES.has(direct[1]);

  const nested = [...before.matchAll(/([\w-]+)\s*=\s*\{/g)];
  if (nested.length > 0) {
    const attr = nested[nested.length - 1][1];
    return !TEXT_ATTRIBUTES.has(attr);
  }

  return false;
}

function isCommentLine(lineText) {
  const t = lineText.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

/**
 * Строки, где id в шаблоне — это и есть id, а не подпись: логи, ключи, URL.
 * Игрок их не видит, оборачивать в resourceLabel там неверно.
 */
const NOT_UI_LINE = [
  /console\.(log|warn|error|debug|info)/,
  /\bid\s*:\s*`/,          // id: `bottleneck_${resource}_...`
  /\bkey\s*:\s*`/,
  /fetch\(/,
  /\/api\//,
  /\bthrow new Error\(/,
];

function isNotUiLine(lineText) {
  return NOT_UI_LINE.some((re) => re.test(lineText));
}

const violations = [];

for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  if (ALLOWLIST.has(rel)) continue;

  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');

  for (const { re, message } of PATTERNS) {
    for (const match of text.matchAll(re)) {
      const before = text.slice(0, match.index);
      const lineNo = before.split('\n').length;
      const lineText = lines[lineNo - 1] ?? '';
      const column = match.index - (before.lastIndexOf('\n') + 1);

      if (isCommentLine(lineText)) continue;
      if (isNotUiLine(lineText)) continue;
      if (isServiceAttributeValue(lineText, column)) continue;

      violations.push({
        rel,
        line: lineNo,
        snippet: lineText.trim().slice(0, 110),
        message,
      });
    }
  }
}

if (violations.length === 0) {
  console.log('✓ check-raw-labels: сырых id в интерфейсе не найдено');
  process.exit(0);
}

console.error(`✗ check-raw-labels: найдено ${violations.length} мест с сырыми id\n`);
for (const v of violations) {
  console.error(`  ${v.rel}:${v.line}`);
  console.error(`    ${v.snippet}`);
  console.error(`    → ${v.message}\n`);
}
console.error('Подписи берутся из src/core/i18n/label.ts.');
process.exit(1);
