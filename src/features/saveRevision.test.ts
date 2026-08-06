/**
 * Версия сохранения (bigplan.md, пункт 30.3).
 *
 * Проверяется главное свойство: версия действительна ТОЛЬКО вместе со своим saveId.
 * Если бы хранилось одно число, после смены слота оно случайно совпало бы с версией
 * чужого сейва — и запись прошла бы туда, куда не должна, ровно в том сценарии, от
 * которого версия и защищает.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { forgetSaveRevision, getSaveRevisionFor, rememberSaveRevision } from './saveRevision';

beforeEach(() => {
  forgetSaveRevision();
});

describe('saveRevision', () => {
  it('отдаёт версию для того сейва, для которого её запомнили', () => {
    rememberSaveRevision(7, 3);
    expect(getSaveRevisionFor(7)).toBe(3);
  });

  it('для ДРУГОГО сейва версии нет — даже если она известна для текущего', () => {
    rememberSaveRevision(7, 3);
    expect(getSaveRevisionFor(8)).toBeNull();
  });

  it('после смены слота версия забыта', () => {
    rememberSaveRevision(7, 3);
    forgetSaveRevision();
    expect(getSaveRevisionFor(7)).toBeNull();
  });

  it('мусор с сервера не запоминается: старый ответ без revision не должен', () => {
    rememberSaveRevision(7, 3);
    // Ответ сборки без поддержки версий: поля нет.
    rememberSaveRevision(7, undefined);
    // Прежнее значение сохраняется — иначе один старый ответ отключил бы защиту.
    expect(getSaveRevisionFor(7)).toBe(3);

    rememberSaveRevision(7, 0);
    rememberSaveRevision(7, -1);
    rememberSaveRevision(7, 'три');
    expect(getSaveRevisionFor(7)).toBe(3);
  });

  it('нечисловой saveId не совпадает ни с чем', () => {
    rememberSaveRevision(7, 3);
    expect(getSaveRevisionFor(null)).toBeNull();
    expect(getSaveRevisionFor(undefined)).toBeNull();
    expect(getSaveRevisionFor('семь')).toBeNull();
  });

  it('строковый id из JSON приводится к числу: "7" — это тот же сейв', () => {
    rememberSaveRevision('7', '3');
    expect(getSaveRevisionFor(7)).toBe(3);
  });
});
