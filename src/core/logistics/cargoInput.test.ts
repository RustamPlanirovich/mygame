import { describe, expect, it } from 'vitest';
import { parseCargoAmount, planCargo, destinationRoom, fitCargoToDestination } from './cargoInput';
import { D } from '../../utils/bigNumber';
import type { ResourceState, ResourceType } from '../gameTypes';

function stock(entries: Record<string, string>): Partial<Record<ResourceType, ResourceState>> {
  const result: Partial<Record<ResourceType, ResourceState>> = {};
  for (const [key, amount] of Object.entries(entries)) {
    result[key as ResourceType] = { amount: D(amount), max: D('1e30'), production: D(0) };
  }
  return result;
}

describe('parseCargoAmount', () => {
  it('пустая строка и мусор дают 0', () => {
    expect(parseCargoAmount('').eq(0)).toBe(true);
    expect(parseCargoAmount(undefined).eq(0)).toBe(true);
    expect(parseCargoAmount('   ').eq(0)).toBe(true);
    expect(parseCargoAmount('abc').eq(0)).toBe(true);
    expect(parseCargoAmount('-5').eq(0)).toBe(true);
  });

  it('понимает дробь с запятой и пробелы', () => {
    expect(parseCargoAmount('0,5').eq(D('0.5'))).toBe(true);
    expect(parseCargoAmount(' 12.25 ').eq(D('12.25'))).toBe(true);
  });

  it('не теряет экспоненту: раньше parseInt("1e+21") давал 1', () => {
    expect(parseCargoAmount('1e+21').eq(D('1e21'))).toBe(true);
    expect(parseCargoAmount(D('3.5e40').toString()).eq(D('3.5e40'))).toBe(true);
  });
});

describe('planCargo', () => {
  it('обрезает количество по складу источника', () => {
    const cargo = planCargo({ ore: '1000' }, stock({ ore: '250' }));
    expect(cargo).toHaveLength(1);
    expect(cargo[0][0]).toBe('ore');
    expect(cargo[0][1].eq(250)).toBe(true);
  });

  it('пропускает нули, мусор и ресурсы, которых нет на складе', () => {
    const cargo = planCargo(
      { ore: '0', ice: 'abc', steel: '', titanium: '5' },
      stock({ ore: '100', ice: '100', steel: '100' })
    );
    expect(cargo).toHaveLength(0);
  });

  it('переносит дробный остаток целиком', () => {
    const cargo = planCargo({ ice: '10' }, stock({ ice: '0.4' }));
    expect(cargo[0][1].eq(D('0.4'))).toBe(true);
  });

  it('везёт огромные запасы без потери разрядов', () => {
    const cargo = planCargo({ ore: '1e21' }, stock({ ore: '1e25' }));
    expect(cargo[0][1].eq(D('1e21'))).toBe(true);
  });
});

/** Склад приёмника с явными лимитами: amount/max. */
function dest(entries: Record<string, [string, string]>): Partial<Record<ResourceType, ResourceState>> {
  const result: Partial<Record<ResourceType, ResourceState>> = {};
  for (const [key, [amount, max]] of Object.entries(entries)) {
    result[key as ResourceType] = { amount: D(amount), max: D(max), production: D(0) };
  }
  return result;
}

describe('destinationRoom', () => {
  it('свободное место — это max минус остаток', () => {
    expect(destinationRoom(dest({ ore: ['300', '1000'] }), 'ore')!.eq(700)).toBe(true);
  });

  it('полный склад даёт 0, переполненный — тоже 0, а не минус', () => {
    expect(destinationRoom(dest({ ore: ['1000', '1000'] }), 'ore')!.eq(0)).toBe(true);
    expect(destinationRoom(dest({ ore: ['1500', '1000'] }), 'ore')!.eq(0)).toBe(true);
  });

  it('max <= 0 — это безлимит, как и при разгрузке каравана', () => {
    expect(destinationRoom(dest({ ore: ['5', '0'] }), 'ore')).toBeNull();
  });

  it('ресурса нет на складе приёмника — влезет 0: разгрузка теряет такой груз целиком', () => {
    expect(destinationRoom(dest({ ore: ['0', '1000'] }), 'ice')!.eq(0)).toBe(true);
  });
});

describe('fitCargoToDestination', () => {
  it('делит груз на «доедет» и «сгорит при разгрузке»', () => {
    const [fit] = fitCargoToDestination([['ore', D(500)]], dest({ ore: ['800', '1000'] }));
    expect(fit.fits.eq(200)).toBe(true);
    expect(fit.excess.eq(300)).toBe(true);
  });

  it('без выбранного пункта назначения ограничения нет', () => {
    const [fit] = fitCargoToDestination([['ore', D(500)]], null);
    expect(fit.fits.eq(500)).toBe(true);
    expect(fit.excess.eq(0)).toBe(true);
  });

  it('груз в пределах свободного места проходит целиком', () => {
    const [fit] = fitCargoToDestination([['ore', D(100)]], dest({ ore: ['0', '1000'] }));
    expect(fit.fits.eq(100)).toBe(true);
    expect(fit.excess.eq(0)).toBe(true);
  });
});
