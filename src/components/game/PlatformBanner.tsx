/**
 * ПЛАШКА АКТИВНОЙ ПЛАТФОРМЫ (bigplan.md, пункт 46).
 *
 * Запрос игрока: на плашке должно быть видно, ЧЕРЕЗ СКОЛЬКО платформа развалится, если её не
 * защищать. Раньше здесь были только название и кнопка «На базу»: платформа молча теряла
 * корпус, а узнать об этом можно было, лишь открыв панель платформ — и то без сроков.
 *
 * Считает не эта плашка, а `core/systems/platformDefense.ts` — тот же модуль, которым тик
 * ведёт бой. Иначе повторилась бы старая история: два мнения о том, кто платформу защищает
 * (боевой блок брал турели из глобального счётчика каталога, а панель — из поля, которое
 * никто не заполнял).
 *
 * Вынесено из FactoryGrid отдельным компонентом сознательно: платформа пересобирается каждым
 * тиком, и подписка на неё внутри FactoryGrid перерисовывала бы всю сцену 20 раз в секунду.
 */

import { useMemo } from 'react';
import { useGameStore } from '../../features/gameStore';
import { D, formatNumber, formatTime } from '../../core/math/format';
import {
  computePlatformDefense,
  computePlatformThreat,
  platformDefenseDps,
  type PlatformThreat,
} from '../../core/systems/platformDefense';
import { GameIcon } from '../ui/icons';
import { Meter } from '../ui';

/** Что писать в строке состояния и каким цветом. */
function describe(
  threat: PlatformThreat,
  ctx: { turretCount: number; powered: boolean },
): {
  text: string;
  tone: 'danger' | 'warning' | 'accent' | 'dim';
  hint?: string;
} {
  const inTime = (seconds: number | null) => (seconds === null ? '—' : formatTime(seconds));
  // Турели построены, но обесточены — это другая беда и другое лекарство, чем «турелей нет».
  const starved = ctx.turretCount > 0 && !ctx.powered;

  switch (threat.level) {
    case 'destroyed':
      return { text: 'Платформа уничтожена', tone: 'danger' };

    case 'undefended':
      return {
        text: starved
          ? `Турели без энергии · разрушение через ${inTime(threat.secondsToDestruction)}`
          : `Без обороны · разрушение через ${inTime(threat.secondsToDestruction)}`,
        tone: 'danger',
        hint: starved
          ? 'Обесточенная турель не стреляет. Нужна электростанция на самой платформе.'
          : 'Врагов сбивать нечем. Постройте «Защитную Турель» или пришлите флот.',
      };

    case 'losing':
      return {
        text: `Оборона не справляется · разрушение через ${inTime(threat.secondsToDestruction)}`,
        tone: 'danger',
        hint: 'Волна убивает платформу быстрее, чем оборона убивает волну.',
      };

    case 'holding':
      return {
        text: `Оборона держит · волна отбита через ${inTime(threat.secondsToClear)}`,
        tone: 'accent',
      };

    default: {
      // Тишина. Это единственный момент, когда игрок ещё успевает что-то построить, —
      // поэтому про беззащитность говорим здесь, а не когда уже поздно.
      const wave =
        threat.secondsToNextWave > 0 ? ` · волна через ${formatTime(threat.secondsToNextWave)}` : '';

      if (ctx.turretCount === 0) {
        return {
          text: `Обороны нет${wave}`,
          tone: 'warning',
          hint: 'Первая же волна пойдёт прямо по корпусу.',
        };
      }
      if (starved) {
        return {
          text: `Турели без энергии${wave}`,
          tone: 'warning',
          hint: 'К началу волны платформе нужна своя электростанция.',
        };
      }
      return { text: `Тихо${wave}`, tone: 'dim' };
    }
  }
}

const TONE_TEXT = {
  danger: 'text-danger',
  warning: 'text-warning',
  accent: 'text-accent',
  dim: 'text-cyber-text-dim',
} as const;

const TONE_BORDER = {
  danger: 'border-danger/70',
  warning: 'border-warning/60',
  accent: 'border-accent/50',
  dim: 'border-info/30',
} as const;

