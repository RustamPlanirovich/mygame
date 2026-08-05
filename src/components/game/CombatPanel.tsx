import { useMemo } from 'react';
import { useGameStore } from '../../features/gameStore';
import { formatNumber, D } from '../../core/math/format.ts';
import { ENEMY_LABEL } from '../../core/constants/labels';
import { computeCombatMultiplier } from '../../core/constants/progression';
import { ShieldAlert } from 'lucide-react';
import {
  computeNanoAttackDpsPerSecond,
  computeNanoBoostMultiplier,
  computeNanoRepairHpPerSecond,
} from '../../core/constants/nanoSwarm';
import {
  AEGIS_UPGRADE_DEFS,
  aegisUpgradeCost,
  computeAegisInterference,
  computeAegisInterferenceMultiplier,
  computeAegisSmartTargetingEnabled,
  computeAegisShieldBoostMultiplier,
  computeAegisTurretOverdriveMultiplier,
  computeAegisAutoRepairPerSecond,
} from '../../core/constants/aegis';
import { GameIcon, IconText } from '../ui/icons';

export function CombatPanel() {
  const combat = useGameStore((s) => s.combat);
  const buildings = useGameStore((s) => s.buildings);
  const energy = useGameStore((s) => s.resources.energy.amount);
  const steel = useGameStore((s) => s.resources.steel?.amount ?? D(0));
  const researchLevels = useGameStore((s) => s.research.levels);
  const qubits = useGameStore((s) => s.meta.qubits);
  const nanoSwarm = useGameStore((s) => s.nanoSwarm);
  const setNanoSwarmAllocation = useGameStore((s) => s.setNanoSwarmAllocation);
  const aegis = useGameStore((s) => s.aegis);
  const buyAegisUpgrade = useGameStore((s) => s.buyAegisUpgrade);
  const emergencyRepairBase = useGameStore((s) => s.emergencyRepairBase);
  const resources = useGameStore((s) => s.resources);

  // Emergency repair costs
  const REPAIR_COST_ENERGY = D(500);
  const REPAIR_COST_STEEL = D(50);
  const REPAIR_HP = D(50);

  const turretCount = useMemo(() => {
    return buildings.find((b) => b.id === 'turret_mk1')?.count ?? 0;
  }, [buildings]);

  const { basePct, secondsToNextWave, secondsToWaveEnd, waveActive, baseRegen, baseDamagePenalty, canRepair, needsRepair } = useMemo(() => {
    const now = Date.now();
    const basePctRaw = combat.baseMaxHp.gt(0) ? combat.baseHp.div(combat.baseMaxHp) : combat.baseHp;
    const basePct = Math.max(0, Math.min(1, Number(basePctRaw.toString())));

    const waveActive = combat.waveEndsAt > now;
    const secondsToWaveEnd = waveActive ? Math.ceil((combat.waveEndsAt - now) / 1000) : 0;

    const secondsToNextWave = combat.nextWaveAt > now ? Math.ceil((combat.nextWaveAt - now) / 1000) : 0;

    // Base regen info
    const baseRegen = combat.baseRegenPerSecond ?? D(0);
    
    // Production penalty from damage: 0-50% based on missing HP
    const baseDamagePenalty = Math.round((1 - basePct) * 50);
    
    // Can afford repair?
    const canRepair = energy.gte(REPAIR_COST_ENERGY) && steel.gte(REPAIR_COST_STEEL);
    const needsRepair = combat.baseHp.lt(combat.baseMaxHp);

    return { basePct, secondsToNextWave, secondsToWaveEnd, waveActive, baseRegen, baseDamagePenalty, canRepair, needsRepair };
  }, [combat.baseHp, combat.baseMaxHp, combat.nextWaveAt, combat.waveEndsAt, combat.enemies.length, combat.baseRegenPerSecond, energy, steel]);

  const status = combat.baseHp.lte(0)
    ? 'ОФФЛАЙН'
    : combat.enemies.length > 0
      ? 'АТАКА'
      : 'ТИШИНА';

  const firing = turretCount > 0 && combat.enemies.length > 0 && energy.gt(0) && combat.baseHp.gt(0);

  const defenseNeed = combat.defenseEnergyNeedPerSecond;
  const defenseUsed = combat.defenseEnergyUsedPerSecond;
  const defenseRatio = Math.max(0, Math.min(1, Number(combat.defenseFireRatio.toString())));
  const baseDmg = combat.baseDamageTakenPerSecond;

  const shieldPct = useMemo(() => {
    const raw = combat.shieldMaxHp.gt(0) ? combat.shieldHp.div(combat.shieldMaxHp) : combat.shieldHp;
    return Math.max(0, Math.min(1, Number(raw.toString())));
  }, [combat.shieldHp, combat.shieldMaxHp]);

  const shieldNeed = combat.shieldEnergyNeedPerSecond;
  const shieldUsed = combat.shieldEnergyUsedPerSecond;
  const shieldRegen = combat.shieldRegenPerSecond;
  const shieldAbsorb = combat.shieldAbsorbedPerSecond;

  const pressure = combat.enemyPressurePerSecond;
  const pressurePotential = combat.enemyPressurePotentialPerSecond;

  const combatMult = useMemo(() => {
    return computeCombatMultiplier(researchLevels, qubits);
  }, [researchLevels, qubits]);

  const nanoUi = useMemo(() => {
    const attackPct = Math.round((nanoSwarm.allocation.attack ?? 0) * 100);
    const repairPct = Math.round((nanoSwarm.allocation.repair ?? 0) * 100);
    const boostPct = Math.round((nanoSwarm.allocation.boost ?? 0) * 100);

    const total = Math.max(0, nanoSwarm.total);
    const attackBots = Math.round(total * (nanoSwarm.allocation.attack ?? 0));
    const repairBots = Math.round(total * (nanoSwarm.allocation.repair ?? 0));
    const boostBots = Math.round(total * (nanoSwarm.allocation.boost ?? 0));

    const attackDps = computeNanoAttackDpsPerSecond(total, nanoSwarm.allocation.attack ?? 0, combatMult);
    const repairPerSec = computeNanoRepairHpPerSecond(total, nanoSwarm.allocation.repair ?? 0, combatMult);
    const boostMult = computeNanoBoostMultiplier(nanoSwarm.allocation.boost ?? 0);

    return {
      total,
      attackPct,
      repairPct,
      boostPct,
      attackBots,
      repairBots,
      boostBots,
      attackDps,
      repairPerSec,
      boostMult,
    };
  }, [nanoSwarm.total, nanoSwarm.allocation.attack, nanoSwarm.allocation.repair, nanoSwarm.allocation.boost, combatMult]);

  const aegisUi = useMemo(() => {
    const waveActive = combat.waveEndsAt > Date.now();
    const enemyCount = combat.enemies.length;
    const raw = computeAegisInterference(enemyCount);
    const mult = computeAegisInterferenceMultiplier(enemyCount, aegis.levels.encryption ?? 0, waveActive);
    const effective = waveActive ? 1 - mult : 0;
    const targeting = computeAegisSmartTargetingEnabled(aegis.levels);

    const smartLevel = aegis.levels.smart_targeting ?? 0;
    const encLevel = aegis.levels.encryption ?? 0;
    const shieldBoostLevel = aegis.levels.shield_boost ?? 0;
    const turretOverdriveLevel = aegis.levels.turret_overdrive ?? 0;
    const autoRepairLevel = aegis.levels.auto_repair ?? 0;

    const smartCost = aegisUpgradeCost('smart_targeting', smartLevel);
    const encCost = aegisUpgradeCost('encryption', encLevel);
    const shieldBoostCost = aegisUpgradeCost('shield_boost', shieldBoostLevel);
    const turretOverdriveCost = aegisUpgradeCost('turret_overdrive', turretOverdriveLevel);
    const autoRepairCost = aegisUpgradeCost('auto_repair', autoRepairLevel);

    const canBuy = (cost: any) => Object.entries(cost).every(([res, amt]) => resources[res as keyof typeof resources].amount.gte(amt as any));

    // Calculate current bonuses
    const shieldBoostMult = computeAegisShieldBoostMultiplier(shieldBoostLevel);
    const turretOverdriveMult = computeAegisTurretOverdriveMultiplier(turretOverdriveLevel);
    const autoRepairPerSec = computeAegisAutoRepairPerSecond(autoRepairLevel);

    return {
      waveActive,
      rawPct: Math.round(raw * 100),
      effectivePct: Math.round(effective * 100),
      targeting,
      smart: {
        level: smartLevel,
        def: AEGIS_UPGRADE_DEFS.smart_targeting,
        atMax: smartLevel >= AEGIS_UPGRADE_DEFS.smart_targeting.maxLevel,
        cost: smartCost,
        canBuy: canBuy(smartCost),
      },
      encryption: {
        level: encLevel,
        def: AEGIS_UPGRADE_DEFS.encryption,
        atMax: encLevel >= AEGIS_UPGRADE_DEFS.encryption.maxLevel,
        cost: encCost,
        canBuy: canBuy(encCost),
      },
      shieldBoost: {
        level: shieldBoostLevel,
        def: AEGIS_UPGRADE_DEFS.shield_boost,
        atMax: shieldBoostLevel >= AEGIS_UPGRADE_DEFS.shield_boost.maxLevel,
        cost: shieldBoostCost,
        canBuy: canBuy(shieldBoostCost),
        bonus: Math.round((shieldBoostMult - 1) * 100),
      },
      turretOverdrive: {
        level: turretOverdriveLevel,
        def: AEGIS_UPGRADE_DEFS.turret_overdrive,
        atMax: turretOverdriveLevel >= AEGIS_UPGRADE_DEFS.turret_overdrive.maxLevel,
        cost: turretOverdriveCost,
        canBuy: canBuy(turretOverdriveCost),
        bonus: Math.round((turretOverdriveMult - 1) * 100),
      },
      autoRepair: {
        level: autoRepairLevel,
        def: AEGIS_UPGRADE_DEFS.auto_repair,
        atMax: autoRepairLevel >= AEGIS_UPGRADE_DEFS.auto_repair.maxLevel,
        cost: autoRepairCost,
        canBuy: canBuy(autoRepairCost),
        bonus: autoRepairPerSec,
      },
    };
  }, [combat.waveEndsAt, combat.enemies.length, aegis.levels, resources]);

  return (
    <div className="p-3 border-b border-cyber-gray">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg text-cyber-green uppercase tracking-wide flex items-center gap-1.5">
          <ShieldAlert size={16} className="text-cyber-green" />
          <span>Угроза</span>
        </h2>
        <div className="text-[10px] text-cyber-text-dim">
          <span className="text-cyber-text font-semibold">{status}</span>
          {waveActive ? (
            <span className="text-cyber-text-dim"> · {secondsToWaveEnd}с</span>
          ) : (
            <span className="text-cyber-text-dim"> · {secondsToNextWave}с</span>
          )}
        </div>
      </div>

      <div className="cyber-panel p-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className={`text-sm font-semibold ${basePct < 0.25 ? 'text-cyber-red' : basePct < 0.5 ? 'text-yellow-400' : 'text-cyber-blue'}`}>
              База {basePct < 0.25 ? '⚠️' : ''}
            </div>
            <div className="text-[10px] text-cyber-text-dim">
              {formatNumber(combat.baseHp)} / {formatNumber(combat.baseMaxHp)}
            </div>
          </div>
          <div className="text-[10px] text-cyber-text-dim text-right">
            <div>Враги: <span className="text-cyber-text">{combat.enemies.length}</span></div>
            <div>Турели: <span className="text-cyber-text">{turretCount}</span> · {firing ? '🔥' : '⏸️'}</div>
          </div>
        </div>

        {/* Warning and penalties when base is damaged */}
        {baseDamagePenalty > 0 && (
          <div className="mt-1.5 text-[10px] bg-cyber-red/20 border border-cyber-red/40 rounded px-2 py-1">
            <div className="text-cyber-red font-semibold">
              <GameIcon icon="⚠️" /> База повреждена — производство -{baseDamagePenalty}%
            </div>
            {baseRegen.gt(0) && (
              <div className="text-cyber-text-dim mt-0.5">
                <GameIcon icon="🔧" /> Регенерация: +{formatNumber(baseRegen)} HP/с
              </div>
            )}
            {!baseRegen.gt(0) && combat.enemies.length > 0 && (
              <div className="text-cyber-text-dim mt-0.5">
                <GameIcon icon="⏳" /> Регенерация начнётся после окончания атаки
              </div>
            )}
          </div>
        )}

        {/* Emergency repair button */}
        {needsRepair && (
          <div className="mt-2">
            <button
              className={`w-full cyber-button text-[10px] py-1.5 px-2 ${
                canRepair ? 'bg-cyber-green/20 border-cyber-green hover:bg-cyber-green/30' : 'opacity-50 cursor-not-allowed'
              }`}
              disabled={!canRepair}
              onClick={() => emergencyRepairBase()}
              title={`Восстанавливает +${formatNumber(REPAIR_HP)} HP базы. Стоимость: ${formatNumber(REPAIR_COST_ENERGY)}⚡ + ${formatNumber(REPAIR_COST_STEEL)} стали`}
            >
              <GameIcon icon="🔧" /> Экстренный ремонт (+{formatNumber(REPAIR_HP)} HP) — {formatNumber(REPAIR_COST_ENERGY)}<GameIcon icon="⚡" /> + {formatNumber(REPAIR_COST_STEEL)} <GameIcon icon="🔩" />
            </button>
          </div>
        )}

        <div className="mt-1.5 text-[10px] text-cyber-text-dim flex flex-wrap gap-x-2 gap-y-0.5">
          {defenseNeed.gt(0) ? (
            <div>
              Оборона: <span className={defenseRatio < 0.5 ? 'text-cyber-red' : defenseRatio < 0.99 ? 'text-cyber-blue' : 'text-cyber-text'}>
                {formatNumber(defenseUsed)}<GameIcon icon="⚡" />
              </span>
              <span className="text-cyber-gray-light">/{formatNumber(defenseNeed)}</span>
              <span className="text-cyber-gray-light"> ({Math.round(defenseRatio * 100)}%)</span>
            </div>
          ) : (
            <div>Оборона: <span className="text-cyber-gray-light">—</span></div>
          )}

          {combat.enemies.length > 0 ? (
            <div>
              Давление: <span className="text-cyber-text">{formatNumber(pressure)}/с</span>
              {/* Потенциал — суммарный DPS всех живых врагов, т.е. сколько станет,
                  когда они все дойдут до базы. Считался и сохранялся, но не показывался. */}
              {pressurePotential.gt(pressure) ? (
                <span className="text-cyber-gray-light"> (потенциал {formatNumber(pressurePotential)}/с)</span>
              ) : null}
            </div>
          ) : null}

          {baseDmg.gt(0) ? (
            <div>
              Урон: <span className="text-cyber-red">-{formatNumber(baseDmg)}/с</span>
            </div>
          ) : null}
        </div>

        <div className="mt-3 h-2 bg-cyber-gray/40 rounded overflow-hidden">
          <div
            className={`h-full ${basePct < 0.25 ? 'bg-cyber-red animate-pulse' : basePct < 0.5 ? 'bg-yellow-400' : 'bg-cyber-green'}`}
            style={{ width: `${Math.round(basePct * 100)}%` }}
          />
        </div>

        {combat.shieldMaxHp.gt(0) ? (
          <div className="mt-2">
            <div className="flex items-center justify-between text-[10px] text-cyber-text-dim">
              <div>
                Щит: <span className="text-cyber-text">{formatNumber(combat.shieldHp)}</span>
                <span className="text-cyber-gray-light">/{formatNumber(combat.shieldMaxHp)}</span>
              </div>
              {shieldNeed.gt(0) ? (
                <div>
                  {formatNumber(shieldUsed)}<GameIcon icon="⚡" />
                  <span className="text-cyber-gray-light">/{formatNumber(shieldNeed)}<GameIcon icon="⚡" /></span>
                </div>
              ) : (
                <div className="text-cyber-gray-light">—</div>
              )}
            </div>
            <div className="mt-1 h-1.5 bg-cyber-gray/40 rounded overflow-hidden">
              <div
                className="h-full bg-cyber-blue"
                style={{ width: `${Math.round(shieldPct * 100)}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] text-cyber-gray-light flex gap-2">
              <div>Реген: <span className={shieldRegen.gt(0) ? 'text-cyber-text' : 'text-cyber-gray-light'}>+{formatNumber(shieldRegen)}</span></div>
              <div>Погл.: <span className={shieldAbsorb.gt(0) ? 'text-cyber-text' : 'text-cyber-gray-light'}>{formatNumber(shieldAbsorb)}</span></div>
            </div>
          </div>
        ) : null}

        <div className="mt-3 border-t border-cyber-gray/40 pt-2">
          <div className="flex items-center justify-between text-[10px] text-cyber-text-dim mb-1.5">
            <div className="text-cyber-text-dim"><GameIcon icon="🦠" /> Нано-Рой</div>
            <div className="text-cyber-gray-light">Пул: {nanoUi.total}</div>
          </div>

          <div className="mt-1.5 grid gap-1.5">
            <div>
              <div className="flex items-center justify-between text-[10px] text-cyber-text-dim">
                <div><GameIcon icon="🔴" /> Атака</div>
                <div className="text-cyber-gray-light">{nanoUi.attackPct}%</div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={nanoUi.attackPct}
                onChange={(e) => setNanoSwarmAllocation('attack', Number(e.target.value) / 100)}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-[10px] text-cyber-text-dim">
                <div><GameIcon icon="🟢" /> Ремонт</div>
                <div className="text-cyber-gray-light">{nanoUi.repairPct}%</div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={nanoUi.repairPct}
                onChange={(e) => setNanoSwarmAllocation('repair', Number(e.target.value) / 100)}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-[10px] text-cyber-text-dim">
                <div><GameIcon icon="🔵" /> Буст</div>
                <div className="text-cyber-gray-light">{nanoUi.boostPct}%</div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={nanoUi.boostPct}
                onChange={(e) => setNanoSwarmAllocation('boost', Number(e.target.value) / 100)}
                className="w-full"
              />
            </div>
          </div>

          <div className="mt-1.5 text-[10px] text-cyber-gray-light flex gap-2">
            <div>
              Урон: <span className={nanoUi.attackDps.gt(0) ? 'text-cyber-text' : 'text-cyber-gray-light'}>+{formatNumber(nanoUi.attackDps)}</span>
            </div>
            <div>
              Рем.: <span className={nanoUi.repairPerSec.gt(0) ? 'text-cyber-text' : 'text-cyber-gray-light'}>+{formatNumber(nanoUi.repairPerSec)}</span>
            </div>
            <div>
              Буст: <span className={nanoUi.boostMult > 1.001 ? 'text-cyber-text' : 'text-cyber-gray-light'}>x{nanoUi.boostMult.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 border-t border-cyber-gray/40 pt-2">
          <div className="flex items-center justify-between text-[10px] text-cyber-text-dim mb-1.5">
            <div className="text-cyber-text-dim"><GameIcon icon="🛡️" /> Эгида</div>
            <div className="text-cyber-gray-light">
              Интерф.: {aegisUi.waveActive ? (
                <>
                  -{aegisUi.rawPct}% <GameIcon icon="→" /> -{aegisUi.effectivePct}%
                </>
              ) : (
                '—'
              )}
            </div>
          </div>

          <div className="mt-1.5 grid gap-1.5">
            <div className="cyber-panel p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-cyber-blue font-semibold truncate">{aegisUi.smart.def.name}</div>
                  <div className="text-[9px] text-cyber-text-dim mt-0.5">
                    Ур.: {aegisUi.smart.level}/{aegisUi.smart.def.maxLevel}
                    <span className="text-cyber-gray-light"> · {aegisUi.targeting ? '✓' : '×'}</span>
                  </div>
                </div>
                <button
                  className="cyber-button text-[10px] py-1 px-2 shrink-0"
                  disabled={aegisUi.smart.atMax || !aegisUi.smart.canBuy}
                  onClick={() => buyAegisUpgrade('smart_targeting')}
                >
                  <IconText>{aegisUi.smart.atMax ? 'МАКС' : '↑'}</IconText>
                </button>
              </div>
            </div>

            <div className="cyber-panel p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-cyber-blue font-semibold truncate">{aegisUi.encryption.def.name}</div>
                  <div className="text-[9px] text-cyber-text-dim mt-0.5">
                    Ур.: {aegisUi.encryption.level}/{aegisUi.encryption.def.maxLevel}
                  </div>
                </div>
                <button
                  className="cyber-button text-[10px] py-1 px-2 shrink-0"
                  disabled={aegisUi.encryption.atMax || !aegisUi.encryption.canBuy}
                  onClick={() => buyAegisUpgrade('encryption')}
                >
                  <IconText>{aegisUi.encryption.atMax ? 'МАКС' : '↑'}</IconText>
                </button>
              </div>
            </div>

            <div className="cyber-panel p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-cyber-blue font-semibold truncate">{aegisUi.shieldBoost.def.name}</div>
                  <div className="text-[9px] text-cyber-text-dim mt-0.5">
                    Ур.: {aegisUi.shieldBoost.level}/{aegisUi.shieldBoost.def.maxLevel}
                    {aegisUi.shieldBoost.bonus > 0 && (
                      <span className="text-cyber-green"> · +{aegisUi.shieldBoost.bonus}% реген</span>
                    )}
                  </div>
                </div>
                <button
                  className="cyber-button text-[10px] py-1 px-2 shrink-0"
                  disabled={aegisUi.shieldBoost.atMax || !aegisUi.shieldBoost.canBuy}
                  onClick={() => buyAegisUpgrade('shield_boost')}
                >
                  <IconText>{aegisUi.shieldBoost.atMax ? 'МАКС' : '↑'}</IconText>
                </button>
              </div>
            </div>

            <div className="cyber-panel p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-cyber-blue font-semibold truncate">{aegisUi.turretOverdrive.def.name}</div>
                  <div className="text-[9px] text-cyber-text-dim mt-0.5">
                    Ур.: {aegisUi.turretOverdrive.level}/{aegisUi.turretOverdrive.def.maxLevel}
                    {aegisUi.turretOverdrive.bonus > 0 && (
                      <span className="text-cyber-green"> · +{aegisUi.turretOverdrive.bonus}% урон</span>
                    )}
                  </div>
                </div>
                <button
                  className="cyber-button text-[10px] py-1 px-2 shrink-0"
                  disabled={aegisUi.turretOverdrive.atMax || !aegisUi.turretOverdrive.canBuy}
                  onClick={() => buyAegisUpgrade('turret_overdrive')}
                >
                  <IconText>{aegisUi.turretOverdrive.atMax ? 'МАКС' : '↑'}</IconText>
                </button>
              </div>
            </div>

            <div className="cyber-panel p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-cyber-blue font-semibold truncate">{aegisUi.autoRepair.def.name}</div>
                  <div className="text-[9px] text-cyber-text-dim mt-0.5">
                    Ур.: {aegisUi.autoRepair.level}/{aegisUi.autoRepair.def.maxLevel}
                    {aegisUi.autoRepair.bonus > 0 && (
                      <span className="text-cyber-green"> · +{aegisUi.autoRepair.bonus.toFixed(1)} HP/с</span>
                    )}
                  </div>
                </div>
                <button
                  className="cyber-button text-[10px] py-1 px-2 shrink-0"
                  disabled={aegisUi.autoRepair.atMax || !aegisUi.autoRepair.canBuy}
                  onClick={() => buyAegisUpgrade('auto_repair')}
                >
                  <IconText>{aegisUi.autoRepair.atMax ? 'МАКС' : '↑'}</IconText>
                </button>
              </div>
            </div>
          </div>
        </div>

        {combat.enemies.length > 0 ? (
          <div className="mt-3 space-y-1.5">
            {combat.enemies.slice(0, 5).map((e) => {
              const pctRaw = e.maxHp.gt(0) ? e.hp.div(e.maxHp) : e.hp;
              const pct = Math.max(0, Math.min(1, Number(pctRaw.toString())));
              const distPct = Math.max(0, Math.min(100, Math.round(e.distance * 100)));

              const label = ENEMY_LABEL[e.type];
              const roleHint =
                e.type === 'brute'
                  ? '🛡️'
                  : e.type === 'swarmer'
                    ? '⚡'
                    : e.type === 'scout'
                      ? '🔍'
                      : null;

              return (
                <div key={e.id} className="text-[10px]">
                  <div className="flex items-center justify-between text-cyber-text-dim">
                    <div className="text-cyber-text-dim">
                      {label} {roleHint}
                    </div>
                    <div className="text-cyber-text-dim"><GameIcon icon="🎯" /> {distPct}%</div>
                  </div>
                  <div className="mt-0.5 h-1.5 bg-cyber-gray/40 rounded overflow-hidden">
                    <div
                      className={pct < 0.25 ? 'h-full bg-cyber-blue animate-pulse' : 'h-full bg-cyber-blue'}
                      style={{ width: `${Math.round(pct * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {combat.enemies.length > 5 ? (
              <div className="text-[10px] text-cyber-text-dim">+ещё {combat.enemies.length - 5}</div>
            ) : null}
          </div>
        ) : (
          <div className="text-[10px] text-cyber-text-dim mt-2">
            Угроз не обнаружено.
          </div>
        )}

        <div className="text-[10px] text-cyber-text-dim mt-2">
          <GameIcon icon="💡" /> При нехватке <GameIcon icon="⚡" /> эффективность турелей падает.
        </div>
      </div>
    </div>
  );
}
