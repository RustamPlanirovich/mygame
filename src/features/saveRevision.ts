/**
 * ВЕРСИЯ ЗАГРУЖЕННОГО СОХРАНЕНИЯ (bigplan.md, пункт 30.3)
 *
 * Сервер считает записи сохранения (`game_save.revision`). Клиент присылает ту версию,
 * поверх которой он писал; если в БД уже другая — запись отклоняется с 409, и вместо
 * тихой потери прогресса игрок получает явное «состояние изменено, перезагружаю».
 *
 * ПОЧЕМУ НЕ В СТОРЕ. Это не игровое состояние, а факт о конкретной строке в БД: в сейв
 * ему попадать незачем (иначе версия уехала бы внутрь собственных данных), в тик — тем
 * более. Ровно та же причина, по которой вне стора живёт дедупликация админских выдач.
 *
 * ПОЧЕМУ ПАРА (saveId, revision), А НЕ ОДНО ЧИСЛО. Версии разных сейвов между собой не
 * сравнимы. После переключения слота число от предыдущего слота — мусор, который при
 * совпадении значений тихо разрешил бы запись поверх чужого прогресса. Поэтому версия
 * действительна только вместе со своим saveId, а при несовпадении не отправляется вовсе.
 */

let knownSaveId: number | null = null;
let knownRevision: number | null = null;

/** Запомнить версию, пришедшую с сервера при загрузке или успешной записи. */
export function rememberSaveRevision(saveId: unknown, revision: unknown): void {
  const id = Number(saveId);
  const rev = Number(revision);
  if (!Number.isInteger(id) || !Number.isInteger(rev) || rev <= 0) return;
  knownSaveId = id;
  knownRevision = rev;
}

/**
 * Версия для записи в этот saveId — или null, если она неизвестна либо относится к
 * другому сейву. null означает «пиши без проверки»: старое поведение, при котором
 * потеря прогресса возможна, но гарантированной не становится.
 */
export function getSaveRevisionFor(saveId: unknown): number | null {
  const id = Number(saveId);
  if (!Number.isInteger(id) || id !== knownSaveId) return null;
  return knownRevision;
}

/** Забыть версию: смена слота, выход, любой случай «дальше мы не знаем, что в БД». */
export function forgetSaveRevision(): void {
  knownSaveId = null;
  knownRevision = null;
}
