import { useEffect, useMemo, useRef, useState } from 'react';
import { activeGridDistance } from '../../core/math/hexGeometry';
import type Decimal from 'break_eternity.js';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore, calculateCost } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format';
import type { Building, BuildPanelSort, DepositType, ResourceType, UiPrefsState } from '../../core/gameTypes';
import { RESOURCE_LABEL, RESOURCE_SHORT } from '../../core/constants/labels';
import { isBuildingUnlocked, getTechnologyForBuilding } from '../../core/constants/technologies';
import { getBuildingEmoji, getDepositEmoji } from '../../core/constants/buildingEmoji';
import { getBuildingsWithCoordinates } from '../../utils/proximityHelpers';
import {
  calculateProximityBonus,
  getAdjacentBuildings,
  getTotalProximityMultiplier,
} from '../../core/math/proximity';
import { GameIcon } from '../ui/icons';
import { Lock, Search } from 'lucide-react';
import { buildDurationSeconds } from '../../core/systems/construction';
import { BUILDING_DEPOSIT_REQUIREMENT, isDepositExhausted } from '../../core/systems/deposits';

/*
 * Строительство в стиле Industry Idle: один плоский список с поиском, а не колода
 * карточек. В каждой строке ровно то, что решает выбор:
 *
 *   [✓] Нефтяная вышка  +15%  (3)                Сталь 500 · Медь 200
 *       →|  Нефть ×4  ⚡ 12/с
 *       |→  Бензин ×2, Пластик ×2
 *
 * Модификатор клетки — не декоративный процент: это реальный множитель близости
 * (proximityRules) для ВЫБРАННОЙ клетки. Тот же множитель применяет тик, поэтому
 * «+15%» означает ровно +15% к производству именно здесь.
 */

/*
 * Какому зданию нужна какая жила — таблица одна на всю игру (core/systems/deposits.ts).
 * Здесь лежала её четвёртая копия; от неё зависит не только «можно ли поставить», но и
 * «разрушено ли здание», так что расхождение копий стало бы видимым багом.
 */
const DEPOSIT_BY_BUILDING = BUILDING_DEPOSIT_REQUIREMENT;

const DEPOSIT_LABEL: Record<DepositType, string> = {
  ore: 'Руда',
  ice: 'Лёд',
  carbon: 'Углерод',
  natural_gas: 'Природный газ',
  oil: 'Нефть',
  sand: 'Песок',
  uranium: 'Уран',
  chrome: 'Хром',
  titanium: 'Титан',
  copper: 'Медь',
};

/*
 * Фильтры панели живут в сейве СЛОТА (bigplan.md, пункт 30.2), а не в localStorage.
 * Ключ localStorage был один на браузер: настройки одной партии применялись ко всем
 * остальным, а на другом устройстве не применялись вовсе. Старый ключ подчищает
 * cleanupLegacyLocalStorage().
 */
type SortBy = BuildPanelSort;
type Filters = UiPrefsState['buildPanel'];

/** Ползунок как в референсе: подпись слева, переключатель справа. */
function Switch({
  checked,
  onChange,
  label,
  icon,
  title,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  icon?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      title={title}
      className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
    >
      {icon && <GameIcon icon={icon} size={14} className="text-warning" />}
      <span className="flex-1 text-3xs font-semibold uppercase tracking-wider text-content-muted">
        {label}
      </span>
      <span
        className="relative h-4 w-8 shrink-0 rounded-full transition-colors"
        style={{ background: checked ? 'var(--accent)' : 'var(--ink-700)' }}
      >
        <span
          className="absolute top-0.5 h-3 w-3 rounded-full transition-all"
          style={{ background: 'var(--ink-950)', left: checked ? '1.125rem' : '0.125rem' }}
        />
      </span>
    </button>
  );
}

