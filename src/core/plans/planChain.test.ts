/**
 * Подсказка цепочки для списка производства (bigplan.md, пункт 37).
 *
 * Главное, что проверяем — завершаемость и порядок. Цикл в данных настоящий: сталь нужна на
 * постройку зданий, которые сами стоят в цепочке стали, и обход без пометки посещённых не
 * закончился бы никогда. Порядок «от сырья к цели» — это и есть смысл подсказки: чек-лист
 * выполняют сверху вниз.
 */

import { describe, expect, it } from 'vitest';
import Decimal from 'break_eternity.js';
import type { Building } from '../gameTypes';
import { buildingInputs, pickProducer, producersOf, suggestChain } from './planChain';

const D = (n: number) => new Decimal(n);

/** Минимальное здание: в тестах важны только производство, вход, стоимость и count. */
function building(partial: Partial<Building> & { id: string }): Building {
  return {
    name: partial.id,
    description: '',
    baseCost: {},
    costFactor: 1.15,
    production: {},
    count: 0,
    ...partial,
  } as Building;
}

/** Каталог-игрушка: руда и углерод → сталь → микросхема. Плюс генератор и второй тир майнера. */
const CATALOG: Building[] = [
  building({ id: 'generator_mk1', name: 'Генератор', production: { energy: D(1) }, baseCost: { energy: D(5) }, creditCost: D(50) }),
  building({ id: 'miner_mk1', name: 'Майнер v1', production: { ore: D(0.6) }, baseCost: { energy: D(100) }, creditCost: D(250) }),
  building({ id: 'miner_mk2', name: 'Майнер v2', production: { ore: D(2) }, baseCost: { energy: D(400), steel: D(20) }, creditCost: D(2500) }),
  building({ id: 'carbon_mk1', name: 'Сборщик углерода', production: { carbon: D(0.3) }, baseCost: { energy: D(140) }, creditCost: D(320) }),
  building({
    id: 'smelter_mk1',
    name: 'Плавильня',
    production: { steel: D(0.4) },
    consumption: { energy: D(1.2), ore: D(0.8), carbon: D(0.4) },
    baseCost: { energy: D(400), ore: D(120), carbon: D(60) },
    creditCost: D(800),
  }),
  building({
    id: 'chip_fab_mk1',
    name: 'Фабрика микросхем',
    production: { integrated_circuit: D(0.1) },
    consumption: { steel: D(0.5), semiconductors: D(0.2) },
    baseCost: { steel: D(80) },
    creditCost: D(4000),
  }),
];

describe('buildingInputs', () => {
  it('собирает и постоянный вход, и материалы на постройку, без дублей', () => {
    const smelter = CATALOG.find((b) => b.id === 'smelter_mk1')!;
    expect(buildingInputs(smelter)).toEqual(['ore', 'carbon']);
  });

  it('энергию не считает входом: иначе генератор приписывался бы к каждому уровню', () => {
    const miner = CATALOG.find((b) => b.id === 'miner_mk1')!;
    expect(buildingInputs(miner)).toEqual([]);
  });
});

describe('producersOf', () => {
  it('находит все тиры производителя', () => {
    expect(producersOf('ore', CATALOG).map((b) => b.id)).toEqual(['miner_mk1', 'miner_mk2']);
  });

  it('для сырья без производителя возвращает пусто — выдумывать здание нельзя', () => {
    expect(producersOf('semiconductors', CATALOG)).toEqual([]);
  });
});

