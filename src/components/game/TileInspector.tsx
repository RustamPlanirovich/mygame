import { useMemo } from 'react';
import { useGameStore } from '../../features/gameStore';
import { calculateCost } from '../../features/gameStore';
import { D, formatNumber } from '../../core/math/format.ts';
import type { ResourceType, TradeResourceType } from '../../core/gameTypes';
import { RESOURCE_LABEL } from '../../core/constants/labels';
import { getBuildingIcon } from '../../core/constants/buildingIcons';
import { Search } from 'lucide-react';
import {
  computeBandwidth,
  computeCapsMultiplier,
  computeCombatMultiplier,
  computeSpeedMultiplier,
  computeTradeMultiplier,
} from '../../core/constants/progression';

export function TileInspector() {
  const grid = useGameStore((s) => s.grid);
  const buildings = useGameStore((s) => s.buildings);
  const resources = useGameStore((s) => s.resources);
  const combat = useGameStore((s) => s.combat);
  const researchLevels = useGameStore((s) => s.research.levels);
  const meta = useGameStore((s) => s.meta);
  const demons = useGameStore((s) => s.demons);
  const selectTile = useGameStore((s) => s.selectTile);
  const selectBuild = useGameStore((s) => s.selectBuild);
  const placeSelectedBuildAt = useGameStore((s) => s.placeSelectedBuildAt);
  const removeBuildingAt = useGameStore((s) => s.removeBuildingAt);
  const startLink = useGameStore((s) => s.startLink);
  const startLinkImport = useGameStore((s) => s.startLinkImport);
  const cancelLink = useGameStore((s) => s.cancelLink);
  const removeLink = useGameStore((s) => s.removeLink);
  const toggleLinkEnabled = useGameStore((s) => s.toggleLinkEnabled);
  const focusLink = useGameStore((s) => s.focusLink);
  const setTileMarketPolicy = useGameStore((s) => s.setTileMarketPolicy);

  const selectedKey = grid.selected ? `${grid.selected.x},${grid.selected.y}` : null;
  const buildingId = selectedKey ? grid.tiles[selectedKey] : null;

  const tileMarketPolicy = selectedKey ? (grid.marketPolicy?.[selectedKey] ?? {}) : {};

  const deposit = selectedKey ? grid.deposits?.[selectedKey] : null;

  const isBaseSelected = Boolean(grid.selected && grid.selected.x === grid.width - 1 && grid.selected.y === grid.height - 1);

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

  const outgoingLinks = useMemo(() => {
    if (!grid.selected) return [];
    return grid.links.filter((l) => l.from.x === grid.selected!.x && l.from.y === grid.selected!.y);
  }, [grid.links, grid.selected]);

  const incomingLinks = useMemo(() => {
    if (!grid.selected) return [];
    return grid.links.filter((l) => l.to.x === grid.selected!.x && l.to.y === grid.selected!.y);
  }, [grid.links, grid.selected]);

  const baseIncomingLinks = useMemo(() => {
    const bx = grid.width - 1;
    const by = grid.height - 1;
    return grid.links.filter((l) => l.to.x === bx && l.to.y === by);
  }, [grid.height, grid.links, grid.width]);

  const building = useMemo(() => {
    if (!buildingId) return null;
    return buildings.find((b) => b.id === buildingId) ?? null;
  }, [buildingId, buildings]);

  const ioInfo = useMemo(() => {
    if (!grid.selected || !selectedKey || !building) return null;

    const tileBuf = grid.buffers[selectedKey] ?? {};
    const baseBuf = grid.buffers.base ?? {};

    const inputs = Object.entries(building.consumption ?? {}).map(([res, perSecond]) => {
      const r = res as ResourceType;
      const needPerSec = D(perSecond);
      const rawHave = r === 'energy' ? baseBuf[r] : tileBuf[r];
      const have = rawHave ? D(rawHave) : D(0);
      const missing = needPerSec.gt(0) && have.lte(0);
      return { r, needPerSec, have, missing, source: r === 'energy' ? 'база' : 'буфер' };
    });

    const outputs = Object.entries(building.production ?? {}).map(([res, perSecond]) => {
      const r = res as ResourceType;
      const prodPerSec = D(perSecond);
      // Базовые ресурсы идут сразу на базу
      const isBasicResource = ['energy', 'ore', 'ice', 'carbon'].includes(r);
      return { r, prodPerSec, target: isBasicResource ? 'база' : 'буфер' };
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

  const focusedLinkContext = useMemo(() => {
    if (!grid.selected || !grid.focusedLink) return null;
    const link = grid.focusedLink;

    const isFrom = link.from.x === grid.selected.x && link.from.y === grid.selected.y;
    const isTo = link.to.x === grid.selected.x && link.to.y === grid.selected.y;
    if (!isFrom && !isTo) return null;

    const key = `${link.from.x},${link.from.y}->${link.to.x},${link.to.y}:${link.resource}`;
    const movedRaw = grid.linkMoved?.[key];
    const moved = movedRaw ? D(movedRaw) : D(0);

    const fromKey = `${link.from.x},${link.from.y}`;
    const toIsBase = link.to.x === grid.width - 1 && link.to.y === grid.height - 1;
    const toKey = toIsBase ? 'base' : `${link.to.x},${link.to.y}`;
    const fromHaveRaw = grid.buffers[fromKey]?.[link.resource];
    const toHaveRaw = grid.buffers[toKey]?.[link.resource];
    const fromHave = fromHaveRaw ? D(fromHaveRaw) : D(0);
    const toHave = toHaveRaw ? D(toHaveRaw) : D(0);

    const resource = link.resource;

    // For selected cell only
    const selectedRole = isFrom ? 'from' : 'to';
    const selectedBuildingId = selectedKey ? grid.tiles[selectedKey] : null;
    const selectedBuilding = selectedBuildingId ? (buildings.find((b) => b.id === selectedBuildingId) ?? null) : null;

    const prodPerSecRaw = selectedBuilding?.production?.[resource];
    const prodPerSec = prodPerSecRaw ? D(prodPerSecRaw) : D(0);
    const needPerSecRaw = selectedBuilding?.consumption?.[resource];
    const needPerSec = needPerSecRaw ? D(needPerSecRaw) : D(0);

    return {
      selectedRole,
      resource,
      moved,
      fromHave,
      toHave,
      toIsBase,
      selectedBuilding,
      prodPerSec,
      needPerSec,
    };
  }, [buildings, grid, selectedKey]);

  return (
    <div className="p-4 border-b border-cyber-gray">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xl text-cyber-green uppercase tracking-wider flex items-center gap-2">
          <Search size={18} className="text-cyber-green" />
          <span>Инспектор</span>
        </h2>
        <div className="text-xs text-cyber-text-dim">
          {grid.selected ? `Клетка: (${grid.selected.x}, ${grid.selected.y})` : 'Выберите клетку'}
        </div>
      </div>

      <div className="cyber-panel">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-xs text-cyber-text-dim">
            Режим строительства:{' '}
            {selectedBuild ? (
              <span className="text-cyber-text inline-flex items-center gap-2">
                {SelectedBuildIcon ? <SelectedBuildIcon size={14} className="text-cyber-text" /> : null}
                <span>{selectedBuild.name}</span>
              </span>
            ) : (
              <span className="text-cyber-text-dim">выкл</span>
            )}
          </div>
          {selectedBuild ? (
            <button className="cyber-button text-xs py-2 px-3" onClick={() => selectBuild(null)}>
              ОТМЕНА
            </button>
          ) : null}
        </div>

        {grid.linking ? (
          <div className="mb-3 p-2 rounded border border-cyber-gray bg-cyber-dark/40">
            <div className="text-xs text-cyber-text-dim">
              {grid.linking.mode === 'export' ? (
                <>
                  Экспорт <span className="text-cyber-gray-light">из</span>{' '}
                  <span className="text-cyber-text">
                    ({grid.linking.anchor.x},{grid.linking.anchor.y})
                  </span>{' '}
                  <span className="text-cyber-gray-light">→</span>{' '}
                  <span className="text-cyber-text">{RESOURCE_LABEL[grid.linking.resource]}</span>
                  <span className="text-cyber-text-dim"> · кликните по клетке-цели</span>
                </>
              ) : (
                <>
                  Импорт <span className="text-cyber-gray-light">в</span>{' '}
                  <span className="text-cyber-text">
                    ({grid.linking.anchor.x},{grid.linking.anchor.y})
                  </span>{' '}
                  <span className="text-cyber-gray-light">←</span>{' '}
                  <span className="text-cyber-text">{RESOURCE_LABEL[grid.linking.resource]}</span>
                  <span className="text-cyber-text-dim"> · кликните по клетке-источнику</span>
                </>
              )}
            </div>
            <button className="cyber-button text-xs py-2 px-3 mt-2 w-full" onClick={cancelLink}>
              ОТМЕНИТЬ СОЕДИНЕНИЕ
            </button>
          </div>
        ) : null}

        {!grid.selected ? (
          <div className="text-sm text-cyber-text-dim">Выбери клетку на сетке слева.</div>
        ) : isBaseSelected ? (
          <div className="space-y-2">
            <div className="text-sm text-cyber-text-dim">База</div>

            <div className="text-xs text-cyber-text-dim">
              Это склад (sink). Все ресурсы, которыми ты строишь и которые продаёшь на обмене, лежат здесь.
            </div>

            <div className="pt-2 border-t border-cyber-gray/50">
              <div className="text-xs text-cyber-text-dim mb-2">Склад базы</div>
              <div className="text-xs text-cyber-text-dim flex flex-wrap gap-x-3 gap-y-1">
                {(['energy', 'ore', 'ice', 'carbon', 'steel', 'dark_matter'] as ResourceType[]).map((r) => {
                  const raw = grid.buffers.base?.[r];
                  const amt = raw ? D(raw) : D(0);
                  const max = resources[r].max;
                  const full = max.gt(0) && amt.gte(max);
                  return (
                    <div key={r}>
                      <span className="text-cyber-text-dim">{RESOURCE_LABEL[r]}:</span>{' '}
                      <span className={`font-mono ${full ? 'text-cyber-red' : 'text-cyber-text'}`}>
                        {formatNumber(amt)} / {formatNumber(max)}
                      </span>
                      {full ? <span className="text-cyber-red"> (ПОЛНО)</span> : null}
                    </div>
                  );
                })}
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
                    Турели: {defenseUi.turretNeed.gt(0)
                      ? `${formatNumber(defenseUi.turretUsed)}⚡/с из ${formatNumber(defenseUi.turretNeed)}⚡/с · эффективность ${Math.round(defenseUi.turretPct * 100)}%`
                      : '—'}
                  </div>
                  <div>
                    Щит: {defenseUi.shieldMax.gt(0)
                      ? `${formatNumber(defenseUi.shieldHp)} / ${formatNumber(defenseUi.shieldMax)} · реген +${formatNumber(defenseUi.shieldRegen)}/с · ${formatNumber(defenseUi.shieldUsed)}⚡/с из ${formatNumber(defenseUi.shieldNeed)}⚡/с`
                      : '—'}
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

              {baseIncomingLinks.length > 0 ? (
                <div className="mt-2 text-xs text-cyber-text-dim">
                  Входящие линии в базу: {baseIncomingLinks.map((l) => `${RESOURCE_LABEL[l.resource]} ← (${l.from.x},${l.from.y})`).join(' · ')}
                </div>
              ) : (
                <div className="mt-2 text-xs text-cyber-gray-light">В базу пока нет входящих линий.</div>
              )}
            </div>
          </div>
        ) : building ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-cyber-blue font-bold flex items-center gap-2">
                  {PlacedBuildIcon ? <PlacedBuildIcon size={16} className="text-cyber-blue" /> : null}
                  <span>{building.name}</span>
                </div>
                <div className="text-xs text-cyber-text-dim">На клетке · Всего установлено: {building.count}</div>
              </div>
              <button
                className="cyber-button text-xs py-2 px-3"
                onClick={() => removeBuildingAt(grid.selected!)}
              >
                СНЕСТИ
              </button>
            </div>

            <div className="text-xs text-cyber-text-dim">
              Энергия: {formatNumber(resources.energy.amount)} / {formatNumber(resources.energy.max)}
            </div>

            <div className="text-xs text-cyber-text-dim">
              Производство здания начнётся автоматически (если хватает входных ресурсов).
            </div>

            {focusedLinkContext ? (
              <div className="pt-2 border-t border-cyber-gray/50">
                <div className="text-xs text-cyber-text-dim mb-2">Контекст выбранной линии</div>
                <div className="text-xs text-cyber-text-dim">
                  Ресурс: <span className="text-cyber-text">{RESOURCE_LABEL[focusedLinkContext.resource]}</span>{' '}
                  <span className="text-cyber-text-dim">
                    ({grid.focusedLink!.from.x},{grid.focusedLink!.from.y}) → ({grid.focusedLink!.to.x},{grid.focusedLink!.to.y})
                  </span>
                </div>

                {focusedLinkContext.selectedRole === 'from' ? (
                  <div className="mt-2 text-xs text-cyber-text-dim">
                    <div>
                      Это источник линии. Сейчас в источнике: <span className="text-cyber-text">{formatNumber(focusedLinkContext.fromHave)}</span> ·
                      за последний тик ушло: <span className="text-cyber-text">{formatNumber(focusedLinkContext.moved)}</span>
                    </div>
                    {focusedLinkContext.resource === 'energy' ? (
                      <div className="text-cyber-text-dim mt-1">Энергия хранится на базе; линии энергии обычно не нужны.</div>
                    ) : focusedLinkContext.prodPerSec.gt(0) ? (
                      <div className="text-cyber-text-dim mt-1">
                        Это здание производит {RESOURCE_LABEL[focusedLinkContext.resource]}: {formatNumber(focusedLinkContext.prodPerSec)}/с
                        {ioInfo?.hasInputs && ioInfo.isBlocked ? ` · блок: нет ${ioInfo.missingList.map((r) => RESOURCE_LABEL[r]).join(', ')}` : ''}
                      </div>
                    ) : (
                      <div className="text-cyber-text-dim mt-1">
                        Это здание НЕ производит {RESOURCE_LABEL[focusedLinkContext.resource]}. Возможно, источник линии выбран неверно.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-cyber-text-dim">
                    <div>
                      Это цель линии. Сейчас в цели: <span className="text-cyber-text">{formatNumber(focusedLinkContext.toHave)}</span>
                      {focusedLinkContext.toIsBase ? <span className="text-cyber-text-dim"> (база)</span> : null}
                    </div>
                    {focusedLinkContext.needPerSec.gt(0) ? (
                      <div className="text-cyber-text-dim mt-1">
                        Это здание потребляет {RESOURCE_LABEL[focusedLinkContext.resource]}: {formatNumber(focusedLinkContext.needPerSec)}/с
                      </div>
                    ) : (
                      <div className="text-cyber-text-dim mt-1">
                        Это здание не требует {RESOURCE_LABEL[focusedLinkContext.resource]} как вход.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}

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
              💡 Базовые ресурсы (⚡энергия, руда, лёд, углерод) автоматически поступают на базу<br/>
              🔧 Переработчикам (сталь, т.м.) нужны линки для доставки входов в буфер клетки
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
                      const isBasicResource = ['energy', 'ore', 'ice', 'carbon'].includes(o.r);
                      const blockedByCap = isBasicResource && resources[o.r].max.gt(0) && resources[o.r].amount.gte(resources[o.r].max);
                      return (
                        <div key={o.r} className="flex items-center justify-between text-xs">
                          <div className={blockedByCap ? 'text-cyber-red' : 'text-cyber-text'}>
                            {RESOURCE_LABEL[o.r]}
                            <span className="text-cyber-text-dim"> · {o.target}</span>
                            {blockedByCap ? <span className="text-cyber-red"> · выход переполнен</span> : null}
                          </div>
                          <div className={`font-mono ${blockedByCap ? 'text-cyber-red' : 'text-cyber-text-dim'}`}>
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
                  ℹ️ Базовые ресурсы (⚡энергия, руда, лёд, углерод) идут сразу на базу<br/>
                  💎 Переработанные ресурсы (сталь, тёмная материя) нужно транспортировать линками
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

                <div className="text-xs text-cyber-text-dim mt-3 mb-2">Линии (соединения)</div>
                <div className="text-[10px] text-cyber-gray-light mb-2">
                  <div>Click: выбрать клетку</div>
                  <div>Shift+Click по линии: выбрать линию</div>
                  <div>Right Click по линии: удалить линию</div>
                  <div>Delete/Backspace: удалить выбранную линию</div>
                </div>

                {grid.focusedLink ? (
                  <div className="mb-2 p-2 rounded border border-cyber-gray bg-cyber-dark/40">
                    {(() => {
                      const link = grid.focusedLink!;
                      const key = `${link.from.x},${link.from.y}->${link.to.x},${link.to.y}:${link.resource}`;
                      const movedRaw = grid.linkMoved?.[key];
                      const moved = movedRaw ? D(movedRaw) : D(0);
                      const dt = typeof grid.lastDtSeconds === 'number' ? grid.lastDtSeconds : 0;
                      const bandwidthPerSec = computeBandwidth(researchLevels);
                      const maxByBandwidth = dt > 0 ? bandwidthPerSec.mul(dt) : D(0);
                      const fromKey = `${link.from.x},${link.from.y}`;
                      const toIsBase = link.to.x === grid.width - 1 && link.to.y === grid.height - 1;
                      const toKey = toIsBase ? 'base' : `${link.to.x},${link.to.y}`;
                      const fromHaveRaw = grid.buffers[fromKey]?.[link.resource];
                      const toHaveRaw = grid.buffers[toKey]?.[link.resource];
                      const fromHave = fromHaveRaw ? D(fromHaveRaw) : D(0);
                      const toHave = toHaveRaw ? D(toHaveRaw) : D(0);

                      const upstream = grid.links
                        .filter((l) => l.resource === link.resource && l.to.x === link.from.x && l.to.y === link.from.y)
                        .slice(0, 6);

                      let hint: string | null = null;
                      if (dt <= 0) {
                        hint = 'Причина: тик=0 (пауза/фокус вкладки)';
                      } else if (moved.lte(0)) {
                        if (link.resource === 'energy') {
                          hint = 'Подсказка: энергия хранится на базе; линии энергии обычно не нужны.';
                        } else {
                          hint = fromHave.lte(0)
                            ? 'Причина: пусто в источнике'
                            : 'Причина: поток остановлен (проверь соединение/ресурс)';
                        }
                      } else if (maxByBandwidth.gt(0) && moved.gte(maxByBandwidth.sub(D('0.0000001')))) {
                        hint = 'Ограничение: пропускная способность линии';
                      }

                      return (
                        <div className="text-xs text-cyber-text-dim mb-2">
                          <div>
                            За последний тик: <span className="text-cyber-text">{formatNumber(moved)}</span>
                          </div>
                          <div className="text-cyber-text-dim">
                            Источник сейчас: {formatNumber(fromHave)} · Цель сейчас: {formatNumber(toHave)}{toIsBase ? ' (база)' : ''}
                          </div>
                          {hint ? (
                            <div className="text-cyber-text-dim">{hint}</div>
                          ) : null}

                          {dt > 0 && moved.lte(0) && fromHave.lte(0) && link.resource !== 'energy' ? (
                            <div className="mt-2">
                              <div className="text-cyber-text-dim">Что должно кормить источник (1 шаг):</div>
                              {upstream.length > 0 ? (
                                <div className="mt-1 space-y-1">
                                  {upstream.map((u, idx) => (
                                    <button
                                      key={`${u.resource}-${u.from.x}-${u.from.y}-${idx}`}
                                      className="text-cyber-text-dim hover:text-cyber-text underline-offset-2 hover:underline"
                                      onClick={() => selectTile({ x: u.from.x, y: u.from.y })}
                                      title="Перейти к источнику этой линии"
                                    >
                                      {RESOURCE_LABEL[u.resource]} ← ({u.from.x},{u.from.y})
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-cyber-text-dim mt-1">Нет входящих линий в источник.</div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })()}
                    <div className="text-xs text-cyber-text-dim">
                      Выбрана линия:{' '}
                      <span className="text-cyber-text">{RESOURCE_LABEL[grid.focusedLink.resource]}</span>{' '}
                      <span className="text-cyber-text-dim">
                        ({grid.focusedLink.from.x},{grid.focusedLink.from.y}) → ({grid.focusedLink.to.x},{grid.focusedLink.to.y})
                      </span>
                      {grid.focusedLink.enabled === false ? <span className="text-cyber-red"> · выкл</span> : null}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <button
                        className="cyber-button text-xs py-2 px-3"
                        onClick={() => selectTile({ x: grid.focusedLink!.from.x, y: grid.focusedLink!.from.y })}
                      >
                        ИСТОЧНИК
                      </button>
                      <button
                        className="cyber-button text-xs py-2 px-3"
                        onClick={() => selectTile({ x: grid.focusedLink!.to.x, y: grid.focusedLink!.to.y })}
                      >
                        ЦЕЛЬ
                      </button>
                      <button
                        className="cyber-button text-xs py-2 px-3"
                        onClick={() => toggleLinkEnabled(grid.focusedLink!.from, grid.focusedLink!.to, grid.focusedLink!.resource)}
                      >
                        {grid.focusedLink.enabled === false ? 'ВКЛЮЧИТЬ' : 'ПАУЗА'}
                      </button>
                      <button
                        className="cyber-button text-xs py-2 px-3"
                        onClick={() => removeLink(grid.focusedLink!.from, grid.focusedLink!.to, grid.focusedLink!.resource)}
                      >
                        УДАЛИТЬ
                      </button>
                      <button
                        className="cyber-button text-xs py-2 px-3"
                        onClick={() => focusLink(null)}
                      >
                        СБРОСИТЬ
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-2">
                  {(['energy', 'ore', 'ice', 'carbon', 'steel'] as ResourceType[]).flatMap((r) => [
                    <button
                      key={`${r}-export`}
                      className="cyber-button text-xs py-2 px-3"
                      onClick={() => startLink(grid.selected!, r)}
                      disabled={Boolean(grid.linking)}
                      title="Кликните по клетке-цели"
                    >
                      ЭКСПОРТ: {RESOURCE_LABEL[r]}
                    </button>,
                    <button
                      key={`${r}-import`}
                      className="cyber-button text-xs py-2 px-3"
                      onClick={() => startLinkImport(grid.selected!, r)}
                      disabled={Boolean(grid.linking)}
                      title="Кликните по клетке-источнику"
                    >
                      ИМПОРТ: {RESOURCE_LABEL[r]}
                    </button>,
                  ])}
                </div>

                {incomingLinks.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    <div className="text-xs text-cyber-text-dim">Входящие</div>
                    {incomingLinks.map((l, idx) => (
                      <div key={`${l.resource}-${l.from.x}-${l.from.y}-${idx}`} className="flex items-center justify-between gap-2 text-xs">
                        <button
                          className="text-cyber-text-dim hover:text-cyber-text underline-offset-2 hover:underline"
                          onClick={() => selectTile({ x: l.from.x, y: l.from.y })}
                          title="Выбрать клетку-источник"
                        >
                          {RESOURCE_LABEL[l.resource]} ← ({l.from.x},{l.from.y})
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            className="cyber-button text-xs py-1 px-2"
                            onClick={() => toggleLinkEnabled(l.from, l.to, l.resource)}
                            title={l.enabled === false ? 'Включить линию' : 'Поставить на паузу'}
                          >
                            {l.enabled === false ? 'ВКЛ' : 'ПАУЗА'}
                          </button>
                          <button
                            className="cyber-button text-xs py-1 px-2"
                            onClick={() => removeLink(l.from, l.to, l.resource)}
                          >
                            УДАЛИТЬ
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-cyber-gray-light">Входящих соединений нет.</div>
                )}

                {outgoingLinks.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {outgoingLinks.map((l, idx) => (
                      <div key={`${l.resource}-${l.to.x}-${l.to.y}-${idx}`} className="flex items-center justify-between gap-2 text-xs">
                        <button
                          className="text-cyber-text-dim hover:text-cyber-text underline-offset-2 hover:underline"
                          onClick={() => selectTile({ x: l.to.x, y: l.to.y })}
                          title="Выбрать клетку-цель"
                        >
                          {RESOURCE_LABEL[l.resource]} → ({l.to.x},{l.to.y})
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            className="cyber-button text-xs py-1 px-2"
                            onClick={() => toggleLinkEnabled(l.from, l.to, l.resource)}
                            title={l.enabled === false ? 'Включить линию' : 'Поставить на паузу'}
                          >
                            {l.enabled === false ? 'ВКЛ' : 'ПАУЗА'}
                          </button>
                          <button
                            className="cyber-button text-xs py-1 px-2"
                            onClick={() => removeLink(l.from, l.to, l.resource)}
                          >
                            УДАЛИТЬ
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-cyber-gray-light mt-2">Исходящих соединений нет.</div>
                )}

                {selectedKey ? (
                  <div className="mt-3 pt-2 border-t border-cyber-gray/50">
                    <div className="text-xs text-cyber-text-dim mb-2">Политика рынка (автоторговля)</div>
                    <div className="text-[10px] text-cyber-gray-light mb-2 italic">
                      💡 ИМП: Автоматически докупать ресурс с рынка если не хватает для производства<br/>
                      💡 ЭКС: Автоматически продавать излишки ресурса → конвертация в ⚡энергию<br/>
                      ⚠️ Автопродажа останавливается если энергия {'>'} 85% (чтобы не терять прибыль)
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
              <div className="text-xs text-cyber-text-dim">
                Месторождение: <span className="text-cyber-text">{RESOURCE_LABEL[deposit]}</span>
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
                      {Object.entries(selectedBuildCost)
                        .map(([res, amt]) => {
                          const r = res as ResourceType;
                          return `${formatNumber(amt)} ${r === 'energy' ? '⚡' : RESOURCE_LABEL[r]}`;
                        })
                        .join(', ')}
                    </span>
                  </div>
                ) : null}

                {!affordability.canAfford ? (
                  <div className="text-xs text-cyber-red">
                    Недостаточно ресурсов: {affordability.missing.map((m) => `${m.amount} ${RESOURCE_LABEL[m.res]}`).join(', ')}
                  </div>
                ) : null}

                {(() => {
                  const need = selectedBuild.id === 'miner_mk1'
                    ? 'ore'
                    : selectedBuild.id === 'ice_extractor_mk1'
                      ? 'ice'
                      : selectedBuild.id === 'carbon_harvester_mk1'
                        ? 'carbon'
                        : null;
                  if (!need) return null;
                  if (deposit === need) return null;
                  return (
                    <div className="text-xs text-cyber-red">
                      Нельзя поставить здесь: нужна клетка с месторождением {RESOURCE_LABEL[need]}.
                    </div>
                  );
                })()}

                <button
                  className="cyber-button text-xs py-2 px-3 w-full"
                  disabled={!affordability.canAfford || Boolean(selectedBuild && (selectedBuild.id === 'miner_mk1' || selectedBuild.id === 'ice_extractor_mk1' || selectedBuild.id === 'carbon_harvester_mk1') && deposit !== (selectedBuild.id === 'miner_mk1' ? 'ore' : selectedBuild.id === 'ice_extractor_mk1' ? 'ice' : 'carbon'))}
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
    </div>
  );
}
