import { useEffect, useMemo, useState } from 'react';
import {
  useGameStore,
  calculateCost,
  getBasePos,
  BASE_RESOURCE_MAX,
  expandWarehouseProductionMultipliers,
} from '../../features/gameStore';
import { D, formatNumber } from '../../core/math/format.ts';
import type Decimal from 'break_eternity.js';
import type { ResourceType, TradeResourceType } from '../../core/gameTypes';
import { RESOURCE_LABEL } from '../../core/constants/labels';
import { getBuildingIcon } from '../../core/constants/buildingIcons';
import { ArrowUp, ArrowDown, Sparkles, Zap, Power, PowerOff, Settings } from 'lucide-react';
import { BuildingSettingsPanel } from './building/BuildingSettingsPanel';
import {
  computeBandwidth,
  computeCapsMultiplier,
  computeCombatMultiplier,
  computeSpeedMultiplier,
  computeTradeMultiplier,
} from '../../core/constants/progression';
import { BUILDING_EVOLUTIONS, getNextEvolution, getCurrentEvolution, getEvolutionMultiplier } from '../../core/constants/buildingEvolutions';
import { isBuildingPowered } from '../../utils/powerGridHelpers';
import { getBuildingsWithCoordinates } from '../../utils/proximityHelpers';
import { isBuildingDisableable } from '../../core/constants/buildingCategories';
import { GameIcon, IconText } from '../ui/icons';
import { jobProgress, jobRemainingMs, type TileJob } from '../../core/systems/construction';
import {
  RUIN_REFUND_MAX,
  RUIN_REFUND_MIN,
  depositLeft,
  depositRatio,
  depositTotal,
  isDepositExhausted,
  isTileRuined,
  requiredDepositForBuilding,
} from '../../core/systems/deposits';