export function BuildPanel() {
  const buildings = useGameStore((s) => s.buildings);
  const research = useGameStore((s) => s.research);
  const selectBuild = useGameStore((s) => s.selectBuild);
  const placeSelectedBuildAt = useGameStore((s) => s.placeSelectedBuildAt);
  const setHighlightedBuilding = useGameStore((s) => s.setHighlightedBuilding);
  const highlightedBuildingId = useGameStore((s) => s.grid.highlightedBuildingId);

  // Активная сетка: платформа, если игрок на ней, иначе главная база.
  const grid = useGameStore(
    useShallow((s) => {
      const platformId = s.galaxies.activePlatformId;
      const active =
        (platformId ? s.galaxies.platforms.find((p) => p.id === platformId)?.grid : null) ?? s.grid;
      return {
        tiles: active.tiles,
        deposits: active.deposits,
        // Остатки жил (bigplan.md, пункт 38): на выработанной шахту ставить нельзя.
        depositReserves: active.depositReserves,
        selected: active.selected,
        selectedBuildId: active.selectedBuildId,
        width: active.width,
        height: active.height,
      };
    }),
  );

  const resources = useGameStore((s) => {
    const platformId = s.galaxies.activePlatformId;
    if (platformId) {
      const platform = s.galaxies.platforms.find((p) => p.id === platformId);
      return platform?.resources ?? s.resources;
    }
    return s.resources;
  });

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const filters = useGameStore((s) => s.uiPrefs.buildPanel);
  const setUiPrefs = useGameStore((s) => s.setUiPrefs);
  // Никакого локального состояния и никакой записи в localStorage: значение и его
  // хранение — одно и то же место, поэтому разъехаться им негде.
  const patch = (next: Partial<Filters>) => setUiPrefs({ buildPanel: next });

  // Поиск дебаунсится: список перерисовывается вместе с тиком игры.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const selectedKey = grid.selected ? `${grid.selected.x},${grid.selected.y}` : null;
  const tileDeposit = selectedKey ? grid.deposits?.[selectedKey] ?? null : null;
  // Выработанная жила: месторождение на клетке ещё показывается, но добывать там нечего.
  const tileDepositExhausted = Boolean(
    selectedKey && tileDeposit && isDepositExhausted(grid.depositReserves, selectedKey),
  );
  const tileOccupied = selectedKey ? Boolean(grid.tiles[selectedKey]) : false;
  const isBaseTile =
    grid.selected !== null &&
    grid.selected.x === Math.floor(grid.width / 2) &&
    grid.selected.y === Math.floor(grid.height / 2);
  const canBuildHere = Boolean(grid.selected) && !tileOccupied && !isBaseTile;

  // Сколько зданий каждого типа уже стоит на карте.
  const placedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const id of Object.values(grid.tiles)) counts[id] = (counts[id] ?? 0) + 1;
    return counts;
  }, [grid.tiles]);

  /*
   * Модификаторы клетки. Соседей вокруг выбранной клетки достаточно найти ОДИН раз
   * на максимальный радиус правил, а не на каждое здание из каталога: иначе список
   * из ~150 зданий обходил бы всю сетку 150 раз при каждом клике по клетке.
   */
  const tileModifiers = useMemo(() => {
    const out: Record<string, number> = {};
    if (!grid.selected) return out;

    const placed = getBuildingsWithCoordinates(buildings, grid.tiles);
    const maxRadius = buildings.reduce((max, b) => {
      for (const rule of b.proximityRules ?? []) max = Math.max(max, rule.radius);
      return max;
    }, 0);
    if (maxRadius === 0) return out;

    const neighbors = getAdjacentBuildings(grid.selected.x, grid.selected.y, maxRadius, placed);

    for (const b of buildings) {
      if (!b.proximityRules?.length) continue;
      const inRange = neighbors.filter((n) => {
        if (!n.coord) return false;
        // Расстояние в шагах по геометрии текущей карты (bigplan.md, пункты 21, 31):
        // подсказка о бонусах должна совпадать с тем, что реально посчитает движок.
        const distance = activeGridDistance(n.coord.x, n.coord.y, grid.selected!.x, grid.selected!.y);
        return b.proximityRules!.some((rule) => distance <= rule.radius);
      });
      const multiplier = getTotalProximityMultiplier(
        calculateProximityBonus(b, inRange, b.proximityRules),
      );
      const percent = Math.round((multiplier - 1) * 100);
      if (percent !== 0) out[b.id] = percent;
    }
    return out;
  }, [buildings, grid.tiles, grid.selected]);

  const affordable = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const b of buildings) {
      const cost = calculateCost(b);
      map[b.id] = Object.entries(cost).every(([res, amount]) => {
        const r = resources[res as ResourceType];
        return Boolean(r) && r.amount.gte(amount);
      });
    }
    return map;
  }, [buildings, resources]);

  const rows = useMemo(() => {
    let list = buildings;

    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      const matchesResource = (dict?: Partial<Record<ResourceType, unknown>>) =>
        dict
          ? Object.keys(dict).some((res) => {
              const label = RESOURCE_LABEL[res as ResourceType]?.toLowerCase() ?? '';
              return label.includes(q) || res.toLowerCase().includes(q);
            })
          : false;

      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.description?.toLowerCase().includes(q) ||
          matchesResource(b.production) ||
          matchesResource(b.consumption) ||
          matchesResource(b.baseCost),
      );
    }

    if (filters.onlyUnlocked) {
      list = list.filter((b) => isBuildingUnlocked(b.id, research.technologies));
    }
    if (filters.onlyAffordable) {
      list = list.filter((b) => affordable[b.id]);
    }
    if (filters.onlyPositive) {
      list = list.filter((b) => (tileModifiers[b.id] ?? 0) > 0);
    }

    const sorted = [...list].sort((a, b) => {
      if (filters.sortBy === 'placed') return (placedCounts[b.id] ?? 0) - (placedCounts[a.id] ?? 0);
      if (filters.sortBy === 'cost') {
        const costOf = (x: Building) =>
          Object.values(calculateCost(x)).reduce((sum, amount) => sum + amount.toNumber(), 0);
        return costOf(a) - costOf(b);
      }
      return a.name.localeCompare(b.name);
    });

    // Клетка с месторождением: подходящий добытчик всегда первым — это единственное,
    // что здесь вообще можно построить, искать его в общем списке бессмысленно.
    if (tileDeposit) {
      sorted.sort((a, b) => {
        const aMatch = DEPOSIT_BY_BUILDING[a.id] === tileDeposit ? 0 : 1;
        const bMatch = DEPOSIT_BY_BUILDING[b.id] === tileDeposit ? 0 : 1;
        return aMatch - bMatch;
      });
    }

    return sorted;
  }, [
    buildings,
    debouncedQuery,
    filters,
    affordable,
    tileModifiers,
    placedCounts,
    research.technologies,
    tileDeposit,
  ]);

  const handlePick = (b: Building, unlocked: boolean) => {
    if (!unlocked) return;

    const requiredDeposit = DEPOSIT_BY_BUILDING[b.id];
    const fitsTile = canBuildHere && (!requiredDeposit || requiredDeposit === tileDeposit);

    // Клик по уже выбранному зданию снимает режим строительства.
    if (grid.selectedBuildId === b.id && !fitsTile) {
      selectBuild(null);
      setHighlightedBuilding(null);
      return;
    }

    selectBuild(b.id);
    setHighlightedBuilding(b.id);

    // Клетка уже выбрана и подходит — ставим сразу, без второго клика по карте.
    if (fitsTile && affordable[b.id] && grid.selected) {
      placeSelectedBuildAt(grid.selected);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* ——— контекст: куда именно мы строим ——— */}
      <div
        className="shrink-0 border-b px-3 py-2"
        style={{ borderColor: 'var(--edge)', background: 'var(--surface-2)' }}
      >
        {grid.selected ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-content-faint">Клетка</span>
            <span className="font-mono font-semibold text-content-primary">
              ({grid.selected.x}, {grid.selected.y})
            </span>
            {tileDeposit ? (
              <span className={tileDepositExhausted ? 'badge badge-warning' : 'badge badge-accent'}>
                <GameIcon
                  icon={tileDepositExhausted ? 'broken_image' : getDepositEmoji(tileDeposit)}
                  size={12}
                />
                {DEPOSIT_LABEL[tileDeposit]}
                {tileDepositExhausted ? ' · выработано' : ''}
              </span>
            ) : null}
            {tileOccupied && <span className="badge badge-warning">клетка занята</span>}
            {isBaseTile && <span className="badge badge-info">база</span>}
          </div>
        ) : (
          <div className="text-xs text-content-faint">
            Выберите здание — затем клетку на карте. Или сначала клетку, чтобы видеть её модификаторы.
          </div>
        )}
      </div>

      {/* ——— поиск ——— */}
      <div className="shrink-0 px-3 pt-2">
        <div className="relative">
          <Search
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-content-faint"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Введите название здания или ресурса"
            className="w-full rounded-md py-1.5 pl-8 pr-3 text-xs"
          />
        </div>
      </div>

      {/* ——— переключатели ——— */}
      <div className="shrink-0 border-b" style={{ borderColor: 'var(--edge)' }}>
        <Switch
          checked={filters.onlyPositive}
          onChange={(v) => patch({ onlyPositive: v })}
          icon="bulb"
          label="только положительные модификаторы клетки"
          title="Оставить в списке только здания, которые на выбранной клетке получают бонус от соседей"
        />
        <div className="flex items-center gap-3 px-3 pb-2 text-3xs">
          <label className="flex cursor-pointer items-center gap-1.5 text-content-muted">
            <input
              type="checkbox"
              checked={filters.onlyUnlocked}
              onChange={(e) => patch({ onlyUnlocked: e.target.checked })}
              className="h-3 w-3 accent-[var(--accent)]"
            />
            открытые
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-content-muted">
            <input
              type="checkbox"
              checked={filters.onlyAffordable}
              onChange={(e) => patch({ onlyAffordable: e.target.checked })}
              className="h-3 w-3 accent-[var(--accent)]"
            />
            по карману
          </label>
          <select
            value={filters.sortBy}
            onChange={(e) => patch({ sortBy: e.target.value as SortBy })}
            className="ml-auto rounded py-0.5 pl-1.5 pr-5 text-3xs"
            title="Порядок списка"
          >
            <option value="name">по названию</option>
            <option value="cost">по стоимости</option>
            <option value="placed">по количеству</option>
          </select>
        </div>
      </div>

      {/* ——— список ——— */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.map((b) => {
          const unlocked = isBuildingUnlocked(b.id, research.technologies);
          const requiredTech = unlocked ? null : getTechnologyForBuilding(b.id);
          const armed = grid.selectedBuildId === b.id;
          const highlighted = highlightedBuildingId === b.id;
          const modifier = tileModifiers[b.id] ?? 0;
          const placed = placedCounts[b.id] ?? 0;
          const cost = calculateCost(b);
          const canPay = affordable[b.id];
          const requiredDeposit = DEPOSIT_BY_BUILDING[b.id];
          // Выработанная жила — такой же отказ, как её отсутствие: строить шахту негде.
          const depositMismatch =
            Boolean(requiredDeposit) && (tileDeposit !== requiredDeposit || tileDepositExhausted);

          const inputs = Object.entries(b.consumption ?? {});
          const outputs = Object.entries(b.production ?? {});

          return (
            <div
              key={b.id}
              onMouseEnter={() => unlocked && setHighlightedBuilding(b.id)}
              onMouseLeave={() => grid.selectedBuildId !== b.id && setHighlightedBuilding(null)}
              className="border-b transition-colors"
              style={{
                borderColor: 'var(--edge-subtle)',
                background: armed
                  ? 'rgb(62 224 127 / 0.12)'
                  : highlighted
                    ? 'rgb(94 216 242 / 0.07)'
                    : 'transparent',
                opacity: unlocked ? 1 : 0.45,
              }}
            >
              <button
                type="button"
                onClick={() => handlePick(b, unlocked)}
                disabled={!unlocked}
                title={buildTooltip(b, cost, modifier, requiredDeposit)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left disabled:cursor-not-allowed"
              >
                {/* флажок = «этим строим сейчас» */}
                <span
                  className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border"
                  style={{
                    borderColor: armed ? 'var(--accent)' : 'var(--edge-strong)',
                    background: armed ? 'var(--accent)' : 'transparent',
                  }}
                >
                  {armed && (
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="var(--ink-950)">
                      <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  )}
                </span>

                <GameIcon
                  icon={getBuildingEmoji(b.id)}
                  size={15}
                  className={`mt-px shrink-0 ${armed ? 'text-accent' : 'text-content-muted'}`}
                />

                <div className="min-w-0 flex-1">
                  {/* название + модификатор клетки + сколько уже стоит */}
                  <div className="flex items-baseline gap-1.5">
                    {/* Не по карману — гасим название, а не строку целиком: строку ещё
                        можно нажать, чтобы запомнить выбор и построить, когда накопится. */}
                    <span
                      className={`truncate text-xs font-semibold ${
                        canPay ? 'text-content-primary' : 'text-content-muted'
                      }`}
                    >
                      {b.name}
                    </span>
                    {grid.selected && (
                      <span
                        className={`font-mono text-3xs font-bold ${
                          modifier > 0
                            ? 'text-accent'
                            : modifier < 0
                              ? 'text-danger'
                              : 'text-content-faint'
                        }`}
                        title="Модификатор этой клетки: бонус или штраф от соседних зданий"
                      >
                        {modifier > 0 ? '+' : ''}
                        {modifier}%
                      </span>
                    )}
                    <span className="font-mono text-3xs text-content-faint">({placed})</span>
                  </div>

                  {/* вход / выход */}
                  {inputs.length > 0 || b.energyConsumption ? (
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-3xs text-content-muted">
                      <GameIcon icon="import" size={11} className="text-warning" />
                      {inputs.map(([res, amount]) => (
                        <span key={res} className="whitespace-nowrap">
                          <GameIcon icon={RESOURCE_SHORT[res as ResourceType]} size={11} />{' '}
                          {RESOURCE_LABEL[res as ResourceType]} ×{formatNumber(amount)}
                        </span>
                      ))}
                      {b.energyConsumption && b.energyConsumption.gt(0) && (
                        <span className="whitespace-nowrap text-content-faint">
                          <GameIcon icon="bolt" size={11} /> {formatNumber(b.energyConsumption)}/с
                        </span>
                      )}
                    </div>
                  ) : null}

                  {outputs.length > 0 ? (
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-3xs text-info">
                      <GameIcon icon="export" size={11} className="text-accent" />
                      {outputs.map(([res, amount]) => (
                        <span key={res} className="whitespace-nowrap">
                          <GameIcon icon={RESOURCE_SHORT[res as ResourceType]} size={11} />{' '}
                          {RESOURCE_LABEL[res as ResourceType]} ×{formatNumber(amount)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    inputs.length === 0 && (
                      <div className="mt-0.5 line-clamp-1 text-3xs text-content-faint">
                        {b.description}
                      </div>
                    )
                  )}

                  {/* почему нельзя поставить именно здесь */}
                  {requiredDeposit && (
                    <div
                      className={`mt-0.5 text-3xs ${
                        depositMismatch ? 'text-content-faint' : 'text-accent'
                      }`}
                    >
                      <GameIcon icon={getDepositEmoji(requiredDeposit)} size={11} /> нужно
                      месторождение: {DEPOSIT_LABEL[requiredDeposit]}
                    </div>
                  )}
                  {!unlocked && requiredTech && (
                    <div className="mt-0.5 text-3xs text-danger">
                      нужна технология: {requiredTech.name} ({formatNumber(requiredTech.cost)} RP)
                    </div>
                  )}
                </div>

                {/* цена: то, что реально списывается при постройке */}
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  {!unlocked ? (
                    <Lock size={13} className="text-content-faint" />
                  ) : (
                    Object.entries(cost).map(([res, amount]) => {
                      const r = resources[res as ResourceType];
                      const enough = Boolean(r) && r.amount.gte(amount);
                      return (
                        <span
                          key={res}
                          className={`whitespace-nowrap font-mono text-3xs tabular-nums ${
                            enough ? 'text-info' : 'text-danger'
                          }`}
                          title={`${RESOURCE_LABEL[res as ResourceType]}: ${formatNumber(amount)}${
                            enough ? '' : ' — не хватает'
                          }`}
                        >
                          {formatNumber(amount)}{' '}
                          <GameIcon icon={RESOURCE_SHORT[res as ResourceType]} size={11} />
                        </span>
                      );
                    })
                  )}
                  {unlocked && Object.keys(cost).length === 0 && (
                    <span className="font-mono text-3xs text-accent">бесплатно</span>
                  )}
                  {/*
                    Время постройки (bigplan.md, пункт 18): игрок должен видеть его ДО клика.
                    Считается с учётом кривой обучения, поэтому у уже привычного здания
                    показанное время меньше.
                  */}
                  {unlocked && (
                    <span
                      className="whitespace-nowrap font-mono text-3xs tabular-nums text-content-faint"
                      title="Время постройки. Уменьшается по мере того, как вы строите такие здания."
                    >
                      ~{buildDurationSeconds(b, placed)}с
                    </span>
                  )}
                </div>
              </button>
            </div>
          );
        })}

        {rows.length === 0 && (
          <div className="empty-state m-3">
            Ничего не найдено. Снимите фильтры или измените запрос.
          </div>
        )}
      </div>

      {/* ——— подвал: что происходит по клику ——— */}
      <div
        className="shrink-0 border-t px-3 py-1.5 text-3xs text-content-faint"
        style={{ borderColor: 'var(--edge)', background: 'var(--surface-2)' }}
      >
        {grid.selectedBuildId ? (
          <span className="text-accent">
            Режим строительства: {buildings.find((b) => b.id === grid.selectedBuildId)?.name}. Клик
            по клетке — поставить, клик по строке — отменить.
          </span>
        ) : (
          <span>
            Показано {rows.length} из {buildings.length}. Наведение подсвечивает такие здания на
            карте.{' '}
            {/* Массовое выделение (пункты 10, 28) иначе никак не обнаружить: жестам неоткуда
                взяться в интерфейсе, а Alt+drag не угадывается. */}
            <span className="text-content-muted">
              Alt+рамка — выделить здания, Shift+клик — добавить, Esc — снять.
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

function buildTooltip(
  b: Building,
  cost: Partial<Record<ResourceType, Decimal>>,
  modifier: number,
  requiredDeposit?: DepositType,
): string {
  const line = (label: string, dict?: Partial<Record<ResourceType, Decimal>>, suffix = '') => {
    if (!dict || Object.keys(dict).length === 0) return null;
    const parts = Object.entries(dict).map(
      ([res, amount]) => `${formatNumber(amount)} ${RESOURCE_LABEL[res as ResourceType]}${suffix}`,
    );
    return `${label}: ${parts.join(', ')}`;
  };

  return [
    b.name,
    b.description,
    line('Стоимость', cost),
    line('Производит', b.production, '/с'),
    line('Потребляет', b.consumption, '/с'),
    b.energyConsumption?.gt(0) ? `Энергия: ${formatNumber(b.energyConsumption)}/с` : null,
    requiredDeposit ? `Требует месторождение: ${DEPOSIT_LABEL[requiredDeposit]}` : null,
    modifier !== 0 ? `Модификатор клетки: ${modifier > 0 ? '+' : ''}${modifier}%` : null,
    ...(b.proximityRules ?? []).map((rule) => `• ${rule.description}`),
  ]
    .filter(Boolean)
    .join('\n');
}
