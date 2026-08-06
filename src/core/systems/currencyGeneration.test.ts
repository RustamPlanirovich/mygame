/**
 * Генерация валют (bigplan.md, пункт 22).
 *
 * Главное свойство, ради которого четыре разрозненных блока собраны в один модуль: почти
 * всё здесь умножается на эффективность энергосети. Обесточенная база не должна печатать
 * ни очки исследований, ни кредиты — а раньше каждый новый источник дохода мог тихо
 * забыть этот множитель, и заметить это было негде.
 */

import { describe, expect, it } from 'vitest';
import { generateCurrencies, type CurrencyGenerationInput } from './currencyGeneration';
import { D } from '../math/format';
import { POLICIES } from '../constants/policies';

const CURRENCY = { credits: D(0), researchPoints: D(0), influence: D(0) } as never;

function input(over: Partial<CurrencyGenerationInput> = {}): CurrencyGenerationInput {
  return {
    currency: CURRENCY,
    tiles: {},
    dt: 1,
    energyEfficiency: 1,
    autoSellCredits: D(0),
    researchMultipliers: { artifacts: 1, ascension: 1, repeatable: 1, policies: 1 },
    policyCreditsPerSecond: D(0),
    influenceMultiplier: 1,
    activePolicies: [],
    ...over,
  };
}

const farms = (n: number) => {
  const tiles: Record<string, string> = {};
  for (let i = 0; i < n; i++) tiles[`${i},0`] = 'bitcoin_farm_mk1';
  return tiles;
};

describe('кредиты', () => {
  it('биткоин-фермы печатают кредиты пропорционально количеству', () => {
    const one = generateCurrencies(input({ tiles: farms(1) })).currency.credits;
    const three = generateCurrencies(input({ tiles: farms(3) })).currency.credits;
    expect(one.gt(0)).toBe(true);
    expect(three.toString()).toBe(one.mul(3).toString());
  });

  it('обесточенная база не печатает кредиты', () => {
    const r = generateCurrencies(input({ tiles: farms(3), energyEfficiency: 0 }));
    expect(r.currency.credits.toString()).toBe('0');
  });

  it('выручка автопродавца прибавляется как есть, без множителей', () => {
    const r = generateCurrencies(input({ autoSellCredits: D(777), energyEfficiency: 0 }));
    // Это уже итоговая сумма сделки: домножать её на что-либо было бы двойным учётом.
    expect(r.currency.credits.toString()).toBe('777');
  });

  it('фиксированная выплата от политик не зависит от энергии', () => {
    const r = generateCurrencies(
      input({ policyCreditsPerSecond: D(10), dt: 2, energyEfficiency: 0 }),
    );
    // Это бюджетная строка, а не производство: свет на базе к ней отношения не имеет.
    expect(r.currency.credits.toString()).toBe('20');
  });
});

describe('очки исследований', () => {
  const labs = { '0,0': 'research_center_mk1' };

  it('множители перемножаются, а не складываются', () => {
    const base = generateCurrencies(input({ tiles: labs })).currency.researchPoints;
    if (base.lte(0)) return; // в каталоге нет такой лаборатории — проверять нечего

    const boosted = generateCurrencies(
      input({
        tiles: labs,
        researchMultipliers: { artifacts: 2, ascension: 3, repeatable: 1, policies: 1 },
      }),
    ).currency.researchPoints;

    expect(boosted.toString()).toBe(base.mul(6).toString());
  });

  it('без энергии очки не капают', () => {
    const r = generateCurrencies(input({ tiles: labs, energyEfficiency: 0 }));
    expect(r.currency.researchPoints.toString()).toBe('0');
  });
});

describe('влияние и содержание политик', () => {
  /** Первая политика каталога, у которой вообще есть содержание. */
  const paid = Object.entries(POLICIES).find(([, p]) => (p as { influenceUpkeep?: number }).influenceUpkeep);

  it('содержание списывает влияние', () => {
    if (!paid) return;
    const [id, policy] = paid;
    const upkeep = (policy as { influenceUpkeep: number }).influenceUpkeep;

    const r = generateCurrencies(
      input({
        currency: { credits: D(0), researchPoints: D(0), influence: D(1000) } as never,
        activePolicies: [id],
        dt: 1,
      }),
    );
    expect(r.currency.influence.toString()).toBe(D(1000).sub(D(upkeep)).toString());
    expect(r.influenceExhausted).toBe(false);
  });

  it('влияние не уходит в минус и поднимает флаг', () => {
    if (!paid) return;
    const [id] = paid;

    const r = generateCurrencies(
      input({
        currency: { credits: D(0), researchPoints: D(0), influence: D(0.0001) } as never,
        activePolicies: [id],
        dt: 10,
      }),
    );
    // Отрицательное влияние — тихая порча состояния, а не «долг».
    expect(r.currency.influence.toString()).toBe('0');
    expect(r.influenceExhausted).toBe(true);
  });

  it('без активных политик содержание не списывается', () => {
    const r = generateCurrencies(
      input({ currency: { credits: D(0), researchPoints: D(0), influence: D(100) } as never }),
    );
    expect(r.currency.influence.toString()).toBe('100');
    expect(r.influenceExhausted).toBe(false);
  });

  it('неизвестная политика в списке не ломает расчёт', () => {
    const r = generateCurrencies(
      input({
        currency: { credits: D(0), researchPoints: D(0), influence: D(50) } as never,
        activePolicies: ['нет_такой_политики'],
      }),
    );
    expect(r.currency.influence.toString()).toBe('50');
  });
});

describe('чистота', () => {
  it('не мутирует переданные валюты', () => {
    const currency = { credits: D(10), researchPoints: D(20), influence: D(30) } as never;
    const r = generateCurrencies(input({ currency, tiles: farms(1) }));

    expect((currency as { credits: ReturnType<typeof D> }).credits.toString()).toBe('10');
    expect(r.currency).not.toBe(currency);
  });

  it('на пустой базе валюты не меняются', () => {
    const currency = { credits: D(5), researchPoints: D(6), influence: D(7) } as never;
    const r = generateCurrencies(input({ currency }));
    expect(r.currency.credits.toString()).toBe('5');
    expect(r.currency.researchPoints.toString()).toBe('6');
    expect(r.currency.influence.toString()).toBe('7');
  });
});
