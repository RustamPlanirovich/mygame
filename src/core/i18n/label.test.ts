/**
 * Подписи: вкладки «Аналитика», «Галактика», «Цепочки» и выбор карты печатали английские id
 * (bigplan.md, пункты 3–5, 7). Тесты фиксируют, что резолвер знает весь словарь ресурсов и
 * что перевод сохранённых английских названий галактик работает без миграции сейвов.
 */

import { describe, expect, it } from 'vitest';
import { RESOURCE_LABEL } from '../constants/labels';
import {
  dangerLabel,
  depositLabel,
  humanize,
  localizeGalaxyBonus,
  localizeGeneratedName,
  resourceLabel,
  specialFeatureLabel,
  technologyLabel,
} from './label';

describe('resourceLabel', () => {
  it('знает каждый ресурс из словаря', () => {
    const ids = Object.keys(RESOURCE_LABEL);
    expect(ids.length).toBeGreaterThan(50);
    for (const id of ids) {
      const label = resourceLabel(id);
      // Ни сырого id, ни dev-заглушки ⟨…⟩ быть не должно.
      expect(label).not.toBe(id);
      expect(label).not.toContain('⟨');
      expect(label).not.toContain('_');
    }
  });

  it('переводит ресурсы, из-за которых и завели резолвер', () => {
    expect(resourceLabel('integrated_circuit')).toBe('Интегральная микросхема');
    expect(resourceLabel('natural_gas')).toBe('Природный газ');
    expect(resourceLabel('plastic')).toBe('Пластик');
  });

  it('на неизвестный id не падает', () => {
    expect(() => resourceLabel('нет_такого_ресурса')).not.toThrow();
  });
});

describe('depositLabel', () => {
  it('DepositType ⊂ ResourceType, поэтому словарь тот же', () => {
    expect(depositLabel('copper')).toBe(resourceLabel('copper'));
    expect(depositLabel('natural_gas')).toBe('Природный газ');
  });
});

describe('technologyLabel', () => {
  it('печатает название технологии, а не id', () => {
    expect(technologyLabel('basic_mining')).toBe('Базовая добыча');
  });
});

describe('dangerLabel / specialFeatureLabel', () => {
  it('покрывает все уровни опасности', () => {
    for (const level of ['very_low', 'low', 'medium', 'high', 'very_high', 'extreme']) {
      expect(dangerLabel(level)).not.toContain('⟨');
      expect(dangerLabel(level)).not.toBe(level);
    }
  });

  it('на null-особенности возвращает пустую строку, а не «⟨null⟩»', () => {
    expect(specialFeatureLabel(null as unknown as string)).toBe('');
    expect(specialFeatureLabel('black_hole')).toBe('Чёрная дыра');
  });
});

describe('localizeGeneratedName', () => {
  it('переводит сохранённые английские названия галактик', () => {
    expect(localizeGeneratedName('Crimson Expanse')).toBe('Багровая Ширь');
    expect(localizeGeneratedName('Shadow Depths')).toBe('Теневая Глубины');
  });

  it('ставит греческую букву после существительного', () => {
    expect(localizeGeneratedName('Alpha Nexus')).toBe('Узел Альфа');
    expect(localizeGeneratedName('Omega Core')).toBe('Ядро Омега');
  });

  it('русские названия оставляет как есть', () => {
    expect(localizeGeneratedName('Багровая Ширь')).toBe('Багровая Ширь');
    expect(localizeGeneratedName('Узел Альфа')).toBe('Узел Альфа');
  });

  it('не падает на пустой строке', () => {
    expect(localizeGeneratedName('')).toBe('');
  });
});

describe('localizeGalaxyBonus', () => {
  it('переводит сохранённые английские бонусы', () => {
    expect(localizeGalaxyBonus('Global Production +5%')).toBe('Общее производство +5%');
  });

  it('незнакомую строку возвращает без изменений', () => {
    expect(localizeGalaxyBonus('Что-то своё')).toBe('Что-то своё');
  });
});

describe('humanize', () => {
  it('используется только как последний рубеж', () => {
    expect(humanize('some_unknown_id')).toBe('Some unknown id');
  });
});
