/**
 * Цепочка множителей выпуска (bigplan.md, пункт 22).
 *
 * Ради этого свойства блок и выносился из цикла: **часть множителей не применяется к
 * энергии**. Внутри 580 строк это было не видно, а последствие ошибки — либо разогнавшаяся,
 * либо схлопнувшаяся экономика, и оба случая выглядят как «неудачный баланс», а не как баг.
 */

import { describe, expect, it } from 'vitest';
import { outputMultiplier, type TileOutputInput } from './productionOutput';
import { D } from '../math/format';

function input(over: Partial<TileOutputInput> = {}): TileOutputInput {
  return {
    resource: 'ore',
    buildingLevel: 1,
    modeMultiplier: 1,
    policyBuildingMultiplier: 1,
    evolutionMultiplier: 1,
    energyEfficiency: 1,
    pollutionEfficiency: 1,
    proximityMultiplier: 1,
    exoticMultiplier: 1,
    galaxyBonus: 1,
    logisticsEfficiency: 1,
    ...over,
  };
}

describe('нейтральный случай', () => {
  it('без бонусов множитель равен единице', () => {
    expect(outputMultiplier(input()).toString()).toBe('1');
  });

  it('никогда не отрицателен', () => {
    const r = outputMultiplier(input({ buildingLevel: -5 }));
    expect(r.gte(0)).toBe(true);
  });
});

describe('множители перемножаются', () => {
  it('уровень здания даёт линейный рост', () => {
    expect(outputMultiplier(input({ buildingLevel: 4 })).toString()).toBe('4');
  });

  it('уровень, режим и эволюция перемножаются, а не складываются', () => {
    const r = outputMultiplier(
      input({ buildingLevel: 2, modeMultiplier: 3, evolutionMultiplier: 5 }),
    );
    expect(r.toString()).toBe('30');
  });

  it('политика на тип здания умножает выпуск', () => {
    expect(outputMultiplier(input({ policyBuildingMultiplier: 2 })).toString()).toBe('2');
  });

  it('бонус близости умножает выпуск', () => {
    const r = outputMultiplier(input({ proximityMultiplier: 1.5 }));
    expect(r.toString()).toBe('1.5');
  });

  it('бонус галактики умножает выпуск', () => {
    expect(outputMultiplier(input({ galaxyBonus: 3 })).toString()).toBe('3');
  });
});

describe('исключения для энергии — главное свойство модуля', () => {
  it('дефицит энергии НЕ режет выработку самой энергии', () => {
    /*
     * Иначе получилась бы обратная связь без дна: дефицит снижает выработку, снижение
     * выработки углубляет дефицит, и база гаснет навсегда с одного случайного провала.
     */
    const energy = outputMultiplier(input({ resource: 'energy', energyEfficiency: 0.2 }));
    expect(energy.toString()).toBe('1');

    const ore = outputMultiplier(input({ resource: 'ore', energyEfficiency: 0.2 }));
    expect(ore.toString()).toBe('0.2');
  });

  it('загрязнение не бьёт по электростанциям', () => {
    const energy = outputMultiplier(input({ resource: 'energy', pollutionEfficiency: 0.5 }));
    expect(energy.toString()).toBe('1');

    const ore = outputMultiplier(input({ resource: 'ore', pollutionEfficiency: 0.5 }));
    expect(ore.toString()).toBe('0.5');
  });

  it('логистический штраф не применяется к энергии', () => {
    // Энергия попадает в общий буфер напрямую — везти её по клеткам не нужно.
    const energy = outputMultiplier(input({ resource: 'energy', logisticsEfficiency: 0.4 }));
    expect(energy.toString()).toBe('1');

    const ore = outputMultiplier(input({ resource: 'ore', logisticsEfficiency: 0.4 }));
    expect(ore.toString()).toBe('0.4');
  });

  it('уровень и эволюция к энергии применяются как обычно', () => {
    const r = outputMultiplier(
      input({ resource: 'energy', buildingLevel: 3, evolutionMultiplier: 2 }),
    );
    expect(r.toString()).toBe('6');
  });

  it('все три штрафа разом: энергия не теряет ничего, руда — всё', () => {
    const penalties = { energyEfficiency: 0.5, pollutionEfficiency: 0.5, logisticsEfficiency: 0.5 };
    expect(outputMultiplier(input({ resource: 'energy', ...penalties })).toString()).toBe('1');
    expect(outputMultiplier(input({ resource: 'ore', ...penalties })).toString()).toBe('0.125');
  });
});

describe('экзотические ресурсы', () => {
  it('обычный ресурс бонус за экзотику не получает', () => {
    const r = outputMultiplier(input({ resource: 'ore', exoticMultiplier: 10 }));
    expect(r.toString()).toBe('1');
  });

  it('множитель принимает и число, и Decimal', () => {
    const asNumber = outputMultiplier(input({ galaxyBonus: 2 }));
    const withDecimal = outputMultiplier(input({ galaxyBonus: 2, exoticMultiplier: D(1) }));
    expect(withDecimal.toString()).toBe(asNumber.toString());
  });
});

describe('граничные значения', () => {
  it('нулевая эффективность обнуляет выпуск не-энергии', () => {
    expect(outputMultiplier(input({ energyEfficiency: 0 })).toString()).toBe('0');
  });

  it('множитель ровно 1 не меняет результат (ветки с проверкой !== 1)', () => {
    const base = outputMultiplier(input());
    const explicit = outputMultiplier(
      input({ policyBuildingMultiplier: 1, evolutionMultiplier: 1, galaxyBonus: 1 }),
    );
    expect(explicit.toString()).toBe(base.toString());
  });

  it('нулевой множитель близости не обнуляет выпуск', () => {
    // proximityMultiplier === 0 означает «правил близости нет», а не «выпуск нулевой»:
    // именно поэтому в цепочке стоит проверка на истинность, а не только на !== 1.
    expect(outputMultiplier(input({ proximityMultiplier: 0 })).toString()).toBe('1');
  });
});
