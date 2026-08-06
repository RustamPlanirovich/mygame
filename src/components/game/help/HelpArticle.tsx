/**
 * РЕНДЕР СТАТЬИ СПРАВКИ.
 *
 * Прошлая версия собирала HTML регулярками и отдавала его в `dangerouslySetInnerHTML`:
 * `.replace(/^## (.*)/gm, '<h2 …>$2</h2>')` — с ошибкой в номере группы, из-за которой
 * подзаголовки печатались как «$2». Плюс любая `<` в тексте статьи ломала бы вёрстку.
 *
 * Здесь — разбор в React-узлы. Подмножество разметки маленькое и закрытое, потому что
 * статьи пишем мы же, а не игрок:
 *
 *   ## Заголовок          — раздел статьи
 *   ### Подзаголовок      — подраздел
 *   - пункт               — список
 *   1. пункт              — нумерованный список
 *   | a | b |             — таблица (первая строка — шапка)
 *   > текст               — врезка «важно знать»
 *   ! текст               — врезка «осторожно»
 *   + текст               — врезка «совет»
 *   = формула             — блок с формулой, моноширинный
 *   пустая строка         — граница абзаца
 *
 * Внутри строки: **жирный** и `код`. Эмодзи прогоняются через IconText, поэтому в справке
 * они рисуются тем же набором иконок, что и весь остальной интерфейс.
 */

import React, { type ReactNode } from 'react';
import { IconText } from '../../ui/icons';

// ─────────────────────────────────────────────────────────────── инлайн-разметка

/**
 * `**жирный**` и `` `код` `` в узлы. Остальной текст идёт через IconText — иначе эмодзи в
 * справке рисовались бы системным шрифтом, а во всей игре — глифами Material Icons.
 */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  // Один проход обоими маркерами: раздельные проходы дали бы вложенность,
  // которую пришлось бы разбирать ещё раз.
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  const plain = (value: string) => {
    if (!value) return;
    out.push(<IconText key={`${keyPrefix}-t${i++}`}>{value}</IconText>);
  };

  while ((match = re.exec(text)) !== null) {
    plain(text.slice(last, match.index));
    if (match[1] !== undefined) {
      out.push(
        <strong key={`${keyPrefix}-b${i++}`} className="font-semibold text-content-primary">
          <IconText>{match[1]}</IconText>
        </strong>,
      );
    } else if (match[2] !== undefined) {
      out.push(
        <code
          key={`${keyPrefix}-c${i++}`}
          className="rounded bg-white/5 px-1 py-px font-mono text-2xs text-info"
        >
          {match[2]}
        </code>,
      );
    }
    last = re.lastIndex;
  }
  plain(text.slice(last));

  return out;
}

// ─────────────────────────────────────────────────────────────────────── блоки

type Block =
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'p'; lines: string[] }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'note'; tone: 'info' | 'warn' | 'tip'; text: string }
  | { kind: 'formula'; lines: string[] };

const TABLE_ROW = /^\|(.*)\|$/;

function splitRow(line: string): string[] {
  const inner = line.replace(TABLE_ROW, '$1');
  return inner.split('|').map((cell) => cell.trim());
}

/** Разделительная строка таблицы (`|---|---|`) — её не рисуем. */
function isDivider(cells: string[]): boolean {
  return cells.every((cell) => /^:?-{2,}:?$/.test(cell));
}

/**
 * Начинает ли строка НОВЫЙ блок.
 *
 * Нужна для переноса строк: статьи набраны с мягким переносом на ~100 символов, поэтому один
 * пункт списка почти всегда занимает две-три строки исходника. Без этой проверки сборщик
 * пунктов останавливался на первой же строке-продолжении, и длинный пункт разваливался на
 * список из одного элемента плюс абзац — текст не терялся, но читалось это как сломанная
 * вёрстка. Проверять «продолжение ли это» можно только от обратного: продолжение — всё, что
 * не начинает новый блок.
 */
