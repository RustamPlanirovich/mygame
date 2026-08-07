import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../features/gameStore';
import { useFinanceStore } from '../features/financeStore';
import { checkAchievements } from '../utils/achievementsHelpers';
import { playSfx } from '../core/audio/sfx';
import { getMapDefinition, mapCompletionGoal } from '../core/constants/maps';
import type { GameState } from '../core/gameTypes';

/**
 * Пройдена ли текущая карта (bigplan.md, замечание к итерации 11).
 *
 * Критерий — развёрнутая база: сколько зданий стоит на карте против цели по сложности.
 * Проверяется ЗДЕСЬ, в игровом цикле, а не внутри `tick`: `completeMap` — это отдельный
 * `set`, и вызов его из апдейтера был бы вложенным `set` внутри `set` — тем самым
 * шаблоном, который в этом проекте уже молча терял начисления (пункт 36).
 */
function isCurrentMapCompleted(state: GameState): boolean {
  const mapId = state.maps.currentMapId;
  if (!mapId) return false;
  // Уже засчитано за эту партию.
  if (state.maps.activeMapData?.completedAt) return false;

  const goal = mapCompletionGoal(getMapDefinition(mapId));
  if (!Number.isFinite(goal)) return false;

  let placed = 0;
  for (const _key in state.grid.tiles) {
    placed++;
    if (placed >= goal) return true;
  }
  return false;
}

/**
 * Сколько времени, пока вкладка была скрыта, база НЕ СЧИТАЛАСЬ (мс) — вход офлайн-добычи.
 *
 * Не «сколько вкладка была скрыта»: отдельные браузеры продолжают будить rAF в фоне, и за
 * эти кадры выработка уже начислена по полной ставке. Оплачивать их вторым разом по офлайн-
 * ставке значило бы платить дважды, поэтому просчитанное игровое время вычитается.
 *
 * Отрицательного результата не бывает: системные часы могут прыгнуть назад, и «долгом»
 * это становиться не должно.
 */
export function unsimulatedAwayMs(
  hiddenSince: number | null,
  simulatedMs: number,
  now: number,
): number {
  if (hiddenSince === null || !Number.isFinite(hiddenSince) || !Number.isFinite(now)) return 0;
  return Math.max(0, now - hiddenSince - Math.max(0, simulatedMs));
}

/** Сколько незавершённых работ на базе. Дёшево: в очереди обычно 0-3 записи. */
function countTileJobs(state: GameState): number {
  const jobs = state.grid.tileJobs;
  if (!jobs) return 0;
  return Object.keys(jobs).length;
}

/**
 * СУПЕР-ОПТИМИЗИРОВАННЫЙ игровой цикл
 * 
 * Ключевые оптимизации для достижения 120 FPS:
 * 1. РАЗДЕЛЕНИЕ логики и рендеринга: tick() вызывается реже (15-30 раз/сек)
 * 2. requestAnimationFrame работает на полной скорости для плавного UI
 * 3. Тяжёлые операции (achievements, signals) вынесены в отдельные интервалы
 * 4. Батчинг обновлений состояния
 */
