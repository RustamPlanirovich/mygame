/**
 * Чат: нормализация сообщений и имя игрока (bigplan.md, пункты 12, 24).
 *
 * Ключевое здесь — управляющие символы. Перевод строки в сообщении ломает не только вёрстку,
 * но и САМ ФОРМАТ SSE: там пустая строка означает конец события, и одно такое сообщение
 * разорвало бы поток всем подключённым. Поэтому тест на это, а не на «красиво выглядит».
 */

import { describe, expect, it } from 'vitest';
import { MAX_MESSAGE_LENGTH, displayNameFromEmail, normalizeMessage } from './chat.js';

describe('normalizeMessage', () => {
  it('оставляет обычный текст, обрезая пробелы по краям', () => {
    expect(normalizeMessage('  привет  ')).toBe('привет');
  });

  it('вырезает перевод строки — иначе сообщение разорвало бы SSE-поток', () => {
    expect(normalizeMessage('первая\nвторая')).toBe('первая вторая');
    // \r\n\r\n — это ровно тот разделитель, которым SSE отмечает конец события.
    expect(normalizeMessage('a\r\n\r\nb')).toBe('a    b');
  });

  it('вырезает прочие управляющие символы', () => {
    expect(normalizeMessage('текст\u0000конец')).toBe('текст конец');
    expect(normalizeMessage('текст\tконец')).toBe('текст конец');
    expect(normalizeMessage('текст\u007fконец')).toBe('текст конец');
  });

  it('пустое и пробельное сообщение отклоняет', () => {
    expect(normalizeMessage('')).toBeNull();
    expect(normalizeMessage('   ')).toBeNull();
    expect(normalizeMessage('\n\n\n')).toBeNull();
  });

  it('слишком длинное отклоняет, а ровно по границе принимает', () => {
    expect(normalizeMessage('x'.repeat(MAX_MESSAGE_LENGTH))).toHaveLength(MAX_MESSAGE_LENGTH);
    expect(normalizeMessage('x'.repeat(MAX_MESSAGE_LENGTH + 1))).toBeNull();
  });

  it('не падает на не-строке', () => {
    expect(normalizeMessage(null)).toBeNull();
    expect(normalizeMessage(undefined)).toBeNull();
    expect(normalizeMessage(42)).toBeNull();
    expect(normalizeMessage({})).toBeNull();
  });
});

describe('displayNameFromEmail', () => {
  it('показывает часть до @, а не весь email', () => {
    // Email целиком — персональные данные, которые игрок не выбирал раскрывать в чате.
    expect(displayNameFromEmail('player@example.com')).toBe('player');
  });

  it('обрезает слишком длинное имя', () => {
    expect(displayNameFromEmail(`${'x'.repeat(100)}@mail.ru`)).toHaveLength(32);
  });

  it('на пустом или странном значении даёт запасное имя', () => {
    expect(displayNameFromEmail('')).toBe('Игрок');
    expect(displayNameFromEmail('@example.com')).toBe('Игрок');
    expect(displayNameFromEmail(null)).toBe('Игрок');
    expect(displayNameFromEmail(undefined)).toBe('Игрок');
  });
});