function startsBlock(line: string): boolean {
  return (
    line.startsWith('#') ||
    line.startsWith('- ') ||
    line.startsWith('> ') ||
    line.startsWith('! ') ||
    line.startsWith('+ ') ||
    line.startsWith('= ') ||
    TABLE_ROW.test(line) ||
    /^\d+\.\s/.test(line)
  );
}

export function parseHelpMarkup(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n/g, '\n').split('\n');

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      i += 1;
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push({ kind: 'h3', text: line.slice(4).trim() });
      i += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push({ kind: 'h2', text: line.slice(3).trim() });
      i += 1;
      continue;
    }

    // Таблица: подряд идущие строки в трубах.
    if (TABLE_ROW.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && TABLE_ROW.test(lines[i].trim())) {
        const cells = splitRow(lines[i].trim());
        if (!isDivider(cells)) rows.push(cells);
        i += 1;
      }
      blocks.push({ kind: 'table', rows });
      continue;
    }

    /*
     * Списки. Пункт продолжается на следующих строках, пока они не начинают новый блок и не
     * пусты, — иначе мягкий перенос в исходнике рвал бы пункт пополам (см. startsBlock).
     */
    const listKind: Block['kind'] | null = line.startsWith('- ')
      ? 'ul'
      : /^\d+\.\s/.test(line)
        ? 'ol'
        : null;
    if (listKind === 'ul' || listKind === 'ol') {
      const items: string[] = [];
      const isItemStart = (value: string) =>
        listKind === 'ul' ? value.startsWith('- ') : /^\d+\.\s/.test(value);
      const stripMarker = (value: string) =>
        listKind === 'ul' ? value.slice(2).trim() : value.replace(/^\d+\.\s*/, '');

      while (i < lines.length) {
        const current = lines[i].trim();
        if (isItemStart(current)) {
          items.push(stripMarker(current));
          i += 1;
          continue;
        }
        // Продолжение последнего пункта.
        if (current && items.length > 0 && !startsBlock(current)) {
          items[items.length - 1] = `${items[items.length - 1]} ${current}`;
          i += 1;
          continue;
        }
        break;
      }
      blocks.push(listKind === 'ul' ? { kind: 'ul', items } : { kind: 'ol', items });
      continue;
    }

    const noteTone =
      line.startsWith('> ') ? 'info' : line.startsWith('! ') ? 'warn' : line.startsWith('+ ') ? 'tip' : null;
    if (noteTone) {
      const marker = line[0];
      const collected: string[] = [];
      while (i < lines.length) {
        const current = lines[i].trim();
        if (current.startsWith(`${marker} `)) {
          collected.push(current.slice(2).trim());
          i += 1;
          continue;
        }
        // Врезка без маркера на следующей строке — продолжение последнего абзаца врезки.
        if (current && collected.length > 0 && !startsBlock(current)) {
          collected[collected.length - 1] = `${collected[collected.length - 1]} ${current}`;
          i += 1;
          continue;
        }
        break;
      }
      /*
       * Врезка — ОДИН абзац: строки склеиваются. Иначе перенос внутри врезки рвал бы фразу
       * на середине («…считается по шагам, а» / «попадание в зону — по сумме координат»).
       * Нужны две врезки подряд — разделите их пустой строкой.
       */
      blocks.push({ kind: 'note', tone: noteTone, text: collected.join(' ') });
      continue;
    }

    if (line.startsWith('= ')) {
      const collected: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('= ')) {
        collected.push(lines[i].trim().slice(2));
        i += 1;
      }
      blocks.push({ kind: 'formula', lines: collected });
      continue;
    }

    // Абзац: всё до пустой строки или до начала другого блока.
    const paragraph: string[] = [];
    while (i < lines.length) {
      const current = lines[i].trim();
      if (!current || startsBlock(current)) break;
      paragraph.push(current);
      i += 1;
    }
    blocks.push({ kind: 'p', lines: paragraph });
  }

  return blocks;
}

// ────────────────────────────────────────────────────────────────────── вывод

