/**
 * Тесты чистого слоя справки.
 *
 * ЧТО ИМЕННО ЗДЕСЬ ЛОВИТСЯ. Прошлая справка сломалась не «сложной логикой», а двумя тихими
 * дефектами: вкладка «Здания и Ресурсы» фильтровала статьи по категории, которой у них не
 * было (пустой экран), и текст с цифрами разошёлся с балансом. Оба класса проверяются:
 * структура оглавления (каждая запись живёт в существующем разделе, id уникальны) и
 * согласованность справочника с каталогом зданий.
 *
 * Компоненты сюда не тянутся: окружение тестов — node, без jsdom.
 */

import { describe, expect, it } from 'vitest';
import Decimal from 'break_eternity.js';
import { D } from '../../../core/math/format';
import type { Building, ResourceType } from '../../../core/gameTypes';
import { HELP_ENTRIES, HELP_ARTICLES, HELP_REFERENCES } from './articles';
import { HELP_SECTIONS, isReference, searchableText } from './helpTypes';
import { parseHelpMarkup } from './HelpArticle';
import { buildBuildingReference, buildingFacts, groupBuildings } from './buildingReference';
import { buildResourceReference, groupResources } from './resourceReference';

// ─────────────────────────────────────────────────────────── оглавление

describe('оглавление справки', () => {
  it('id уникальны: иначе выбор темы открывал бы не ту статью', () => {
    const ids = HELP_ENTRIES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('каждая запись лежит в существующем разделе', () => {
    const sections = new Set(HELP_SECTIONS.map((s) => s.id));
    for (const entry of HELP_ENTRIES) {
      expect(sections.has(entry.section), `${entry.id}: раздел "${entry.section}"`).toBe(true);
    }
  });

  it('в каждом разделе есть хотя бы одна запись — пустой раздел выглядит как поломка', () => {
    for (const section of HELP_SECTIONS) {
      const count = HELP_ENTRIES.filter((entry) => entry.section === section.id).length;
      expect(count, `раздел "${section.id}" пуст`).toBeGreaterThan(0);
    }
  });

  it('у статей непустой текст, у справочников — свой вид', () => {
    for (const entry of HELP_ENTRIES) {
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.summary.length).toBeGreaterThan(0);
      if (isReference(entry)) {
        expect(['buildings', 'resources', 'technologies', 'policies']).toContain(entry.kind);
      } else {
        expect(entry.body.trim().length).toBeGreaterThan(200);
      }
    }
  });

  it('справочники объявлены только в разделе reference', () => {
    for (const reference of HELP_REFERENCES) {
      expect(reference.section).toBe('reference');
    }
  });

  it('поиск находит статью по слову из её текста, а не только из заголовка', () => {
    const article = HELP_ARTICLES.find((a) => a.id === 'offline');
    expect(article).toBeDefined();
    // «ночная смена» упоминается в тексте статьи про офлайн, но не в заголовке.
    expect(searchableText(article!)).toContain('ночная смена');
  });
});

// ─────────────────────────────────────────────────────── разбор разметки

describe('разметка статей', () => {
  it('разбирает заголовки, списки, таблицы, врезки и формулы', () => {
    const blocks = parseHelpMarkup(
      [
        '## Заголовок',
        '',
        'Абзац из двух',
        'строк.',
        '',
        '### Подзаголовок',
        '- пункт один',
        '- пункт два',
        '',
        '1. первый',
        '2. второй',
        '',
        '| a | b |',
        '|---|---|',
        '| 1 | 2 |',
        '',
        '> важно',
        '',
        '! осторожно',
        '',
        '+ совет',
        '= x = y',
      ].join('\n'),
    );

    expect(blocks.map((b) => b.kind)).toEqual([
      'h2',
      'p',
      'h3',
      'ul',
      'ol',
      'table',
      'note',
      'note',
      'note',
      'formula',
    ]);

    const paragraph = blocks[1];
    if (paragraph.kind !== 'p') throw new Error('ожидался абзац');
    expect(paragraph.lines).toEqual(['Абзац из двух', 'строк.']);

    const table = blocks[5];
    if (table.kind !== 'table') throw new Error('ожидалась таблица');
    // Строка-разделитель `|---|---|` в вывод не попадает.
    expect(table.rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('не падает на пустом тексте', () => {
    expect(parseHelpMarkup('')).toEqual([]);
    expect(parseHelpMarkup('\n\n\n')).toEqual([]);
  });

  /*
   * Статьи набраны с мягким переносом, поэтому пункт списка почти всегда занимает несколько
   * строк исходника. Раньше сборщик пунктов останавливался на первой строке-продолжении, и
   * длинный пункт разваливался на список из одного элемента плюс абзац.
   */
  it('склеивает перенесённые строки пунктов списка', () => {
    const blocks = parseHelpMarkup(
      ['- первый пункт, который', 'перенесён на вторую строку;', '- второй пункт.'].join('\n'),
    );
    expect(blocks).toHaveLength(1);
    const list = blocks[0];
    if (list.kind !== 'ul') throw new Error('ожидался список');
    expect(list.items).toEqual([
      'первый пункт, который перенесён на вторую строку;',
      'второй пункт.',
    ]);
  });

  it('склеивает перенесённые строки нумерованного пункта', () => {
    const blocks = parseHelpMarkup(
      ['1. поставьте генератор:', 'без него ничего не работает.', '2. поставьте майнер.'].join('\n'),
    );
    expect(blocks).toHaveLength(1);
    const list = blocks[0];
    if (list.kind !== 'ol') throw new Error('ожидался нумерованный список');
    expect(list.items).toEqual([
      'поставьте генератор: без него ничего не работает.',
      'поставьте майнер.',
    ]);
  });

  it('врезка не съедает следующий блок', () => {
    const blocks = parseHelpMarkup(['> важно и', 'с переносом', '', '## Дальше'].join('\n'));
    expect(blocks.map((b) => b.kind)).toEqual(['note', 'h2']);
    const note = blocks[0];
    if (note.kind !== 'note') throw new Error('ожидалась врезка');
    expect(note.text).toBe('важно и с переносом');
  });

  it('каждая статья разбирается без потери текста', () => {
    for (const article of HELP_ARTICLES) {
      const blocks = parseHelpMarkup(article.body);
      expect(blocks.length, `${article.id}: пустой разбор`).toBeGreaterThan(0);
    }
  });
});

// ────────────────────────────────────────────────── справочник зданий

/** Минимальный каталог: ровно те поля, по которым справочник делает выводы. */
function catalog(): Building[] {
  return [
    {
      id: 'miner_mk1',
      name: 'Авто-Майнер v1',
      description: 'Бур для железной руды.',
      baseCost: { energy: D(100) },
      creditCost: D(250),
      costFactor: 1.15,
      production: { ore: D(0.6) },
      energyConsumption: D(1.8),
      count: 3,
    },
    {
      id: 'solar_panel_mk1',
      name: 'Солнечная Панель v1',
      description: 'Энергия из света.',
      baseCost: { steel: D(20) },
      creditCost: D(400),
      costFactor: 1.15,
      production: { energy: D(3.5) },
      powerGridRadius: 5,
      count: 0,
    },
    {
      id: 'steel_smelter_mk1',
      name: 'Плавильня: Сталь',
      description: 'Руда + углерод → сталь.',
      baseCost: { energy: D(400), ore: D(120), carbon: D(60) },
      creditCost: D(800),
      costFactor: 1.15,
      consumption: { energy: D(1.2), ore: D(0.8), carbon: D(0.4) },
      production: { steel: D(0.4) },
      count: 0,
    },
    {
      id: 'turret_mk1',
      name: 'Турель Mk.I',
      description: 'Стреляет по Глитчам.',
      baseCost: { energy: D(550), steel: D(12) },
      creditCost: D(1200),
      costFactor: 1.18,
      production: {},
      combat: { dps: D(3), energyPerSecond: D(0.9) },
      count: 0,
    },
    {
      id: 'nuclear_power_plant',
      name: 'Атомная Электростанция',
      description: 'Реактор на обогащённом уране.',
      baseCost: { steel: D(400) },
      creditCost: D(25000),
      costFactor: 1.28,
      consumption: { enriched_uranium: D(0.03) },
      production: { energy: D(180) },
      powerGridRadius: 8,
      count: 0,
    },
  ];
}

describe('справочник зданий', () => {
  it('раскладывает здания по группам по данным, а не по названию', () => {
    const facts = buildBuildingReference(catalog());
    const byId = new Map(facts.map((f) => [f.id, f]));

    // Добытчик определяется требованием месторождения — по названию его не отличить.
    expect(byId.get('miner_mk1')!.group).toBe('mining');
    expect(byId.get('solar_panel_mk1')!.group).toBe('energy');
    expect(byId.get('steel_smelter_mk1')!.group).toBe('production');
    expect(byId.get('turret_mk1')!.group).toBe('defense');
    expect(byId.get('nuclear_power_plant')!.group).toBe('energy');
  });

  it('различает пассивный и активный расход энергии', () => {
    const miner = buildingFacts(catalog()[0]);
    expect(miner.passiveEnergy?.eq(D(1.8))).toBe(true);
    expect(miner.activeEnergy).toBeNull();

    const smelter = buildingFacts(catalog()[2]);
    // 1.2 объявлено в consumption.energy — это активная часть, а не пассивная.
    expect(smelter.passiveEnergy).toBeNull();
    expect(smelter.activeEnergy?.eq(D(1.2))).toBe(true);
    // Энергия не попадает в список входного сырья: у неё своя строка.
    expect(smelter.consumption.map((e) => e.resource)).toEqual(['ore', 'carbon']);
  });

  it('месторождение под добытчиком берётся из таблицы игры', () => {
    expect(buildingFacts(catalog()[0]).requiredDeposit).toBe('ore');
    expect(buildingFacts(catalog()[1]).requiredDeposit).toBeNull();
  });

  it('мусор — 1% выпуска, но не у генераторов и панелей', () => {
    // 0.6 руды/с → 0.006 мусора/с.
    expect(buildingFacts(catalog()[0]).wastePerSecond).toBeCloseTo(0.006, 6);
    // Панель производит 3.5 энергии и не мусорит вовсе.
    expect(buildingFacts(catalog()[1]).wastePerSecond).toBe(0);
  });

  it('радиоактивные отходы считаются у ядерных зданий', () => {
    expect(buildingFacts(catalog()[4]).radioactivePerSecond).toBe(0.05);
    expect(buildingFacts(catalog()[0]).radioactivePerSecond).toBe(0);
  });

  it('маржа считается только когда торгуется вся цепочка', () => {
    // Руда 0.6/с × 2 ₡ = 1.2 ₡/с, входов нет.
    expect(buildingFacts(catalog()[0]).marketMarginPerSecond).toBeCloseTo(1.2, 6);
    // Сталь 0.4 × 15 − (руда 0.8 × 2 + углерод 0.4 × 4) = 6 − 3.2 = 2.8 ₡/с.
    expect(buildingFacts(catalog()[2]).marketMarginPerSecond).toBeCloseTo(2.8, 6);
    // Турель ничего не производит и не потребляет — сравнивать нечего.
    expect(buildingFacts(catalog()[3]).marketMarginPerSecond).toBeNull();
  });

  it('в поиск попадают id и ресурсы, а не только название', () => {
    const smelter = buildingFacts(catalog()[2]);
    expect(smelter.search).toContain('steel_smelter_mk1');
    expect(smelter.search).toContain('carbon');
  });

  it('группировка не теряет и не дублирует записи', () => {
    const facts = buildBuildingReference(catalog());
    const grouped = groupBuildings(facts);
    const total = grouped.reduce((sum, entry) => sum + entry.items.length, 0);
    expect(total).toBe(facts.length);
    for (const entry of grouped) expect(entry.items.length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────── справочник ресурсов

describe('справочник ресурсов', () => {
  const baseCaps: Partial<Record<ResourceType, Decimal>> = {
    energy: D(500),
    ore: D(1000),
    carbon: D(800),
    steel: D(300),
    enriched_uranium: D(80),
  };

  it('связывает ресурс с производителями и потребителями', () => {
    const facts = buildResourceReference({ buildings: catalog(), baseCaps });
    const ore = facts.find((f) => f.id === 'ore');
    expect(ore).toBeDefined();
    expect(ore!.producedBy.map((l) => l.buildingId)).toEqual(['miner_mk1']);
    expect(ore!.consumedBy.map((l) => l.buildingId)).toEqual(['steel_smelter_mk1']);
    // Руда входит в стоимость плавильни — это третья, отдельная связь.
    expect(ore!.usedInCostOf.map((l) => l.buildingId)).toEqual(['steel_smelter_mk1']);
  });

  it('пассивный расход энергии учитывается как потребление', () => {
    const facts = buildResourceReference({ buildings: catalog(), baseCaps });
    const energy = facts.find((f) => f.id === 'energy')!;
    // Майнер объявляет расход только через energyConsumption; без его учёта энергия выглядела
    // бы почти никому не нужной.
    expect(energy.consumedBy.map((l) => l.buildingId)).toContain('miner_mk1');
    expect(energy.consumedBy.map((l) => l.buildingId)).toContain('steel_smelter_mk1');
  });

  it('ресурс без производителей всё равно попадает в справочник', () => {
    const facts = buildResourceReference({ buildings: catalog(), baseCaps });
    const uranium = facts.find((f) => f.id === 'enriched_uranium');
    expect(uranium).toBeDefined();
    expect(uranium!.producedBy).toHaveLength(0);
    // «Его негде взять» — это тоже ответ, и он полезнее отсутствующей строки.
    expect(uranium!.consumedBy.map((l) => l.buildingId)).toEqual(['nuclear_power_plant']);
  });

  it('списки отсортированы по убыванию ставки', () => {
    const facts = buildResourceReference({ buildings: catalog(), baseCaps });
    const energy = facts.find((f) => f.id === 'energy')!;
    for (let i = 1; i < energy.consumedBy.length; i++) {
      expect(energy.consumedBy[i - 1].amount.gte(energy.consumedBy[i].amount)).toBe(true);
    }
  });

  it('цена и торгуемость берутся из рыночных констант', () => {
    const facts = buildResourceReference({ buildings: catalog(), baseCaps });
    const steel = facts.find((f) => f.id === 'steel')!;
    expect(steel.tradeable).toBe(true);
    expect(steel.price?.eq(D(15))).toBe(true);

    const energy = facts.find((f) => f.id === 'energy')!;
    expect(energy.tradeable).toBe(false);
  });

  it('группировка не теряет записи', () => {
    const facts = buildResourceReference({ buildings: catalog(), baseCaps });
    const total = groupResources(facts).reduce((sum, entry) => sum + entry.items.length, 0);
    expect(total).toBe(facts.length);
  });
});