describe('pickProducer', () => {
  it('при прочих равных берёт более дешёвый тир', () => {
    expect(pickProducer('ore', CATALOG)?.id).toBe('miner_mk1');
  });

  it('уже построенный тир предпочитает дешёвому: игрок пользуется именно им', () => {
    const withBuiltMk2 = CATALOG.map((b) => (b.id === 'miner_mk2' ? { ...b, count: 4 } : b));
    expect(pickProducer('ore', withBuiltMk2)?.id).toBe('miner_mk2');
  });

  it('заблокированный технологией уступает доступному, даже если тот дороже', () => {
    /*
     * Идентификаторы здесь настоящие: `miner_mk1` открывает стартовая технология basic_mining,
     * а `miner_mk2` в дереве технологий не упомянут вовсе — значит доступен всегда
     * (isBuildingUnlocked считает негейченные здания открытыми). С пустым набором технологий
     * подсказка обязана предложить mk2, хотя он в десять раз дороже: пункт «построй то, что
     * нельзя построить» бесполезен.
     */
    const noTech = {} as Record<string, boolean>;
    expect(pickProducer('ore', CATALOG, noTech)?.id).toBe('miner_mk2');

    // Технология исследована — снова выигрывает дешёвый тир.
    expect(pickProducer('ore', CATALOG, { basic_mining: true } as Record<string, boolean>)?.id).toBe(
      'miner_mk1',
    );
  });
});

describe('suggestChain', () => {
  it('разворачивает ресурс в цепочку от сырья к цели', () => {
    const chain = suggestChain({ kind: 'resource', refId: 'steel' }, CATALOG);
    expect(chain.map((s) => s.refId)).toEqual(['miner_mk1', 'carbon_mk1', 'smelter_mk1']);
    // Плавильня — цель, поэтому глубина 0, а добыча под неё лежит глубже.
    expect(chain.at(-1)).toMatchObject({ refId: 'smelter_mk1', depth: 0, producesFor: 'steel' });
    expect(chain[0].depth).toBe(1);
  });

  it('для цели-здания первым пунктом идёт само здание, а его вход — глубже', () => {
    const chain = suggestChain({ kind: 'building', refId: 'chip_fab_mk1' }, CATALOG);
    expect(chain.at(-1)).toMatchObject({ refId: 'chip_fab_mk1', depth: 0, producesFor: null });
    expect(chain.map((s) => s.refId)).toContain('smelter_mk1');
    // Полупроводники в этом каталоге никто не производит — пункта для них нет и быть не должно.
    expect(chain.map((s) => s.refId)).not.toContain('semiconductors');
  });

  it('не зацикливается на взаимной зависимости сталь ↔ майнер v2', () => {
    // miner_mk2 стоит сталь, а сталь делают из руды, которую даёт miner_mk2.
    const onlyMk2 = CATALOG.filter((b) => b.id !== 'miner_mk1');
    const chain = suggestChain({ kind: 'resource', refId: 'steel' }, onlyMk2);
    const ids = chain.map((s) => s.refId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('smelter_mk1');
    expect(ids).toContain('miner_mk2');
  });

  it('показывает, сколько таких зданий уже стоит', () => {
    const withBuilt = CATALOG.map((b) => (b.id === 'miner_mk1' ? { ...b, count: 3 } : b));
    const chain = suggestChain({ kind: 'resource', refId: 'steel' }, withBuilt);
    expect(chain.find((s) => s.refId === 'miner_mk1')?.built).toBe(3);
    expect(chain.find((s) => s.refId === 'smelter_mk1')?.built).toBe(0);
  });

  it('уважает потолок глубины и размера', () => {
    const shallow = suggestChain({ kind: 'resource', refId: 'integrated_circuit' }, CATALOG, { maxDepth: 1 });
    expect(shallow.every((s) => s.depth <= 1)).toBe(true);

    const limited = suggestChain({ kind: 'resource', refId: 'integrated_circuit' }, CATALOG, { maxItems: 2 });
    expect(limited).toHaveLength(2);
  });

  it('пустой результат на неизвестную цель и на энергию', () => {
    expect(suggestChain({ kind: 'building', refId: 'нет_такого' }, CATALOG)).toEqual([]);
    expect(suggestChain({ kind: 'resource', refId: 'нет_такого' }, CATALOG)).toEqual([]);
    // Энергия исключена сознательно: её потребляет всё, и подсказка вырождалась бы в генератор.
    expect(suggestChain({ kind: 'resource', refId: 'energy' }, CATALOG)).toEqual([]);
  });
});
