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
} from '../../core/constants/aegis';

export function CombatPanel() {
  const combat = useGameStore((s) => s.combat);
  const buildings = useGameStore((s) => s.buildings);
  const energy = useGameStore((s) => s.resources.energy.amount);
  const researchLevels = useGameStore((s) => s.research.levels);
  const qubits = useGameStore((s) => s.meta.qubits);
  const nanoSwarm = useGameStore((s) => s.nanoSwarm);
  const setNanoSwarmAllocation = useGameStore((s) => s.setNanoSwarmAllocation);
  const aegis = useGameStore((s) => s.aegis);
  const buyAegisUpgrade = useGameStore((s) => s.buyAegisUpgrade);
  const resources = useGameStore((s) => s.resources);

  const turretCount = useMemo(() => {
    return buildings.find((b) => b.id === 'turret_mk1')?.count ?? 0;
  }, [buildings]);

  const { basePct, secondsToNextWave, secondsToWaveEnd, waveActive } = useMemo(() => {
    const now = Date.now();
    const basePctRaw = combat.baseMaxHp.gt(0) ? combat.baseHp.div(combat.baseMaxHp) : combat.baseHp;
    const basePct = Math.max(0, Math.min(1, Number(basePctRaw.toString())));

    const waveActive = combat.waveEndsAt > now;
    const secondsToWaveEnd = waveActive ? Math.ceil((combat.waveEndsAt - now) / 1000) : 0;

    const secondsToNextWave = combat.nextWaveAt > now ? Math.ceil((combat.nextWaveAt - now) / 1000) : 0;

    return { basePct, secondsToNextWave, secondsToWaveEnd, waveActive };
  }, [combat.baseHp, combat.baseMaxHp, combat.nextWaveAt, combat.waveEndsAt, combat.enemies.length]);

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

    const smartCost = aegisUpgradeCost('smart_targeting', smartLevel);
    const encCost = aegisUpgradeCost('encryption', encLevel);

    const canBuy = (cost: any) => Object.entries(cost).every(([res, amt]) => resources[res as keyof typeof resources].amount.gte(amt as any));

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
    };
  }, [combat.waveEndsAt, combat.enemies.length, aegis.levels.encryption, aegis.levels.smart_targeting, resources]);

  return (
    <div className="p-4 border-b border-cyber-gray">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xl text-cyber-green uppercase tracking-wider flex items-center gap-2">
          <ShieldAlert size={18} className="text-cyber-green" />
          <span>Угроза</span>
        </h2>
        <div className="text-xs text-cyber-text-dim">
          Статус: <span className="text-cyber-text">{status}</span>
          {waveActive ? (
            <span className="text-cyber-text-dim"> · Волна закончится через: {secondsToWaveEnd}с</span>
          ) : (
            <span className="text-cyber-text-dim"> · Следующая волна через: {secondsToNextWave}с</span>
          )}
        </div>
      </div>

      <div className="cyber-panel">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-cyber-blue font-bold">Целостность базы</div>
            <div className="text-xs text-cyber-text-dim">
              {formatNumber(combat.baseHp)} / {formatNumber(combat.baseMaxHp)}
            </div>
          </div>
          <div className="text-xs text-cyber-text-dim">
            Враги: <span className="text-cyber-text">{combat.enemies.length}</span>
            <span className="text-cyber-text-dim"> · Турели: {turretCount}</span>
            <span className="text-cyber-text-dim"> · {firing ? 'Стрельба' : 'Ожидание'}</span>
          </div>
        </div>

        <div className="mt-2 text-xs text-cyber-text-dim flex flex-wrap gap-x-3 gap-y-1">
          {defenseNeed.gt(0) ? (
            <div>
              Оборона: <span className={defenseRatio < 0.5 ? 'text-cyber-red' : defenseRatio < 0.99 ? 'text-cyber-blue' : 'text-cyber-text'}>
                {formatNumber(defenseUsed)}⚡/с
              </span>
              <span className="text-cyber-gray-light"> из {formatNumber(defenseNeed)}⚡/с</span>
              <span className="text-cyber-gray-light"> · Эффективность: {Math.round(defenseRatio * 100)}%</span>
            </div>
          ) : (
            <div>Оборона: <span className="text-cyber-gray-light">—</span></div>
          )}

          {combat.enemies.length > 0 ? (
            <div>
              Давление: <span className="text-cyber-text">{formatNumber(pressure)}/с</span>
              <span className="text-cyber-gray-light"> (макс {formatNumber(pressurePotential)}/с)</span>
            </div>
          ) : null}

          {baseDmg.gt(0) ? (
            <div>
              Урон базе: <span className="text-cyber-blue">-{formatNumber(baseDmg)}/с</span>
            </div>
          ) : null}
        </div>

        <div className="mt-3 h-2 bg-cyber-gray/40 rounded overflow-hidden">
          <div
            className="h-full bg-cyber-green"
            style={{ width: `${Math.round(basePct * 100)}%` }}
          />
        </div>

        {combat.shieldMaxHp.gt(0) ? (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-cyber-text-dim">
              <div>
                Щит: <span className="text-cyber-text">{formatNumber(combat.shieldHp)}</span>
                <span className="text-cyber-gray-light"> / {formatNumber(combat.shieldMaxHp)}</span>
              </div>
              {shieldNeed.gt(0) ? (
                <div>
                  {formatNumber(shieldUsed)}⚡/с
                  <span className="text-cyber-gray-light"> из {formatNumber(shieldNeed)}⚡/с</span>
                </div>
              ) : (
                <div className="text-cyber-gray-light">—</div>
              )}
            </div>
            <div className="mt-1 h-2 bg-cyber-gray/40 rounded overflow-hidden">
              <div
                className="h-full bg-cyber-blue"
                style={{ width: `${Math.round(shieldPct * 100)}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-cyber-gray-light flex flex-wrap gap-x-3 gap-y-1">
              <div>Реген: <span className={shieldRegen.gt(0) ? 'text-cyber-text' : 'text-cyber-gray-light'}>+{formatNumber(shieldRegen)}/с</span></div>
              <div>Поглощение: <span className={shieldAbsorb.gt(0) ? 'text-cyber-text' : 'text-cyber-gray-light'}>{formatNumber(shieldAbsorb)}/с</span></div>
            </div>
          </div>
        ) : null}

        <div className="mt-4 border-t border-cyber-gray/40 pt-3">
          <div className="flex items-center justify-between text-xs text-cyber-text-dim">
            <div className="text-cyber-text-dim">Нано-Рой</div>
            <div className="text-cyber-gray-light">Пул: {nanoUi.total}</div>
          </div>

          <div className="mt-2 grid gap-2">
            <div>
              <div className="flex items-center justify-between text-xs text-cyber-text-dim">
                <div>🔴 Атака</div>
                <div className="text-cyber-gray-light">{nanoUi.attackPct}% · {nanoUi.attackBots}</div>
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
              <div className="flex items-center justify-between text-xs text-cyber-text-dim">
                <div>🟢 Ремонт</div>
                <div className="text-cyber-gray-light">{nanoUi.repairPct}% · {nanoUi.repairBots}</div>
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
              <div className="flex items-center justify-between text-xs text-cyber-text-dim">
                <div>🔵 Буст</div>
                <div className="text-cyber-gray-light">{nanoUi.boostPct}% · {nanoUi.boostBots}</div>
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

          <div className="mt-2 text-xs text-cyber-gray-light flex flex-wrap gap-x-3 gap-y-1">
            <div>
              Урон: <span className={nanoUi.attackDps.gt(0) ? 'text-cyber-text' : 'text-cyber-gray-light'}>+{formatNumber(nanoUi.attackDps)}/с</span>
            </div>
            <div>
              Ремонт щита: <span className={nanoUi.repairPerSec.gt(0) ? 'text-cyber-text' : 'text-cyber-gray-light'}>+{formatNumber(nanoUi.repairPerSec)}/с</span>
            </div>
            <div>
              Буст: <span className={nanoUi.boostMult > 1.001 ? 'text-cyber-text' : 'text-cyber-gray-light'}>x{nanoUi.boostMult.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-cyber-gray/40 pt-3">
          <div className="flex items-center justify-between text-xs text-cyber-text-dim">
            <div className="text-cyber-text-dim">Протокол «Эгида»</div>
            <div className="text-cyber-gray-light">
              Интерференция: {aegisUi.waveActive ? (
                <>
                  -{aegisUi.rawPct}% → -{aegisUi.effectivePct}%
                </>
              ) : (
                '—'
              )}
            </div>
          </div>

          <div className="mt-2 grid gap-2">
            <div className="cyber-panel">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-cyber-blue font-bold">{aegisUi.smart.def.name}</div>
                  <div className="text-xs text-cyber-text-dim">{aegisUi.smart.def.description}</div>
                  <div className="text-xs text-cyber-text-dim mt-1">
                    Уровень: <span className="text-cyber-text">{aegisUi.smart.level}</span>
                    <span className="text-cyber-gray-light"> / {aegisUi.smart.def.maxLevel}</span>
                    <span className="text-cyber-gray-light"> · Сейчас: {aegisUi.targeting ? 'ВКЛ' : 'ВЫКЛ'}</span>
                  </div>
                </div>
                <button
                  className="cyber-button text-xs py-2 px-3"
                  disabled={aegisUi.smart.atMax || !aegisUi.smart.canBuy}
                  onClick={() => buyAegisUpgrade('smart_targeting')}
                >
                  <div className="text-center">{aegisUi.smart.atMax ? 'МАКС' : 'УЛУЧШИТЬ'}</div>
                  <div className="text-[10px] mt-1 text-cyber-text-dim">
                    {aegisUi.smart.atMax ? '—' : `${formatNumber(aegisUi.smart.cost.energy ?? D(0))}⚡, ${formatNumber(aegisUi.smart.cost.steel ?? D(0))} сталь`}
                  </div>
                </button>
              </div>
            </div>

            <div className="cyber-panel">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-cyber-blue font-bold">{aegisUi.encryption.def.name}</div>
                  <div className="text-xs text-cyber-text-dim">{aegisUi.encryption.def.description}</div>
                  <div className="text-xs text-cyber-text-dim mt-1">
                    Уровень: <span className="text-cyber-text">{aegisUi.encryption.level}</span>
                    <span className="text-cyber-gray-light"> / {aegisUi.encryption.def.maxLevel}</span>
                  </div>
                </div>
                <button
                  className="cyber-button text-xs py-2 px-3"
                  disabled={aegisUi.encryption.atMax || !aegisUi.encryption.canBuy}
                  onClick={() => buyAegisUpgrade('encryption')}
                >
                  <div className="text-center">{aegisUi.encryption.atMax ? 'МАКС' : 'УЛУЧШИТЬ'}</div>
                  <div className="text-[10px] mt-1 text-cyber-text-dim">
                    {aegisUi.encryption.atMax ? '—' : `${formatNumber(aegisUi.encryption.cost.energy ?? D(0))}⚡, ${formatNumber(aegisUi.encryption.cost.steel ?? D(0))} сталь`}
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {combat.enemies.length > 0 ? (
          <div className="mt-4 space-y-2">
            {combat.enemies.slice(0, 6).map((e) => {
              const pctRaw = e.maxHp.gt(0) ? e.hp.div(e.maxHp) : e.hp;
              const pct = Math.max(0, Math.min(1, Number(pctRaw.toString())));
              const distPct = Math.max(0, Math.min(100, Math.round(e.distance * 100)));

              const label = ENEMY_LABEL[e.type];
              const roleHint =
                e.type === 'brute'
                  ? 'Пробой щита (30%)'
                  : e.type === 'swarmer'
                    ? 'Ранний контакт'
                    : e.type === 'scout'
                      ? 'Скаут'
                      : null;

              return (
                <div key={e.id} className="text-xs">
                  <div className="flex items-center justify-between text-cyber-text-dim">
                    <div className="text-cyber-text-dim">
                      {label}
                      {roleHint ? <span className="text-cyber-gray-light"> · {roleHint}</span> : null}
                    </div>
                    <div className="text-cyber-text-dim">Дистанция: {distPct}%</div>
                  </div>
                  <div className="mt-1 h-2 bg-cyber-gray/40 rounded overflow-hidden">
                    <div
                      className={pct < 0.25 ? 'h-full bg-cyber-blue animate-pulse' : 'h-full bg-cyber-blue'}
                      style={{ width: `${Math.round(pct * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {combat.enemies.length > 6 ? (
              <div className="text-xs text-cyber-text-dim">+ещё {combat.enemies.length - 6}</div>
            ) : null}
          </div>
        ) : (
          <div className="text-xs text-cyber-text-dim mt-3">
            Угроз не обнаружено.
          </div>
        )}

        <div className="text-xs text-cyber-text-dim mt-3">
          Если ⚡ не хватает, эффективность турелей падает.
        </div>

        <div className="text-xs text-cyber-gray-light mt-1">
          Пробой щита (у «Тяжёлого»): часть контактного урона проходит сразу в базу.
        </div>
      </div>
    </div>
  );
}