/** «12с» / «1м 05с» — остаток работы человеческим текстом. */
function formatJobRemaining(job: TileJob, now: number): string {
  const ms = jobRemainingMs(job, now);
  const totalSeconds = Math.ceil(ms / 1000);
  if (totalSeconds <= 0) return 'готово';
  if (totalSeconds < 60) return `${totalSeconds}с`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}м ${String(seconds).padStart(2, '0')}с`;
}

export function TileInspector() {
  // Подписываемся на конкретные поля grid для правильного реактивного обновления
  // Use platform grid if active, otherwise main grid
  // ВАЖНО: Получаем activePlatform внутри selector для правильной реактивности
  const selected = useGameStore((s) => {
    const platformId = s.galaxies.activePlatformId;
    if (platformId) {
      const platform = s.galaxies.platforms.find(p => p.id === platformId);
      if (platform) return platform.grid.selected;
    }
    return s.grid.selected;
  });
  const tiles = useGameStore((s) => {
    const platformId = s.galaxies.activePlatformId;
    if (platformId) {
      const platform = s.galaxies.platforms.find(p => p.id === platformId);
      if (platform) return platform.grid.tiles;
    }
    return s.grid.tiles;
  });
  const deposits = useGameStore((s) => {
    const platformId = s.galaxies.activePlatformId;
    if (platformId) {
      const platform = s.galaxies.platforms.find(p => p.id === platformId);
      if (platform) return platform.grid.deposits;
    }
    return s.grid.deposits;
  });
  // Остатки жил (bigplan.md, пункт 38). У платформ своих запасов нет: там добыча автономная.
  const depositReserves = useGameStore((s) => {
    const platformId = s.galaxies.activePlatformId;
    if (platformId) {
      const platform = s.galaxies.platforms.find(p => p.id === platformId);
      if (platform) return platform.grid.depositReserves;
    }
    return s.grid.depositReserves;
  });
  const buffers = useGameStore((s) => {
    const platformId = s.galaxies.activePlatformId;
    if (platformId) {
      const platform = s.galaxies.platforms.find(p => p.id === platformId);
      if (platform) return platform.grid.buffers;
    }
    return s.grid.buffers;
  });
  const tileLevels = useGameStore((s) => {
    const platformId = s.galaxies.activePlatformId;
    if (platformId) {
      const platform = s.galaxies.platforms.find(p => p.id === platformId);
      if (platform) return (platform.grid as any).tileLevels || {};
    }
    return s.grid.tileLevels;
  });
  const tileEvolutionLevels = useGameStore((s) => {
    const platformId = s.galaxies.activePlatformId;
    if (platformId) {
      const platform = s.galaxies.platforms.find(p => p.id === platformId);
      if (platform) return (platform.grid as any).tileEvolutionLevels || {};
    }
    return s.grid.tileEvolutionLevels;
  });
  const tileDisabled = useGameStore((s) => {
    const platformId = s.galaxies.activePlatformId;
    if (platformId) {
      const platform = s.galaxies.platforms.find(p => p.id === platformId);
      if (platform) return (platform.grid as any).tileDisabled || {};
    }
    return s.grid.tileDisabled;
  });
  // Незавершённые стройки/улучшения активной сетки (на платформе — своя очередь).
  const tileJobs = useGameStore((s) => {
    const platformId = s.galaxies.activePlatformId;
    if (platformId) {
      const platform = s.galaxies.platforms.find(p => p.id === platformId);
      if (platform) return platform.grid.tileJobs;
    }
    return s.grid.tileJobs;
  });
  const marketPolicy = useGameStore((s) => {
    const platformId = s.galaxies.activePlatformId;
    if (platformId) {
      const platform = s.galaxies.platforms.find(p => p.id === platformId);
      if (platform) return (platform.grid as any).marketPolicy || {};
    }
    return s.grid.marketPolicy;
  });
  const selectedBuildId = useGameStore((s) => {
    const platformId = s.galaxies.activePlatformId;
    if (platformId) {
      const platform = s.galaxies.platforms.find(p => p.id === platformId);
      if (platform) return platform.grid.selectedBuildId;
    }
    return s.grid.selectedBuildId;
  });
  const gridWidth = useGameStore((s) => {
    const platformId = s.galaxies.activePlatformId;
    if (platformId) {
      const platform = s.galaxies.platforms.find(p => p.id === platformId);
      if (platform) return platform.grid.width;
    }
    return s.grid.width;
  });
  const gridHeight = useGameStore((s) => {
    const platformId = s.galaxies.activePlatformId;
    if (platformId) {
      const platform = s.galaxies.platforms.find(p => p.id === platformId);
      if (platform) return platform.grid.height;
    }
    return s.grid.height;
  });
  
  // Собираем grid обратно для совместимости с остальным кодом
  const grid = useMemo(() => ({
    selected,
    tiles,
    deposits,
    depositReserves,
    buffers,
    tileLevels,
    tileEvolutionLevels,
    tileDisabled,
    tileJobs,
    marketPolicy,
    selectedBuildId,
    width: gridWidth,
    height: gridHeight,
  }), [selected, tiles, deposits, depositReserves, buffers, tileLevels, tileEvolutionLevels, tileDisabled, tileJobs, marketPolicy, selectedBuildId, gridWidth, gridHeight]);
  
  const buildings = useGameStore((s) => s.buildings);
  // Get resources from active platform or main base
  const resources = useGameStore((s) => {
    const platformId = s.galaxies.activePlatformId;
    if (platformId) {
      const platform = s.galaxies.platforms.find(p => p.id === platformId);
      return platform?.resources || s.resources;
    }
    return s.resources;
  });
  const combat = useGameStore((s) => s.combat);
  const researchLevels = useGameStore((s) => s.research.levels);
  const meta = useGameStore((s) => s.meta);
  const demons = useGameStore((s) => s.demons);
  const ascension = useGameStore((s) => s.ascension);
  const currency = useGameStore((s) => s.currency);
  // Quantum Points live in prestige.availableQuantumPoints (a number). `s.quantumPoints`
  // does not exist on GameState, so this was always undefined and the .gte() call below
  // threw whenever an evolution had a quantum_points cost.
  const quantumPoints = useGameStore((s) => s.prestige.availableQuantumPoints);
  const selectBuild = useGameStore((s) => s.selectBuild);
  const placeSelectedBuildAt = useGameStore((s) => s.placeSelectedBuildAt);
  const removeBuildingAt = useGameStore((s) => s.removeBuildingAt);
  const setTileMarketPolicy = useGameStore((s) => s.setTileMarketPolicy);
  const upgradeBuildingAt = useGameStore((s) => s.upgradeBuildingAt);
  const downgradeBuildingAt = useGameStore((s) => s.downgradeBuildingAt);
  const evolveBuildingAt = useGameStore((s) => s.evolveBuildingAt);
  const toggleBuildingDisabled = useGameStore((s) => s.toggleBuildingDisabled);
  const cancelTileJob = useGameStore((s) => s.cancelTileJob);

  // State for building settings modal
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  const selectedKey = grid.selected ? `${grid.selected.x},${grid.selected.y}` : null;
  const buildingId = selectedKey ? grid.tiles[selectedKey] : null;
  const buildingLevel = selectedKey ? (grid.tileLevels?.[selectedKey] || 1) : 1;
  const evolutionLevel = selectedKey ? (grid.tileEvolutionLevels?.[selectedKey] || 0) : 0;
  const isDisabled = selectedKey ? (grid.tileDisabled?.[selectedKey] || false) : false;

  /*
   * Незавершённая стройка/улучшение на этой клетке (bigplan.md, пункты 18–19).
   * Пока работа идёт, здание не производит, а кнопки улучшения бессмысленны.
   */
  const activeJob = selectedKey ? grid.tileJobs?.[selectedKey] : undefined;

  /*
   * Часы для прогресс-бара. Тикают ТОЛЬКО когда на выбранной клетке идёт работа: панель и без
   * того перерисовывается на каждый тик игры, но полагаться на это нельзя — стройка идёт
   * секунды, и полоса должна двигаться, даже если в стейте больше ничего не меняется.
   */
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (!activeJob) return;
    const id = setInterval(() => setNowTick(Date.now()), 250);
    return () => clearInterval(id);
  }, [activeJob]);

  const tileMarketPolicy = selectedKey ? (grid.marketPolicy?.[selectedKey] ?? {}) : {};

  const deposit = selectedKey ? grid.deposits?.[selectedKey] : null;

  /*
   * Остаток жилы под клеткой (bigplan.md, пункт 38).
   *
   * Показывается и под зданием, и на пустой клетке: до постройки шахты игрок должен видеть,
   * надолго ли её хватит, а после — сколько осталось. Клетка без записи о запасе (старый
   * сейв) показывается как полная, а не как выработанная — см. depositRatio.
   */
  const depositInfo = useMemo(() => {
    if (!selectedKey || !deposit) return null;
    const total = depositTotal(grid.depositReserves, selectedKey);
    /*
     * Записи о запасе может не быть вовсе — так устроены космические платформы: добыча там
     * автономная и жилы не истощаются. Показывать «Запас: 0» в этом случае значило бы врать,
     * поэтому блока просто нет.
     */
    if (total <= 0) return null;
    return {
      left: depositLeft(grid.depositReserves, selectedKey),
      total,
      ratio: depositRatio(grid.depositReserves, selectedKey),
      exhausted: isDepositExhausted(grid.depositReserves, selectedKey),
    };
  }, [selectedKey, deposit, grid.depositReserves]);

  /** Здание стоит на выработанной жиле: работать оно не может, остаётся только снести. */
  const isRuined = Boolean(
    selectedKey &&
      buildingId &&
      isTileRuined(requiredDepositForBuilding(buildingId), grid.depositReserves, selectedKey),
  );

  const basePos = useMemo(() => getBasePos(grid), [grid.width, grid.height]);
  const isBaseSelected = Boolean(grid.selected && grid.selected.x === basePos.x && grid.selected.y === basePos.y);

  const defenseUi = useMemo(() => {
    const turretNeed = combat.defenseEnergyNeedPerSecond;
    const turretUsed = combat.defenseEnergyUsedPerSecond;
    const turretPct = Math.max(0, Math.min(1, Number(combat.defenseFireRatio.toString())));

    const shieldNeed = combat.shieldEnergyNeedPerSecond;
    const shieldUsed = combat.shieldEnergyUsedPerSecond;
    const shieldHp = combat.shieldHp;
    const shieldMax = combat.shieldMaxHp;
    const shieldRegen = combat.shieldRegenPerSecond;
    const shieldAbsorb = combat.shieldAbsorbedPerSecond;

    const pressure = combat.enemyPressurePerSecond;
    const pressurePotential = combat.enemyPressurePotentialPerSecond;
    const baseDmg = combat.baseDamageTakenPerSecond;

    return {
      turretNeed,
      turretUsed,
      turretPct,
      shieldNeed,
      shieldUsed,
      shieldHp,
      shieldMax,
      shieldRegen,
      shieldAbsorb,
      pressure,
      pressurePotential,
      baseDmg,
    };
  }, [
    combat.baseDamageTakenPerSecond,
    combat.defenseEnergyNeedPerSecond,
    combat.defenseEnergyUsedPerSecond,
    combat.defenseFireRatio,
    combat.enemyPressurePerSecond,
    combat.enemyPressurePotentialPerSecond,
    combat.shieldAbsorbedPerSecond,
    combat.shieldEnergyNeedPerSecond,
    combat.shieldEnergyUsedPerSecond,
    combat.shieldHp,
    combat.shieldMaxHp,
    combat.shieldRegenPerSecond,
  ]);

  const progressionUi = useMemo(() => {
    const overclockerPaid = Boolean(demons.active.overclocker && demons.rentPaid?.overclocker);
    const speedMult = computeSpeedMultiplier(researchLevels, meta.qubits, overclockerPaid);
    const bandwidth = computeBandwidth(researchLevels);
    const capsMult = computeCapsMultiplier(researchLevels, meta.qubits);
    const tradeMult = computeTradeMultiplier(researchLevels);
    const combatMult = computeCombatMultiplier(researchLevels, meta.qubits);
    return { overclockerPaid, speedMult, bandwidth, capsMult, tradeMult, combatMult };
  }, [demons.active.overclocker, demons.rentPaid, meta.qubits, researchLevels]);

  const tileBuffer = useMemo(() => {
    if (!selectedKey) return null;
    return grid.buffers[selectedKey] ?? {};
  }, [grid.buffers, selectedKey]);

  const building = useMemo(() => {
    if (!buildingId) return null;
    return buildings.find((b) => b.id === buildingId) ?? null;
  }, [buildingId, buildings]);

  // Проверяем состояние энергопокрытия
  const powerStatus = useMemo(() => {
    if (!building || !grid.selected) return null;
    
    // Если это источник энергии, не проверяем покрытие
    const isPowerSource = building.powerGridRadius && building.powerGridRadius > 0;
    if (isPowerSource) {
      return { isPowerSource: true, isPowered: true, radius: building.powerGridRadius };
    }
    
    // Проверяем покрытие для потребителей
    const allBuildingsWithCoords = getBuildingsWithCoordinates(buildings, grid.tiles);
    const isPowered = isBuildingPowered(grid.selected, allBuildingsWithCoords);
    
    return { isPowerSource: false, isPowered, radius: 0 };
  }, [building, buildings, grid.selected, grid.tiles]);

  const ioInfo = useMemo(() => {
    if (!grid.selected || !selectedKey || !building) return null;

    const tileBuf = grid.buffers[selectedKey] ?? {};
    const baseBuf = grid.buffers.base ?? {};

    const inputs = Object.entries(building.consumption ?? {}).map(([res, perSecond]) => {
      const r = res as ResourceType;
      const needPerSec = D(perSecond);
      const rawHave = r === 'energy' ? baseBuf[r] : tileBuf[r];
      const have = rawHave ? D(rawHave) : D(0);
      // С автоматической доставкой ресурсы всегда доступны - не показываем "нет ресурса"
      const missing = false;
      return { r, needPerSec, have, missing, source: r === 'energy' ? 'база' : 'буфер' };
    });

    const outputs = Object.entries(building.production ?? {}).map(([res, perSecond]) => {
      const r = res as ResourceType;
      const prodPerSec = D(perSecond);
      // Все ресурсы идут через локальный буфер на базу
      return { r, prodPerSec, target: 'база' };
    });

    const hasInputs = inputs.some((i) => i.needPerSec.gt(0));
    const hasOutputs = outputs.some((o) => o.prodPerSec.gt(0));
    const isBlocked = inputs.some((i) => i.missing);

    const missingList = inputs
      .filter((i) => i.missing)
      .map((i) => i.r);

    return { inputs, outputs, hasInputs, hasOutputs, isBlocked, missingList };
  }, [building, grid.buffers, grid.selected, selectedKey]);

  const selectedBuild = useMemo(() => {
    if (!grid.selectedBuildId) return null;
    return buildings.find((b) => b.id === grid.selectedBuildId) ?? null;
  }, [buildings, grid.selectedBuildId]);

  const SelectedBuildIcon = selectedBuild ? getBuildingIcon(selectedBuild.id) : null;
  const PlacedBuildIcon = building ? getBuildingIcon(building.id) : null;

  const selectedBuildCost = useMemo(() => {
    if (!selectedBuild) return null;
    return calculateCost(selectedBuild);
  }, [selectedBuild]);

  const affordability = useMemo(() => {
    if (!selectedBuildCost) return { canAfford: false, missing: [] as Array<{ res: ResourceType; amount: string }> };
    const missing: Array<{ res: ResourceType; amount: string }> = [];

    for (const [res, amt] of Object.entries(selectedBuildCost)) {
      const r = res as ResourceType;
      const have = resources[r]?.amount;
      if (!have) continue;
      if (have.lt(amt)) {
        missing.push({ res: r, amount: formatNumber(amt.sub(have)) });
      }
    }

    return { canAfford: missing.length === 0, missing };
  }, [resources, selectedBuildCost]);

  /*
   * Заголовок «ИНСПЕКТОР — Клетка (x, y)» рисует шапка правой панели (SidePanel),
   * поэтому здесь его больше нет: раньше он дублировался и съедал первый экран.
   */
  return (
    <div className="p-3">
      <div className="cyber-panel">
        {/* Строка про режим строительства нужна только когда он включён — «выкл» первой
            строкой инспектора ничего не сообщало, но занимало место. */}
        {selectedBuild ? (
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-xs text-cyber-text-dim">
              Режим строительства:{' '}
              <span className="text-cyber-text inline-flex items-center gap-2">
                {SelectedBuildIcon ? <SelectedBuildIcon size={14} className="text-cyber-text" /> : null}
                <span>{selectedBuild.name}</span>
              </span>
            </div>
            <button className="cyber-button text-xs py-2 px-3" onClick={() => selectBuild(null)}>
              ОТМЕНА
            </button>
          </div>
        ) : null}

        {!grid.selected ? (
          <div className="text-sm text-cyber-text-dim">Выберите клетку на карте.</div>
        ) : isBaseSelected ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="text-2xl"><GameIcon icon="🏠" /></div>
              <div>
                <div className="text-sm font-bold text-cyber-text">Центральная База</div>
                <div className="text-[10px] text-cyber-gray-light">Координаты: {basePos.x}, {basePos.y}</div>
              </div>
            </div>

            <div className="bg-cyber-dark/60 p-2 rounded border border-cyber-blue/30">
              <div className="text-xs text-cyber-text-dim mb-1"><GameIcon icon="ℹ️" /> Что это такое?</div>
              <div className="text-[10px] text-cyber-gray-light leading-relaxed">
                <strong className="text-cyber-text">База</strong> — центральное хранилище всех ресурсов.<br/>
                • Все произведённые ресурсы стекаются сюда<br/>
                • Отсюда берутся ресурсы для строительства и торговли<br/>
                • Энергия распределяется централизованно из базы<br/>
                • <span className="text-cyber-blue">Складские модули</span> увеличивают вместимость базы
              </div>
            </div>

            {(() => {
              // Подсчитываем складские модули и их вклад
              const warehouseBuildings = buildings.filter(b => 
                b.productionMultipliers && Object.keys(b.productionMultipliers).length > 0
              );
              const totalWarehouseCount = warehouseBuildings.reduce((sum, b) => sum + b.count, 0);
              
              if (totalWarehouseCount > 0) {
                return (
                  <div className="bg-cyber-dark/40 p-2 rounded border border-green-500/30 mt-2">
                    <div className="text-xs text-green-400 mb-1.5 flex items-center gap-1">
                      <GameIcon icon="📦" /> Складские модули ({totalWarehouseCount})
                    </div>
                    <div className="space-y-1">
                      {warehouseBuildings.filter(b => b.count > 0).map(b => (
                        <div key={b.id} className="text-[10px] text-cyber-gray-light flex items-center justify-between">
                          <span>{b.name}</span>
                          <span className="text-cyber-text font-mono">×{b.count}</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-[9px] text-green-300/70 mt-1.5 pt-1.5 border-t border-green-500/20">
                      <GameIcon icon="💡" /> Каждый склад увеличивает вместимость базы за каждый уровень
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <div className="pt-2 border-t border-cyber-gray/50">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-cyber-text-dim"><GameIcon icon="📦" /> Содержимое склада</div>
                <div className="text-[10px] text-cyber-gray-light">
                  {(Object.keys(resources) as ResourceType[]).filter(r => {
                    const raw = grid.buffers.base?.[r];
                    const amt = raw ? D(raw) : D(0);
                    return amt.gt(0);
                  }).length} ресурсов
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {(Object.keys(resources) as ResourceType[])
                  .filter((r) => resources[r].max.gt(0)) // Показываем только ресурсы с ненулевой вместимостью
                  .map((r) => {
                    const raw = grid.buffers.base?.[r];
                    const amt = raw ? D(raw) : D(0);
                    const max = resources[r].max;
                    const full = max.gt(0) && amt.gte(max);
                    const fillPercent = max.gt(0) ? amt.div(max).mul(100).toNumber() : 0;
                    
                    // Пропускаем ресурсы с нулевым количеством для компактности
                    if (amt.lte(0)) return null;
                    
                    return (
                      <div key={r} className="bg-cyber-dark/40 p-1.5 rounded border border-cyber-gray/20 hover:border-cyber-blue/30 transition-colors">
                        <div className="flex items-center justify-between text-[10px] mb-0.5">
                          <span className="text-cyber-text-dim">{RESOURCE_LABEL[r]}</span>
                          <span className={`font-mono ${full ? 'text-cyber-red font-bold' : fillPercent > 80 ? 'text-orange-400' : 'text-cyber-text'}`}>
                            {formatNumber(amt)} / {formatNumber(max)}
                            {full && <span className="ml-1"><GameIcon icon="⚠️" /></span>}
                          </span>
                        </div>
                        <div className="h-1.5 bg-cyber-gray/20 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${full ? 'bg-cyber-red' : fillPercent > 80 ? 'bg-orange-400' : 'bg-cyber-blue'}`}
                            style={{ width: `${Math.min(fillPercent, 100)}%` }}
                          />
                        </div>
                        {full && (
                          <div className="text-[9px] text-cyber-red mt-0.5">
                            Переполнение! Стройте складские модули
                          </div>
                        )}
                      </div>
                    );
                  }).filter(Boolean)}
              </div>

              <div className="mt-3 pt-2 border-t border-cyber-gray/50">
                <div className="text-xs text-cyber-text-dim mb-2">Прогресс</div>
                <div className="text-xs text-cyber-text-dim space-y-1">
                  <div>
                    Кубиты: <span className="text-cyber-text">{formatNumber(meta.qubits)}</span>
                    <span className="text-cyber-gray-light"> · Энергии за цикл: {formatNumber(meta.lifetimeEnergyProduced)}</span>
                  </div>
                  <div>
                    Итоговые множители:{' '}
                    <span className="text-cyber-gray-light">скорость x</span>
                    <span className="text-cyber-text">{progressionUi.speedMult.toFixed(2)}</span>
                    <span className="text-cyber-gray-light">{progressionUi.overclockerPaid ? ' (Overclocker)' : ''}</span>
                    <span className="text-cyber-gray-light"> · пропускная </span>
                    <span className="text-cyber-text">{formatNumber(progressionUi.bandwidth)}</span>
                    <span className="text-cyber-gray-light">/с · лимиты x</span>
                    <span className="text-cyber-text">{formatNumber(progressionUi.capsMult)}</span>
                    <span className="text-cyber-gray-light"> · маржа x</span>
                    <span className="text-cyber-text">{progressionUi.tradeMult.toFixed(2)}</span>
                    <span className="text-cyber-gray-light"> · оборона x</span>
                    <span className="text-cyber-text">{formatNumber(progressionUi.combatMult)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-cyber-gray/50">
                <div className="text-xs text-cyber-text-dim mb-2">Оборона</div>
                <div className="text-xs text-cyber-text-dim space-y-1">
                  <div>
                    Турели: <IconText>{defenseUi.turretNeed.gt(0)
                      ? `${formatNumber(defenseUi.turretUsed)}⚡/с из ${formatNumber(defenseUi.turretNeed)}⚡/с · эффективность ${Math.round(defenseUi.turretPct * 100)}%`
                      : '—'}</IconText>
                  </div>
                  <div>
                    Щит: <IconText>{defenseUi.shieldMax.gt(0)
                      ? `${formatNumber(defenseUi.shieldHp)} / ${formatNumber(defenseUi.shieldMax)} · реген +${formatNumber(defenseUi.shieldRegen)}/с · ${formatNumber(defenseUi.shieldUsed)}⚡/с из ${formatNumber(defenseUi.shieldNeed)}⚡/с`
                      : '—'}</IconText>
                  </div>
                  {defenseUi.pressurePotential.gt(0) ? (
                    <div>
                      Давление: {formatNumber(defenseUi.pressure)}/с (макс {formatNumber(defenseUi.pressurePotential)}/с)
                    </div>
                  ) : null}
                  {defenseUi.baseDmg.gt(0) ? (
                    <div>
                      Урон базе: -{formatNumber(defenseUi.baseDmg)}/с
                    </div>
                  ) : null}
                  {defenseUi.shieldAbsorb.gt(0) ? (
                    <div className="text-cyber-gray-light">
                      Поглощение щитом: {formatNumber(defenseUi.shieldAbsorb)}/с
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : building ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className={`font-bold flex items-center gap-2 ${isRuined ? 'text-cyber-red' : 'text-cyber-blue'}`}>
                  {PlacedBuildIcon ? <PlacedBuildIcon size={16} className={isRuined ? 'text-cyber-red' : 'text-cyber-blue'} /> : null}
                  <span>{building.name}</span>
                  <span className="text-cyber-green text-sm">Ур. {buildingLevel}</span>
                  {isRuined ? <GameIcon icon="broken_image" size={14} /> : null}
                </div>
                <div className="text-xs text-cyber-text-dim">На клетке · Всего установлено: {building.count}</div>
              </div>
              <button
                className="cyber-button text-xs py-2 px-3"
                onClick={() => removeBuildingAt(grid.selected!)}
              >
                {isRuined ? 'РАЗОБРАТЬ' : 'СНЕСТИ'}
              </button>
            </div>

            {/*
              Разрушенное здание (bigplan.md, пункт 38). Отдельная плашка, а не строка в
              описании: молча вставшая шахта читается как поломка энергосети, и игрок будет
              искать причину не там. Здесь же сразу сказано, что делать и что за это будет.
            */}
            {isRuined ? (
              <div className="p-2 rounded border bg-red-900/20 border-red-500/40">
                <div className="text-xs font-bold text-red-300 flex items-center gap-1">
                  <GameIcon icon="broken_image" size={13} />
                  Здание разрушено: месторождение выработано
                </div>
                <div className="text-[10px] text-cyber-gray-light mt-0.5">
                  Добыча остановлена навсегда — жила пуста. При разборе вернётся{' '}
                  {Math.round(RUIN_REFUND_MIN * 100)}–{Math.round(RUIN_REFUND_MAX * 100)}% всего
                  вложенного в клетку, включая улучшения и кредиты за них.
                </div>
              </div>
            ) : null}

            {/* Остаток жилы под добывающим зданием: по нему видно, когда искать новое место. */}
            {depositInfo && !isRuined ? (
              <div className="p-2 rounded border bg-cyber-dark/40 border-cyber-gray/30">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-cyber-text-dim">
                    Месторождение: <span className="text-cyber-text">{RESOURCE_LABEL[deposit as ResourceType]}</span>
                  </span>
                  <span className="font-mono text-cyber-text">
                    {formatNumber(D(depositInfo.left))}
                    {' / '}
                    {formatNumber(D(depositInfo.total))}
                  </span>
                </div>
                <div className="h-1.5 bg-cyber-gray/20 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full transition-all ${
                      depositInfo.ratio < 0.15
                        ? 'bg-cyber-red'
                        : depositInfo.ratio < 0.4
                          ? 'bg-orange-400'
                          : 'bg-cyber-green'
                    }`}
                    style={{ width: `${Math.max(2, Math.round(depositInfo.ratio * 100))}%` }}
                  />
                </div>
                {depositInfo.ratio < 0.15 ? (
                  <div className="text-[10px] text-cyber-red mt-0.5">
                    Жила почти выработана: присмотрите место под следующую шахту.
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* ФАЗА 11: УПРАВЛЕНИЕ ЗДАНИЕМ (Отключить/Включить) */}
            {buildingId && isBuildingDisableable(buildingId) && (
              <div className={`p-2 rounded border ${
                isDisabled 
                  ? 'bg-red-900/20 border-red-500/30' 
                  : 'bg-cyan-900/20 border-cyan-500/30'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs">
                    <div className={`font-bold ${isDisabled ? 'text-red-300' : 'text-cyan-300'}`}>
                      <IconText>{isDisabled ? '⏸️ Здание отключено' : '▶️ Здание работает'}</IconText>
                    </div>
                    <div className="text-[10px] text-cyber-gray-light mt-0.5">
                      {isDisabled 
                        ? 'Не производит и не потребляет ресурсы' 
                        : 'Кликни для остановки производства'
                      }
                    </div>
                  </div>
                  <button
                    className={`px-4 py-2 rounded text-xs font-bold flex items-center gap-2 transition-all ${
                      isDisabled
                        ? 'bg-green-600 hover:bg-green-500 text-white'
                        : 'bg-red-600 hover:bg-red-500 text-white'
                    }`}
                    onClick={() => toggleBuildingDisabled(grid.selected!)}
                  >
                    {isDisabled ? (
                      <>
                        <Power size={14} />
                        <span>ВКЛЮЧИТЬ</span>
                      </>
                    ) : (
                      <>
                        <PowerOff size={14} />
                        <span>ОТКЛЮЧИТЬ</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ФАЗА 5: ПРОДВИНУТЫЕ НАСТРОЙКИ ЗДАНИЯ */}
            {buildingId && selectedKey && isBuildingDisableable(buildingId) && (
              <div className="bg-purple-900/20 p-2 rounded border border-purple-500/30">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs">
                    <div className="font-bold text-purple-300"><GameIcon icon="⚙️" /> Продвинутые настройки</div>
                    <div className="text-[10px] text-cyber-gray-light mt-0.5">
                      Режимы работы, приоритеты, автопродажа
                    </div>
                  </div>
                  <button
                    className="px-4 py-2 rounded text-xs font-bold flex items-center gap-2 transition-all bg-purple-600 hover:bg-purple-500 text-white"
                    onClick={() => setShowSettingsPanel(true)}
                  >
                    <Settings size={14} />
                    <span>НАСТРОЙКИ</span>
                  </button>
                </div>
              </div>
            )}

            {/*
              Идёт стройка или улучшение (bigplan.md, пункты 18–19). Блок объясняет, почему
              здание не производит, показывает остаток времени и даёт отменить — без отмены
              ошибочный клик по дорогому зданию заморозил бы ресурсы до конца работы.
            */}
            {activeJob && (
              <div className="bg-cyber-dark/40 p-2 rounded border border-cyber-blue/40">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-xs text-cyber-blue">
                    <GameIcon icon="🏗️" />{' '}
                    {activeJob.kind === 'build'
                      ? 'Идёт постройка'
                      : `Идёт улучшение до ур. ${activeJob.targetLevel ?? '?'}`}
                  </div>
                  <div className="text-xs font-mono text-cyber-text-dim tabular-nums">
                    {formatJobRemaining(activeJob, nowTick)}
                  </div>
                </div>

                <div className="h-1.5 rounded bg-cyber-black/60 overflow-hidden">
                  <div
                    className="h-full bg-cyber-blue transition-[width] duration-200"
                    style={{ width: `${Math.round(jobProgress(activeJob, nowTick) * 100)}%` }}
                  />
                </div>

                <div className="text-[10px] text-cyber-text-dim mt-1.5">
                  Пока идёт работа, здание не производит и не потребляет.
                </div>

                <button
                  type="button"
                  className="mt-2 w-full bg-red-600/70 hover:bg-red-600 text-white text-xs py-1.5 px-3 rounded"
                  onClick={() => grid.selected && cancelTileJob(grid.selected)}
                >
                  Отменить и вернуть ресурсы
                </button>
              </div>
            )}

            {/* ФАЗА 8.5: Система уровней зданий */}
            <div className="bg-cyber-dark/40 p-2 rounded border border-cyber-green/30">
              <div className="text-xs text-cyber-text-dim mb-2"><GameIcon icon="⬆️" /> Улучшение здания</div>

              {(() => {
                // Рассчитываем стоимость улучшения
                const upgradeCostFactor = Math.pow(1.15, buildingLevel);
                const upgradeCost: Array<{resource: string, amount: Decimal, available: Decimal, canAfford: boolean}> = [];
                // Пока на клетке идёт работа, новое улучшение в очередь не ставим.
                let canAffordUpgrade = buildingLevel < 500 && !activeJob;
                
                Object.entries(building.baseCost).forEach(([resource, baseCost]) => {
                  const cost = D(baseCost).mul(upgradeCostFactor);
                  const available = resources[resource as ResourceType]?.amount || D(0);
                  const canAfford = available.gte(cost);
                  if (!canAfford) canAffordUpgrade = false;
                  upgradeCost.push({ resource, amount: cost, available, canAfford });
                });
                
                if (building.creditCost) {
                  const creditCost = building.creditCost.mul(upgradeCostFactor);
                  const canAfford = currency.credits.gte(creditCost);
                  if (!canAfford) canAffordUpgrade = false;
                  upgradeCost.push({ resource: 'credits', amount: creditCost, available: currency.credits, canAfford });
                }
                
                // Рассчитываем возврат за понижение
                const downgradeCostFactor = Math.pow(1.15, buildingLevel - 1);
                const downgradeRefund: Array<{resource: string, amount: Decimal}> = [];
                
                Object.entries(building.baseCost).forEach(([resource, baseCost]) => {
                  const refund = D(baseCost).mul(downgradeCostFactor).mul(0.5);
                  downgradeRefund.push({ resource, amount: refund });
                });
                
                if (building.creditCost) {
                  const creditRefund = building.creditCost.mul(downgradeCostFactor).mul(0.5);
                  downgradeRefund.push({ resource: 'credits', amount: creditRefund });
                }
                
                return (
                  <>
                    <div className="flex items-center gap-2">
                      <button
                        className="flex-1 bg-green-600/80 hover:bg-green-600 text-white text-xs py-2 px-3 rounded flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => upgradeBuildingAt(grid.selected!)}
                        disabled={!canAffordUpgrade}
                      >
                        <ArrowUp size={14} />
                        <span>Улучшить (Ур. {buildingLevel + 1})</span>
                      </button>
                      <button
                        className="bg-cyan-600/80 hover:bg-cyan-600 text-white text-xs py-2 px-2 rounded flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => useGameStore.getState().maxUpgradeBuildingAt(grid.selected!)}
                        disabled={!canAffordUpgrade}
                        title="Улучшить на максимум"
                      >
                        <span className="font-bold">МАКС</span>
                      </button>
                      <button
                        className="flex-1 bg-orange-600/80 hover:bg-orange-600 text-white text-xs py-2 px-3 rounded flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => downgradeBuildingAt(grid.selected!)}
                        disabled={buildingLevel <= 1 || !!activeJob}
                      >
                        <ArrowDown size={14} />
                        <span>Понизить (Ур. {buildingLevel - 1})</span>
                      </button>
                    </div>
                    
                    {/* Стоимость улучшения */}
                    {buildingLevel < 500 && upgradeCost.length > 0 && (
                      <div className="text-[10px] mt-2 p-1.5 bg-green-900/20 rounded border border-green-500/30">
                        <div className="text-green-400 font-semibold mb-1"><GameIcon icon="📈" /> Стоимость улучшения:</div>
                        <div className="flex flex-wrap gap-2">
                          {upgradeCost.map(({ resource, amount, canAfford }) => (
                            <span key={resource} className={canAfford ? 'text-green-300' : 'text-red-400'}>
                              <IconText>{resource === 'credits' ? '💰' : RESOURCE_LABEL[resource as ResourceType]}</IconText> {formatNumber(amount)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Возврат за понижение */}
                    {buildingLevel > 1 && downgradeRefund.length > 0 && (
                      <div className="text-[10px] mt-2 p-1.5 bg-orange-900/20 rounded border border-orange-500/30">
                        <div className="text-orange-400 font-semibold mb-1"><GameIcon icon="📉" /> Возврат за понижение (50%):</div>
                        <div className="flex flex-wrap gap-2">
                          {downgradeRefund.map(({ resource, amount }) => (
                            <span key={resource} className="text-orange-300">
                              <IconText>{resource === 'credits' ? '💰' : RESOURCE_LABEL[resource as ResourceType]}</IconText> {formatNumber(amount)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="text-[10px] text-cyber-gray-light mt-2 space-y-0.5">
                      <div><GameIcon icon="💡" /> Каждый уровень умножает производство и потребление</div>
                      
                      {/* Производство */}
                      {building.production && Object.keys(building.production).length > 0 && (
                        <>
                          <div><GameIcon icon="🎯" /> Производство на уровне {buildingLevel}: {Object.entries(building.production).map(([res, amt]) => 
                            `${RESOURCE_LABEL[res as ResourceType]} ${formatNumber(D(amt).mul(buildingLevel))}/с`
                          ).join(', ')}</div>
                          {buildingLevel < 500 && (
                            <div><GameIcon icon="🔮" /> На уровне {buildingLevel + 1}: {Object.entries(building.production).map(([res, amt]) => 
                              `${RESOURCE_LABEL[res as ResourceType]} ${formatNumber(D(amt).mul(buildingLevel + 1))}/с`
                            ).join(', ')}</div>
                          )}
                        </>
                      )}
                      
                      {/* Вместимость (для складов) */}
                      {building.productionMultipliers && Object.keys(building.productionMultipliers).length > 0 && (() => {
                        const effective = expandWarehouseProductionMultipliers(
                          building.id,
                          building.productionMultipliers,
                          BASE_RESOURCE_MAX
                        );
                        const entries = Object.entries(effective);
                        const LIMIT = 8;

                        const fmt = (lvl: number) => {
                          const parts = entries.map(([res, amt]) =>
                            `${RESOURCE_LABEL[res as ResourceType]} +${formatNumber(D(amt).mul(lvl))}`
                          );
                          const shown = parts.slice(0, LIMIT);
                          const more = parts.length - shown.length;
                          return `${shown.join(', ')}${more > 0 ? `, … +ещё ${more}` : ''}`;
                        };

                        return (
                          <>
                            {/* Здесь печатался сам номер уровня вместо разбивки по ресурсам:
                                fmt() собран как раз для этого, но его забыли вызвать. */}
                            <div className="text-purple-300"><GameIcon icon="📦" /> Вместимость на уровне {buildingLevel}: {fmt(buildingLevel)}</div>
                            {buildingLevel < 500 && (
                              <div className="text-purple-400"><GameIcon icon="🔮" /> На уровне {buildingLevel + 1}: {fmt(buildingLevel + 1)}</div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* PHASE 4: ЭВОЛЮЦИЯ ЗДАНИЙ */}
            {(() => {
              // Проверяем, разблокирована ли эволюция
              if (!ascension.unlocks.buildingEvolution) return null;
              // На пустой клетке buildingId === null — эволюционировать нечего.
              if (!buildingId) return null;

              const evolutionConfig = BUILDING_EVOLUTIONS[buildingId];
              if (!evolutionConfig || !evolutionConfig.tiers || evolutionConfig.tiers.length === 0) return null;

              const currentEvolution = getCurrentEvolution(buildingId, evolutionLevel);
              const nextEvolution = getNextEvolution(buildingId, evolutionLevel);
              const currentMultiplier = getEvolutionMultiplier(buildingId, evolutionLevel);

              if (!nextEvolution) {
                // Максимальная эволюция достигнута
                return (
                  <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 p-2 rounded border border-purple-500/50">
                    <div className="flex items-center gap-2 text-xs text-purple-300">
                      <Sparkles size={14} className="text-purple-400" />
                      <span className="font-bold"><GameIcon icon="⭐" /> МАКС. ЭВОЛЮЦИЯ</span>
                    </div>
                    <div className="text-[10px] text-purple-200 mt-1">
                      {currentEvolution?.nameRu || 'Максимальная форма'}: Множитель производства ×{currentMultiplier}
                    </div>
                  </div>
                );
              }

              const canEvolveLevel = buildingLevel >= nextEvolution.level;
              
              // Проверяем стоимость
              const hasEnoughCredits = !nextEvolution.cost?.credits || currency.credits.gte(nextEvolution.cost.credits);
              // availableQuantumPoints — number, а цена эволюции — Decimal; сравниваем так же,
              // как evolveBuildingAt в сторе, иначе кнопка расходилась бы с реальной проверкой.
              const hasEnoughQP = !nextEvolution.cost?.quantum_points || quantumPoints >= Number(nextEvolution.cost.quantum_points);
              const canAfford = hasEnoughCredits && hasEnoughQP;
              const canEvolve = canEvolveLevel && canAfford;
              
              const progressPercent = Math.min(100, (buildingLevel / nextEvolution.level) * 100);

              return (
                <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 p-2 rounded border border-purple-500/30">
                  <div className="text-xs text-cyber-text-dim mb-2 flex items-center gap-2">
                    <Sparkles size={14} className="text-purple-400" />
                    <span><GameIcon icon="🧬" /> Эволюция здания</span>
                  </div>
                  
                  {currentEvolution && (
                    <div className="text-[10px] text-purple-300 mb-2">
                      <GameIcon icon="✨" /> Текущая: {currentEvolution.nameRu} (×{currentMultiplier} производство)
                    </div>
                  )}

                  <div className="mb-2">
                    <div className="flex justify-between text-[10px] text-cyber-text-dim mb-1">
                      <span>Прогресс до следующей эволюции</span>
                      <span>{buildingLevel} / {nextEvolution.level}</span>
                    </div>
                    <div className="w-full bg-cyber-dark/60 h-2 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {nextEvolution.cost && (
                    <div className="text-[10px] text-cyber-text-dim mb-2 flex flex-wrap gap-2">
                      {nextEvolution.cost.credits && (
                        <span className={hasEnoughCredits ? 'text-cyber-green' : 'text-cyber-red'}>
                          <GameIcon icon="💰" /> {formatNumber(nextEvolution.cost.credits)}
                        </span>
                      )}
                      {nextEvolution.cost.quantum_points && (
                        <span className={hasEnoughQP ? 'text-cyber-green' : 'text-cyber-red'}>
                          <GameIcon icon="⚛️" /> {formatNumber(nextEvolution.cost.quantum_points)} QP
                        </span>
                      )}
                    </div>
                  )}

                  <button
                    className={`w-full text-xs py-2 px-3 rounded flex items-center justify-center gap-2 transition-all ${
                      canEvolve 
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white animate-pulse'
                        : 'bg-cyber-dark/60 text-cyber-text-dim cursor-not-allowed'
                    }`}
                    onClick={() => canEvolve && evolveBuildingAt(grid.selected!)}
                    disabled={!canEvolve}
                  >
                    <Sparkles size={14} />
                    <span>
                      <IconText>{!canEvolveLevel
                        ? `Требуется уровень ${nextEvolution.level}`
                        : !canAfford
                        ? 'Недостаточно ресурсов'
                        : `Эволюционировать → ${nextEvolution.nameRu}`
                      }</IconText>
                    </span>
                  </button>

                  <div className="text-[10px] text-purple-200/80 mt-2 space-y-0.5">
                    <div><GameIcon icon="🌟" /> {nextEvolution.nameRu}: ×{nextEvolution.multiplier} к производству</div>
                    {nextEvolution.description && (
                      <div className="text-purple-300/60"><IconText>{nextEvolution.description}</IconText></div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Информация об энергопотреблении здания */}
            {building.energyConsumption && building.energyConsumption.gt(0) && (
              <div className="bg-yellow-900/20 p-2 rounded border border-yellow-500/30">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-yellow-300">
                    <Zap size={14} className="text-yellow-400" />
                    <span>Потребление энергии:</span>
                  </div>
                  <span className="font-mono text-yellow-400">
                    -{formatNumber(building.energyConsumption)}/с
                  </span>
                </div>
                {buildingLevel > 1 && (
                  <div className="text-[10px] text-yellow-200/60 mt-1">
                    На уровне {buildingLevel}: -{formatNumber(building.energyConsumption.mul(buildingLevel))}/с
                  </div>
                )}
              </div>
            )}

            {/* Производство энергии (для электростанций) */}
            {building.production?.energy && D(building.production.energy).gt(0) && (
              <div className="bg-green-900/20 p-2 rounded border border-green-500/30">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-green-300">
                    <Zap size={14} className="text-green-400" />
                    <span>Производство энергии:</span>
                  </div>
                  <span className="font-mono text-green-400">
                    +{formatNumber(D(building.production.energy).mul(buildingLevel))}/с
                  </span>
                </div>
                {buildingLevel > 1 && (
                  <div className="text-[10px] text-green-200/60 mt-1">
                    Базовое: {formatNumber(D(building.production.energy))}/с × уровень {buildingLevel}
                  </div>
                )}
              </div>
            )}

            <div className="text-xs text-cyber-text-dim">
              Энергия: {formatNumber(resources.energy.amount)} / {formatNumber(resources.energy.max)}
            </div>

            {/* Индикатор энергопокрытия */}
            {powerStatus && (
              <div className={`text-xs p-2 rounded border ${
                powerStatus.isPowerSource
                  ? 'bg-cyan-900/20 border-cyan-500/30 text-cyan-300'
                  : powerStatus.isPowered
                  ? 'bg-green-900/20 border-green-500/30 text-green-300'
                  : 'bg-red-900/30 border-red-500/50 text-red-300'
              }`}>
                <div className="flex items-center gap-2 font-bold">
                  <Zap size={14} className={powerStatus.isPowerSource ? 'text-cyan-400' : powerStatus.isPowered ? 'text-green-400' : 'text-red-400'} />
                  {powerStatus.isPowerSource ? (
                    <span><GameIcon icon="⚡" /> Источник энергии (радиус: {powerStatus.radius} клеток)</span>
                  ) : powerStatus.isPowered ? (
                    <span><GameIcon icon="✅" /> В зоне энергопокрытия</span>
                  ) : (
                    <span><GameIcon icon="⚠️" /> ВНЕ ЗОНЫ ЭНЕРГОПОКРЫТИЯ</span>
                  )}
                </div>
                {!powerStatus.isPowerSource && !powerStatus.isPowered && (
                  <div className="text-[10px] text-red-200/80 mt-1">
                    <GameIcon icon="💡" /> Постройте электростанцию или подстанцию поблизости!
                  </div>
                )}
              </div>
            )}

            <div className="text-xs text-cyber-text-dim">
              Производство здания начнётся автоматически (если хватает входных ресурсов).
            </div>

            {/* Визуальный индикатор отключенного здания */}
            {isDisabled && (
              <div className="text-xs bg-red-900/30 border border-red-500/50 text-red-300 p-2 rounded">
                <div className="flex items-center gap-2 font-bold">
                  <PowerOff size={14} className="text-red-400" />
                  <span><GameIcon icon="⏸️" /> ЗДАНИЕ ОТКЛЮЧЕНО</span>
                </div>
                <div className="text-[10px] text-red-200/80 mt-1">
                  Производство и потребление ресурсов остановлено. Включите здание выше для возобновления работы.
                </div>
              </div>
            )}

            <div className="text-xs text-cyber-blue bg-cyber-dark/40 p-2 rounded border border-cyber-blue/30 mb-2">
              <GameIcon icon="🔄" /> <span className="font-bold">Автоматическая логистика:</span> Ресурсы доставляются автоматически от ближайших производителей к потребителям. Вращающийся индикатор на здании показывает, что оно работает.
            </div>

            {ioInfo?.hasInputs ? (
              <div className="text-xs">
                <span className="text-cyber-text-dim">Статус:</span>{' '}
                {ioInfo.isBlocked ? (
                  <span className="text-cyber-red font-bold">
                    ЗАБЛОКИРОВАНО
                    {ioInfo.missingList.length > 0 ? ` (нет: ${ioInfo.missingList.map((r) => RESOURCE_LABEL[r]).join(', ')})` : ''}
                  </span>
                ) : (
                  <span className="text-cyber-text font-bold">ОК</span>
                )}
              </div>
            ) : null}

            <div className="text-[10px] text-cyber-gray-light italic mb-2">
              � Все ресурсы производятся в локальном буфере здания<br/>
              <GameIcon icon="🔄" /> Автоматическая доставка от ближайшего источника (здание или база)<br/>
              <GameIcon icon="💡" /> Излишки базовых ресурсов (20+ сек) отправляются на базу
            </div>

            {ioInfo?.hasInputs ? (
              <div className="pt-2 border-t border-cyber-gray/50">
                <div className="text-xs text-cyber-text-dim mb-2">Входы</div>
                <div className="space-y-1">
                  {ioInfo.inputs
                    .filter((i) => i.needPerSec.gt(0))
                    .map((i) => (
                      <div key={i.r} className="flex items-center justify-between text-xs">
                        <div className={i.missing ? 'text-cyber-red' : 'text-cyber-text'}>
                          {RESOURCE_LABEL[i.r]}
                          <span className="text-cyber-text-dim"> · {i.source}</span>
                          {i.missing ? <span className="text-cyber-red"> · нет ресурса</span> : null}
                        </div>
                        <div className={`font-mono ${i.missing ? 'text-cyber-red' : 'text-cyber-text-dim'}`}>
                          {formatNumber(i.needPerSec)}/с
                          <span className="text-cyber-gray-light"> · есть {formatNumber(i.have)}</span>
                        </div>
                      </div>
                    ))}
                </div>
                {ioInfo.isBlocked ? (
                  <div className="text-xs text-cyber-red mt-2">
                    Недостаточно входов: проверь линии и буфер клетки.
                  </div>
                ) : null}
              </div>
            ) : null}

            {ioInfo?.hasOutputs ? (
              <div className="pt-2 border-t border-cyber-gray/50">
                <div className="text-xs text-cyber-text-dim mb-2">Выходы</div>
                <div className="space-y-1">
                  {ioInfo.outputs
                    .filter((o) => o.prodPerSec.gt(0))
                    .map((o) => {
                      // Производители всегда работают в локальный буфер - нет переполнения
                      return (
                        <div key={o.r} className="flex items-center justify-between text-xs">
                          <div className="text-cyber-text">
                            {RESOURCE_LABEL[o.r]}
                            <span className="text-cyber-text-dim"> · {o.target}</span>
                          </div>
                          <div className="font-mono text-cyber-text-dim">
                            {formatNumber(o.prodPerSec)}/с
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : null}

            <div className="pt-2 border-t border-cyber-gray/50">
                <div className="text-xs text-cyber-text-dim mb-2">Локальный буфер клетки</div>
                <div className="text-[10px] text-cyber-gray-light mb-2 italic">
                  <GameIcon icon="ℹ️" /> Все ресурсы автоматически отправляются на базу<br/>
                  <GameIcon icon="🔄" /> Здесь показан рабочий буфер (10 секунд производства)
                </div>
                <div className="space-y-1.5">
                  {(['ore', 'ice', 'carbon', 'steel', 'dark_matter'] as ResourceType[])
                    .filter((r) => {
                      const buf = tileBuffer?.[r] ? D(tileBuffer[r]!) : D(0);
                      const prod = building.production?.[r] ? D(building.production[r]!) : D(0);
                      const cons = building.consumption?.[r] ? D(building.consumption[r]!) : D(0);
                      return buf.gt(0) || prod.gt(0) || cons.gt(0);
                    })
                    .map((r) => {
                      const buf = tileBuffer?.[r] ? D(tileBuffer[r]!) : D(0);
                      // Примерный "cap" для визуализации - используем 100 единиц как базу
                      const estimatedCap = D(100);
                      const fillPct = Math.min(100, Number(buf.div(estimatedCap).mul(100).toString()));
                      const isNearFull = fillPct > 80;
                      
                      return (
                        <div key={r} className="space-y-0.5">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-cyber-text-dim">{RESOURCE_LABEL[r]}</span>
                            <span className={`font-mono ${isNearFull ? 'text-cyber-red' : 'text-cyber-text'}`}>
                              {formatNumber(buf)}
                            </span>
                          </div>
                          <div className="h-1.5 bg-cyber-gray/20 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all ${isNearFull ? 'bg-cyber-red' : 'bg-cyber-blue'}`}
                              style={{ width: `${fillPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  {(['ore', 'ice', 'carbon', 'steel', 'dark_matter'] as ResourceType[])
                    .filter((r) => {
                      const buf = tileBuffer?.[r] ? D(tileBuffer[r]!) : D(0);
                      const prod = building.production?.[r] ? D(building.production[r]!) : D(0);
                      const cons = building.consumption?.[r] ? D(building.consumption[r]!) : D(0);
                      return buf.lte(0) && prod.lte(0) && cons.lte(0);
                    }).length === 5 ? (
                    <div className="text-[10px] text-cyber-gray-light italic">Буфер пуст</div>
                  ) : null}
                </div>

                {selectedKey ? (
                  <div className="mt-3 pt-2 border-t border-cyber-gray/50">
                    <div className="text-xs text-cyber-text-dim mb-2">Политика рынка (автоторговля)</div>
                    <div className="text-[10px] text-cyber-gray-light mb-2 italic">
                      <GameIcon icon="💡" /> ИМП: Автоматически докупать ресурс с рынка если не хватает для производства<br/>
                      <GameIcon icon="💡" /> ЭКС: Автоматически продавать излишки ресурса <GameIcon icon="→" /> конвертация в <GameIcon icon="⚡" />энергию<br/>
                      <GameIcon icon="⚠️" /> Автопродажа останавливается если энергия переполнена (достигнут лимит)
                    </div>
                    <div className="space-y-1">
                      {(['ore', 'ice', 'carbon', 'steel'] as TradeResourceType[]).map((r) => {
                        const p = (tileMarketPolicy as any)[r] as { import?: boolean; export?: boolean } | undefined;
                        const imp = Boolean(p?.import);
                        const exp = Boolean(p?.export);
                        return (
                          <div key={r} className="flex items-center justify-between gap-2 text-xs">
                            <div className="text-cyber-text-dim">{RESOURCE_LABEL[r]}</div>
                            <div className="flex items-center gap-2">
                              <button
                                className={`cyber-button text-xs py-1 px-2 ${imp ? '' : 'opacity-50'}`}
                                onClick={() => setTileMarketPolicy(selectedKey, r, { import: !imp })}
                                title="Разрешить докупать ресурс на рынке, если не хватает для работы"
                              >
                                ИМП
                              </button>
                              <button
                                className={`cyber-button text-xs py-1 px-2 ${exp ? '' : 'opacity-50'}`}
                                onClick={() => setTileMarketPolicy(selectedKey, r, { export: !exp })}
                                title="Разрешить автопродажу излишков ресурса с этой клетки"
                              >
                                ЭКС
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm text-cyber-text-dim">Пустая клетка</div>

            {deposit ? (
              <div className="text-xs text-cyber-text-dim space-y-1">
                <div>
                  Месторождение: <span className="text-cyber-text">{RESOURCE_LABEL[deposit]}</span>
                </div>
                {/* Запас жилы виден ДО постройки: иначе выбор места был бы вслепую. */}
                {depositInfo?.exhausted ? (
                  <div className="text-cyber-red flex items-center gap-1">
                    <GameIcon icon="broken_image" size={12} />
                    Выработано — добывать здесь больше нечего.
                  </div>
                ) : depositInfo ? (
                  <div className="text-cyber-gray-light">
                    Запас: {formatNumber(D(depositInfo.left))}
                    {` (${Math.round(depositInfo.ratio * 100)}%)`}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-xs text-cyber-gray-light">Месторождений нет.</div>
            )}

            {selectedBuild ? (
              <>
                <div className="text-xs text-cyber-text-dim">
                  Готово к установке: <span className="text-cyber-text">{selectedBuild.name}</span>
                </div>

                {selectedBuildCost ? (
                  <div className="text-xs text-cyber-text-dim">
                    Стоимость:{' '}
                    <span className="text-cyber-text-dim">
                      <IconText>{Object.entries(selectedBuildCost)
                        .map(([res, amt]) => {
                          const r = res as ResourceType;
                          return `${formatNumber(amt)} ${r === 'energy' ? '⚡' : RESOURCE_LABEL[r]}`;
                        })
                        .join(', ')}</IconText>
                    </span>
                  </div>
                ) : null}

                {!affordability.canAfford ? (
                  <div className="text-xs text-cyber-red">
                    Недостаточно ресурсов: {affordability.missing.map((m) => `${m.amount} ${RESOURCE_LABEL[m.res]}`).join(', ')}
                  </div>
                ) : null}

                {(() => {
                  const need = requiredDepositForBuilding(selectedBuild.id);
                  if (!need) return null;
                  if (deposit !== need) {
                    return (
                      <div className="text-xs text-cyber-red">
                        Нельзя поставить здесь: нужна клетка с месторождением {RESOURCE_LABEL[need]}.
                      </div>
                    );
                  }
                  // Жила есть, но пустая: причина отказа своя, и назвать её надо своими словами.
                  if (depositInfo?.exhausted) {
                    return (
                      <div className="text-xs text-cyber-red">
                        Нельзя поставить здесь: месторождение {RESOURCE_LABEL[need]} выработано.
                      </div>
                    );
                  }
                  return null;
                })()}

                <button
                  className="cyber-button text-xs py-2 px-3 w-full"
                  disabled={
                    !affordability.canAfford ||
                    Boolean(
                      requiredDepositForBuilding(selectedBuild.id) &&
                        (deposit !== requiredDepositForBuilding(selectedBuild.id) ||
                          depositInfo?.exhausted),
                    )
                  }
                  onClick={() => placeSelectedBuildAt(grid.selected!)}
                >
                  ПОСТАВИТЬ ЗДЕСЬ
                </button>

                <div className="text-xs text-cyber-gray-light">
                  Подсказка: можно ставить несколько раз — просто кликай по другим клеткам.
                </div>
              </>
            ) : (
              <div className="text-xs text-cyber-text-dim">
                Выбери здание справа (кнопка «ВЫБРАТЬ»), затем поставь его на клетку.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ФАЗА 5: Модальное окно настроек здания.
          buildingId панель выводит сама из grid.tiles[tileKey], проп ей не нужен. */}
      {showSettingsPanel && selectedKey && buildingId && (
        <BuildingSettingsPanel
          tileKey={selectedKey}
          onClose={() => setShowSettingsPanel(false)}
        />
      )}
    </div>
  );
}