export function PlatformBanner() {
  const platform = useGameStore((s) =>
    s.galaxies.activePlatformId
      ? s.galaxies.platforms.find((p) => p.id === s.galaxies.activePlatformId) ?? null
      : null,
  );
  const buildings = useGameStore((s) => s.buildings);
  const ships = useGameStore((s) => s.fleet.ships);
  const setActivePlatform = useGameStore((s) => s.setActivePlatform);

  const buildingsById = useMemo(() => new Map(buildings.map((b) => [b.id, b])), [buildings]);

  const view = useMemo(() => {
    if (!platform) return null;

    const defense = computePlatformDefense({
      tiles: platform.grid.tiles,
      tileJobs: platform.grid.tileJobs,
      tileDisabled: platform.grid.tileDisabled,
      buildingsById,
    });

    // Приписанный флот считаем ровно так же, как боевой блок тика: корабли в ремонте не бьют.
    const shipDps = ships
      .filter((s) => s.assignedTo === platform.id && s.status !== 'repairing')
      .reduce((sum, s) => sum.add(s.dps), D(0));

    /*
     * Обесточенные турели не стреляют (см. platformDefenseDps), поэтому и срок до разрушения
     * должен считаться по ним же — иначе плашка обещала бы оборону, которой нет.
     * `status` считает тик и в сейв не пишет: до первого шага считаем, что энергия есть.
     */
    const threat = computePlatformThreat({
      hp: platform.hp,
      maxHp: platform.maxHp,
      armor: platform.armor,
      shieldHp: platform.shieldHp,
      enemies: platform.combat.enemies,
      defenseDps: platformDefenseDps(defense, platform.status?.energyEfficiency ?? 1, shipDps),
      nextWaveAt: platform.combat.nextWaveAt,
      now: Date.now(),
    });

    return {
      defense,
      threat,
      status: describe(threat, {
        turretCount: defense.turretCount,
        powered: (platform.status?.energyEfficiency ?? 1) > 0,
      }),
    };
  }, [platform, buildingsById, ships]);

  if (!platform || !view) return null;

  const { defense, threat, status } = view;
  const hullPct = Math.round(threat.hullRatio * 100);

  return (
    <div className="absolute top-4 left-1/2 z-10 w-[min(26rem,calc(100vw-1.5rem))] -translate-x-1/2">
      <div className={`glass rounded-md border ${TONE_BORDER[status.tone]} shadow-elev-3`}>
        {/* Кто это и как вернуться на базу — то, ради чего плашка появилась изначально */}
        <div className="flex items-center gap-3 px-4 py-2">
          <span className="text-2xl"><GameIcon icon="🛰️" /></span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-white">{platform.name}</div>
            <div className="text-xs text-cyan-300">Управление платформой</div>
          </div>
          <button
            onClick={() => setActivePlatform(null)}
            className="shrink-0 rounded bg-cyan-600 px-3 py-1 text-xs text-white transition-all hover:bg-cyan-700"
          >
            <GameIcon icon="←" /> На базу
          </button>
        </div>

        {/* Корпус и срок: главное, чего плашке не хватало */}
        <div className="border-t border-cyber-gray/30 px-4 py-1.5">
          <div className="flex items-baseline justify-between gap-2 text-[10px] text-cyber-text-dim">
            <span>Корпус</span>
            <span className="font-mono tabular-nums">
              {formatNumber(platform.hp)} / {formatNumber(platform.maxHp)}
            </span>
          </div>
          <Meter
            value={hullPct}
            max={100}
            tone={hullPct < 40 ? 'danger' : hullPct < 75 ? 'warning' : 'accent'}
          />
          <div className={`mt-1 text-[11px] font-semibold leading-snug ${TONE_TEXT[status.tone]}`}>
            {status.text}
          </div>
          {status.hint && (
            <div className="text-[10px] leading-snug text-cyber-text-dim">{status.hint}</div>
          )}
        </div>

        {/* Из чего сложился срок: сколько стволов бьёт и сколько врагов бьёт по платформе */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-cyber-gray/30 px-4 py-1 text-[10px] text-cyber-text-dim">
          <span>
            Турели: <span className="font-mono tabular-nums text-cyber-text">{defense.turretCount}</span>
          </span>
          <span>
            Урон обороны:{' '}
            <span className="font-mono tabular-nums text-cyber-text">{formatNumber(threat.defenseDps)}</span>/с
          </span>
          {threat.enemies > 0 && (
            <span>
              Врагов: <span className="font-mono tabular-nums text-danger">{threat.enemies}</span> ·{' '}
              <span className="font-mono tabular-nums text-danger">{formatNumber(threat.incomingDps)}</span>/с по платформе
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