export const useOptimizedGameLoop = (targetFPS: number = 60) => {
  // ОПТИМИЗАЦИЯ: Получаем функции один раз, не подписываясь на изменения
  const tickRef = useRef(useGameStore.getState().tick);
  // Нужен для сброса сейва при скрытии вкладки (см. эффект visibilitychange ниже).
  const saveGameRef = useRef(useGameStore.getState().saveGame);
  
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();
  const accumulatedTimeRef = useRef<number>(0);
  const achievementCheckRef = useRef<number>(0);
  const signalCheckRef = useRef<number>(0);
  const rulesCheckRef = useRef<number>(0);
  const financeCheckRef = useRef<number>(0);
  const mapCheckRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(0);
  const lastLogTimeRef = useRef<number>(0);

  /*
   * Учёт свёрнутой вкладки — вход офлайн-добычи (см. эффект visibilitychange ниже).
   * `hiddenSince` — когда вкладку скрыли, `simulatedWhileHidden` — сколько ИГРОВОГО времени
   * всё-таки успело просчитаться за это время: отдельные браузеры будят rAF и в фоне, и за
   * эти кадры база уже получила своё по полной ставке.
   */
  const isHiddenRef = useRef<boolean>(false);
  const hiddenSinceRef = useRef<number | null>(null);
  const simulatedWhileHiddenRef = useRef<number>(0);

  // КЛЮЧЕВАЯ ОПТИМИЗАЦИЯ: Логика обновляется с фиксированной частотой
  // Для idle-игры 20 тиков/сек достаточно - визуально разницы нет
  // Это снижает нагрузку tick() в 3-6 раз при целевых 60-120 FPS
  const LOGIC_FPS = Math.min(targetFPS, 20); // Логика max 20 раз в секунду
  const logicFrameTime = 1000 / LOGIC_FPS;
  const maxFrameTime = logicFrameTime * 3;

  // Обновляем ссылки при изменении store
  useEffect(() => {
    const unsubscribe = useGameStore.subscribe((state) => {
      tickRef.current = state.tick;
      saveGameRef.current = state.saveGame;
    });
    return unsubscribe;
  }, []);

  const animate = useCallback((time: number) => {
    if (previousTimeRef.current === undefined) {
      previousTimeRef.current = time;
    }

    const deltaTime = time - previousTimeRef.current;
    previousTimeRef.current = time;

    // Накапливаем время
    accumulatedTimeRef.current += deltaTime;

    // Ограничиваем накопление чтобы избежать "спирали смерти"
    if (accumulatedTimeRef.current > maxFrameTime) {
      accumulatedTimeRef.current = maxFrameTime;
    }

    // ОПТИМИЗАЦИЯ: Максимум 2 обновления за кадр (вместо 5)
    // Это предотвращает ситуацию когда один тяжёлый кадр вызывает каскад
    let updates = 0;
    const maxUpdates = 2;

    while (accumulatedTimeRef.current >= logicFrameTime && updates < maxUpdates) {
      const dt = logicFrameTime / 1000; // Конвертируем в секунды
      
      // ОПТИМИЗАЦИЯ: Вызываем tick напрямую через ref
      /*
       * Звук завершения стройки/улучшения (bigplan.md, пункты 16, 18, 19). Ловим по уменьшению
       * числа работ в очереди: сам tick — чистый апдейтер, и звать из него звук значило бы
       * тащить сайд-эффект в reducer (тот самый антипаттерн из пункта 36).
       */
      const jobsBefore = countTileJobs(useGameStore.getState());

      tickRef.current(dt);

      if (jobsBefore > 0 && countTileJobs(useGameStore.getState()) < jobsBefore) {
        playSfx('complete');
      }

      /*
       * ЗДЕСЬ БЫЛО ВТОРОЕ АВТОСОХРАНЕНИЕ — и это был не дубль-безобидность, а причина
       * потери прогресса.
       *
       * `useAutosave(30)` в App.tsx уже пишет сейв раз в 30 секунд. Этот таймер писал его
       * ещё раз, со своим отсчётом по игровому времени: в БД шло ДВЕ записи за 30 секунд
       * (видно по game_save.revision — +2 за полминуты), каждая на ~1 МБ. Хуже трафика то,
       * что каждая запись — это ещё один шанс разойтись версиями: проигравшая гонку запись
       * получает 409 SAVE_OUTDATED, а обработчик конфликта перезагружает состояние с
       * сервера и ВЫБРАСЫВАЕТ всё несохранённое. Игрок менял продвинутые настройки здания,
       * ловил 409 — и настройка исчезала вместе с остальными несохранёнными действиями.
       *
       * Автосохранение теперь ровно одно, в App.tsx.
       */

      // Achievement checking - раз в 10 секунд (было 5)
      achievementCheckRef.current += dt;
      if (achievementCheckRef.current >= 10) {
        const state = useGameStore.getState();
        // Запускаем в следующем микротаске чтобы не блокировать текущий кадр
        queueMicrotask(() => checkAchievements(state));
        achievementCheckRef.current = 0;
      }

      // Signal Interception: раз в 1 секунду (было 0.5)
      signalCheckRef.current += dt;
      if (signalCheckRef.current >= 1) {
        const signalState = useGameStore.getState();
        signalState.spawnNewSignal();
        signalState.updateSignals();
        signalCheckRef.current = 0;
      }

      /*
       * Правила автоматизации зданий (bigplan 42): раз в 1 секунду.
       * ЗДЕСЬ, а не в `tick`, по той же причине, что и прохождение карты: сработавшее
       * правило может выдать уведомление, а `addNotification` — отдельный `set`, и вызов
       * из апдейтера был бы вложенным `set` внутри `set` (пункт 36). Чаще секунды незачем:
       * правила читают запасы, энергобаланс и цены, а те меняются секундами.
       */
      rulesCheckRef.current += dt;
      if (rulesCheckRef.current >= 1) {
        rulesCheckRef.current = 0;
        useGameStore.getState().applyBuildingRules();
      }

      /*
       * Прохождение карты: раз в 2 секунды. Реже нельзя — игрок ждал бы отметки после
       * последнего здания; чаще незачем — критерий меняется только при постройке.
       */
      mapCheckRef.current += dt;
      if (mapCheckRef.current >= 2) {
        mapCheckRef.current = 0;
        const mapState = useGameStore.getState();
        if (isCurrentMapCompleted(mapState)) mapState.completeMap();
      }

      // Finance update: раз в 5 секунд (обновление акций, процентов, кредитов)
      financeCheckRef.current += dt;
      if (financeCheckRef.current >= 5) {
        const financeStore = useFinanceStore.getState();
        queueMicrotask(() => financeStore.updateFinance());
        financeCheckRef.current = 0;
      }

      // Просчитанное в фоне игровое время вычтется из офлайна: платить дважды не за что.
      if (isHiddenRef.current) simulatedWhileHiddenRef.current += logicFrameTime;

      accumulatedTimeRef.current -= logicFrameTime;
      updates++;
    }

    // Подсчет FPS
    frameCountRef.current++;
    if (time - lastFpsUpdateRef.current >= 1000) {
      fpsRef.current = frameCountRef.current;
      frameCountRef.current = 0;
      lastFpsUpdateRef.current = time;

      // Логируем только если FPS < 30 и не чаще раза в 5 секунд
      if (fpsRef.current < 30 && time - lastLogTimeRef.current >= 5000) {
        console.warn(`[GameLoop] Low FPS: ${fpsRef.current}`);
        lastLogTimeRef.current = time;
      }
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [logicFrameTime, maxFrameTime]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [animate]);

  /*
   * СБРОС НА СЕРВЕР ПРИ УХОДЕ СО СТРАНИЦЫ.
   *
   * Автосейв — таймер на 30 секунд, и других записей не было вообще. Всё, что игрок сделал в
   * последние полминуты, до сервера не доезжало: «изменил настройку здания → перезагрузил
   * страницу → настройка слетела». Для ресурсов это незаметно (их пересчитывает тик и офлайн-
   * добыча), а вот одиночный клик — режим работы, приоритет, правило автоматизации — терялся
   * целиком, потому что восстановить его не из чего.
   *
   * Событие — `visibilitychange` на скрытие, а не `beforeunload`: к моменту beforeunload
   * страница уже умирает и обычный fetch отменяется, а `keepalive` тут не спасает — у него
   * лимит тела 64 КБ, тогда как сейв развитой базы больше мегабайта. Скрытие вкладки
   * происходит РАНЬШЕ выгрузки (и при закрытии, и при перезагрузке, и при переключении
   * вкладки), страница в этот момент ещё жива и запрос успевает уйти.
   *
   * Таймер после сброса не сбрасываем намеренно: `saveGame` сам не даст двум записям идти
   * одновременно (см. saveInFlight), а лишний автосейв через несколько секунд безвреден.
   *
   * ВОЗВРАЩЕНИЕ К СВЁРНУТОЙ ВКЛАДКЕ — ТОЖЕ ОФЛАЙН (второе назначение этого же эффекта).
   *
   * rAF в скрытой вкладке браузер не вызывает, а накопитель времени зажат `maxFrameTime`:
   * догоняющих тиков нет, база стоит намертво. При этом отчёт об офлайн-добыче считался
   * ТОЛЬКО в `loadGame`, то есть при перезагрузке страницы. Игрок, который свернул вкладку
   * (или закрыл крышку ноутбука) на четверть часа и вернулся в ту же вкладку, не получал
   * ничего: ни выработки, потому что тик не шёл, ни компенсации, потому что сейв не грузился.
   * Ровно так офлайн-добыча и выглядела «неработающей».
   *
   * Считаем не «сколько вкладка была скрыта», а сколько времени НЕ БЫЛО ПРОСЧИТАНО:
   * фоновые кадры, если браузер их всё-таки дал, уже начислены по полной ставке.
   *
   * Порог в 60 секунд (OFFLINE_MIN_SECONDS) остаётся за computeOfflineMining, поэтому
   * переключение на соседнюю вкладку и обратно окна не открывает.
   */
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        isHiddenRef.current = true;
        hiddenSinceRef.current = Date.now();
        simulatedWhileHiddenRef.current = 0;

        /*
         * Висящий отчёт забираем за игрока — тем же правилом, по которому его начисляет
         * крестик в окне: потерять добычу, уйдя со страницы с открытой модалкой, нельзя.
         * Заодно это гарантия для creditOfflineMining, что перетирать будет нечего.
         * claimOfflineMining сам пишет сейв, поэтому отдельный сброс тут не нужен.
         */
        const store = useGameStore.getState();
        if (store.offlineMining) store.claimOfflineMining();
        else void saveGameRef.current();
        return;
      }

      isHiddenRef.current = false;
      const now = Date.now();
      const away = unsimulatedAwayMs(hiddenSinceRef.current, simulatedWhileHiddenRef.current, now);
      hiddenSinceRef.current = null;
      simulatedWhileHiddenRef.current = 0;
      if (away <= 0) return;

      useGameStore.getState().creditOfflineMining(now - away);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  return {
    getFPS: () => fpsRef.current,
  };
};

/**
 * Вариант с переменным временем шага (более простой, но менее точный)
 */
export const useVariableGameLoop = () => {
  const tick = useGameStore(state => state.tick);
  const saveGame = useGameStore(state => state.saveGame);
  
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();
  const saveTimeRef = useRef<number>(0);
  const achievementCheckRef = useRef<number>(0);

  const animate = (time: number) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = (time - previousTimeRef.current) / 1000;
      
      // Ограничиваем deltaTime для предотвращения огромных скачков
      const cappedDelta = Math.min(deltaTime, 0.1);
      
      // Пропускаем кадр если он слишком маленький (> 120 FPS)
      if (deltaTime < 0.008) {
        requestRef.current = requestAnimationFrame(animate);
        return;
      }
      
      tick(cappedDelta);

      saveTimeRef.current += cappedDelta;
      if (saveTimeRef.current >= 30) {
        void saveGame();
        saveTimeRef.current = 0;
      }

      achievementCheckRef.current += cappedDelta;
      if (achievementCheckRef.current >= 2) {
        const state = useGameStore.getState();
        checkAchievements(state);
        achievementCheckRef.current = 0;
      }
    }
    
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);
};