const NOTE_STYLE = {
  info: { box: 'border-info/30 bg-info/8', label: 'Важно', labelClass: 'text-info' },
  warn: { box: 'border-warning/30 bg-warning/8', label: 'Осторожно', labelClass: 'text-warning' },
  tip: { box: 'border-accent/30 bg-accent/8', label: 'Совет', labelClass: 'text-accent' },
} as const;

function renderBlock(block: Block, index: number): ReactNode {
  const key = `b${index}`;

  switch (block.kind) {
    case 'h2':
      return (
        <h4
          key={key}
          className="mt-6 flex items-center gap-2 border-b border-edge-subtle pb-1 text-sm font-semibold uppercase tracking-wide text-accent first:mt-0"
        >
          {inline(block.text, key)}
        </h4>
      );

    case 'h3':
      return (
        <h5 key={key} className="mt-4 text-xs font-semibold uppercase tracking-wide text-info">
          {inline(block.text, key)}
        </h5>
      );

    case 'p':
      return (
        <p key={key} className="text-sm leading-relaxed text-content-secondary">
          {inline(block.lines.join(' '), key)}
        </p>
      );

    case 'ul':
      return (
        <ul key={key} className="space-y-1">
          {block.items.map((item, n) => (
            <li key={n} className="flex gap-2 text-sm leading-relaxed text-content-secondary">
              <span aria-hidden="true" className="mt-1.5 size-1 shrink-0 rounded-full bg-accent/70" />
              <span className="min-w-0">{inline(item, `${key}-${n}`)}</span>
            </li>
          ))}
        </ul>
      );

    case 'ol':
      return (
        <ol key={key} className="space-y-1">
          {block.items.map((item, n) => (
            <li key={n} className="flex gap-2 text-sm leading-relaxed text-content-secondary">
              <span className="shrink-0 font-mono text-2xs font-semibold text-accent">{n + 1}.</span>
              <span className="min-w-0">{inline(item, `${key}-${n}`)}</span>
            </li>
          ))}
        </ol>
      );

    case 'table': {
      const [head, ...rest] = block.rows;
      if (!head) return null;
      return (
        <div key={key} className="overflow-x-auto rounded border border-edge-subtle">
          <table className="w-full min-w-max border-collapse text-xs">
            <thead>
              <tr className="bg-white/5">
                {head.map((cell, n) => (
                  <th
                    key={n}
                    className="border-b border-edge-subtle px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-content-faint"
                  >
                    {inline(cell, `${key}-h${n}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rest.map((row, r) => (
                <tr key={r} className="odd:bg-white/[0.02]">
                  {row.map((cell, c) => (
                    <td
                      key={c}
                      className={`border-b border-edge-subtle/60 px-2 py-1.5 align-top ${
                        c === 0 ? 'text-content-primary' : 'text-content-secondary'
                      }`}
                    >
                      {inline(cell, `${key}-${r}-${c}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case 'note': {
      const style = NOTE_STYLE[block.tone];
      return (
        <div key={key} className={`rounded border-l-2 px-3 py-2 ${style.box}`}>
          <div className={`mb-0.5 text-3xs font-bold uppercase tracking-wider ${style.labelClass}`}>
            {style.label}
          </div>
          <p className="text-xs leading-relaxed text-content-secondary">
            {inline(block.text, key)}
          </p>
        </div>
      );
    }

    case 'formula':
      return (
        <pre
          key={key}
          className="overflow-x-auto rounded border border-edge-subtle bg-surface-base/60 px-3 py-2 font-mono text-2xs leading-relaxed text-accent"
        >
          {block.lines.join('\n')}
        </pre>
      );
  }
}

/** Готовая статья: разметка → блоки → узлы. */
export const HelpMarkup: React.FC<{ source: string }> = ({ source }) => {
  const blocks = React.useMemo(() => parseHelpMarkup(source), [source]);
  return <div className="space-y-3">{blocks.map(renderBlock)}</div>;
};
