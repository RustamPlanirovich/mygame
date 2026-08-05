/**
 * Сценарий игры (bigplan.md, пункты 20, 29).
 *
 * Проверяется прежде всего то, что в цепочке легко испортить и невозможно заметить глазами:
 * условия должны быть выполнимыми, ссылки на панели — существующими, а порядок — соответствовать
 * зависимостям игры (нельзя просить продать на бирже раньше, чем игрок научился производить).
 */

import { describe, expect, it } from 'vitest';
import { SCENARIO, SCENARIO_IDS, getScenarioStep } from './scenario';
import { useGameStore } from '../../features/gameStore';
import type { GameState } from '../gameTypes';

/** Разделы панели, которые реально существуют (список из SidePanel + uiStore). */
const KNOWN_SECTIONS = new Set([
  'build', 'inspector', 'quests', 'combat', 'market', 'finance', 'analytics', 'research',
  'culture', 'politics', 'galaxies', 'platforms', 'fleet', 'logistics', 'events', 'achievements',
  'megastructures', 'help', 'demons', 'prestige', 'artifacts', 'rewards', 'chains', 'chat',
  'expedition', 'power', 'settings', 'menu',
]);

describe('структура цепочки', () => {
  it('шаги есть и их id уникальны', () => {
    expect(SCENARIO.length).toBeGreaterThan(5);
    expect(new Set(SCENARIO_IDS).size).toBe(SCENARIO.length);
  });

  it('у каждого шага заполнены что, зачем и условие', () => {
    for (const step of SCENARIO) {
      expect(step.title, step.id).toBeTruthy();
      // «Зачем» — это и есть обучающая часть: без неё шаг превращается в задание без смысла.
      expect(step.why, step.id).toBeTruthy();
      expect(typeof step.check, step.id).toBe('function');
    }
  });

  it('у каждого шага сказано, ГДЕ это находится — ровно это просили в задании', () => {
    for (const step of SCENARIO) {
      expect(step.where, step.id).toBeTruthy();
    }
  });

  it('все ссылки на панели существуют', () => {
    // Опечатка в section дала бы кнопку «Показать где», которая ничего не открывает.
    for (const step of SCENARIO) {
      if (!step.section) continue;
      expect(KNOWN_SECTIONS.has(step.section), `${step.id}: ${step.section}`).toBe(true);
    }
  });

  it('награды положительные', () => {
    for (const step of SCENARIO) {
      if (!step.reward) continue;
      const values = Object.values(step.reward).filter((v) => v !== undefined) as number[];
      expect(values.length, step.id).toBeGreaterThan(0);
      for (const v of values) expect(v, step.id).toBeGreaterThan(0);
    }
  });

  it('getScenarioStep находит по id и не падает на неизвестном', () => {
    expect(getScenarioStep(SCENARIO_IDS[0])?.id).toBe(SCENARIO_IDS[0]);
    expect(getScenarioStep('нет_такого')).toBeUndefined();
  });
});

describe('условия на реальном состоянии', () => {
  /** Свежая игра: ни один шаг, кроме, возможно, тривиальных, ещё не выполнен. */
  function freshState(): GameState {
    useGameStore.getState().resetGame();
    return useGameStore.getState();
  }

  it('ни одно условие не падает на свежем состоянии', () => {
    // Условия читают глубокие срезы (grid.tileLevels, prestige, politics); отсутствие любого
    // из них уронило бы тик, потому что проверка идёт внутри tick.
    const state = freshState();
    for (const step of SCENARIO) {
      expect(() => step.check(state), step.id).not.toThrow();
    }
  });

  it('на свежей игре первый шаг ещё НЕ выполнен', () => {
    // Иначе сценарий проскакивал бы первые цели, ничему не научив.
    const state = freshState();
    expect(SCENARIO[0].check(state)).toBe(false);
  });

  it('первый шаг закрывается постройкой генератора', () => {
    const state = freshState();
    expect(SCENARIO[0].check(state)).toBe(false);

    // Ставим здание напрямую в грид: проверяем условие, а не механику постройки.
    useGameStore.setState((s) => ({
      grid: { ...s.grid, tiles: { ...s.grid.tiles, '0,0': 'generator_mk1' } },
    }));

    expect(SCENARIO[0].check(useGameStore.getState())).toBe(true);
  });

  it('шаг про масштаб требует именно много зданий', () => {
    const scaleStep = getScenarioStep('scale');
    expect(scaleStep).toBeDefined();

    const state = freshState();
    expect(scaleStep!.check(state)).toBe(false);

    const tiles: Record<string, string> = {};
    for (let i = 0; i < 30; i++) tiles[`${i},0`] = 'solar_panel_mk1';
    useGameStore.setState((s) => ({ grid: { ...s.grid, tiles } }));

    expect(scaleStep!.check(useGameStore.getState())).toBe(true);
  });

  it('последний шаг про бесконечность закрывается престижем', () => {
    const last = SCENARIO[SCENARIO.length - 1];
    const state = freshState();
    expect(last.check(state)).toBe(false);

    useGameStore.setState((s) => ({ prestige: { ...s.prestige, prestigeCount: 1 } }));
    expect(last.check(useGameStore.getState())).toBe(true);
  });
});

describe('порядок шагов', () => {
  it('энергия идёт раньше добычи и переработки', () => {
    /*
     * Порядок не косметика: без энергии добывающие здания стоят, а без сырья нечего
     * перерабатывать. Шаг, который нельзя выполнить из-за отсутствия предыдущего, сделал бы
     * сценарий тупиком.
     */
    const idx = (id: string) => SCENARIO_IDS.indexOf(id);
    expect(idx('energy')).toBeLessThan(idx('mining'));
    expect(idx('mining')).toBeLessThan(idx('processing'));
    expect(idx('processing')).toBeLessThan(idx('market'));
  });

  it('шаг про бесконечность — последний', () => {
    // Игра бесконечная, поэтому цепочка обязана заканчиваться «дальше растите так», а не
    // «обучение завершено».
    expect(SCENARIO[SCENARIO.length - 1].id).toBe('endless');
  });
});
