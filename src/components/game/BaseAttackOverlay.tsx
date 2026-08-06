/**
 * ПЛАШКА ТРЕВОГИ: НА БАЗУ НАПАЛИ (bigplan 39).
 *
 * Запрос игрока: во время атаки должно быть видно, что турели и щиты работают, а если их нет —
 * что база страдает. Первую половину закрывает подсветка клеток в FactoryGrid, вторую — эта
 * плашка: она отвечает на «что вообще происходит» с любого места карты и, главное, на «что
 * с этим делать» — кнопкой в нужный раздел.
 *
 * Плашка появляется только на время волны, поэтому в обычной игре места не занимает и закрывать
 * её не нужно. Правила состояния берутся из core/systems/baseDefenseStatus.ts — того же модуля,
 * которым раскрашивается сетка, чтобы карта и плашка не спорили друг с другом.
 */

import { useMemo } from 'react';
import { AlertTriangle, Crosshair, ShieldAlert, ShieldCheck, Zap } from 'lucide-react';
import { useGameStore } from '../../features/gameStore';
import { useUiStore } from '../../features/uiStore';
import { getMapDefinition } from '../../core/constants/maps';
import { formatNumber } from '../../core/math/format';
import {
  BASE_SHIELD_ID,
  BASE_TURRET_ID,
  computeBaseDefenseStatus,
} from '../../core/systems/baseDefenseStatus';
import { Meter } from '../ui';

export function BaseAttackOverlay() {
  const combat = useGameStore((s) => s.combat);
  const buildings = useGameStore((s) => s.buildings);
  const currentMapId = useGameStore((s) => s.maps.currentMapId);
  // Плашка про ГЛАВНУЮ базу: у платформ свой бой, и показывать её поверх чужой сетки нельзя.
  const activePlatformId = useGameStore((s) => s.galaxies.activePlatformId);
  const openPanel = useUiStore((s) => s.open);

  const isPeacefulMap = useMemo(() => {
    if (!currentMapId) return false;
    return getMapDefinition(currentMapId)?.modifiers?.includes('peaceful') ?? false;
  }, [currentMapId]);

  /*
   * Date.now() внутри useMemo — осознанно: стор пересобирает combat каждым тиком (20 Гц),
   * значит memo пересчитывается тогда же, и «секунд до конца волны» не застревает.
   */
  const defense = useMemo(
    () => computeBaseDefenseStatus(combat, buildings, Date.now(), isPeacefulMap),
    [combat, buildings, isPeacefulMap],
  );

  // Названия берём из каталога, а не пишем текстом: иначе плашка соврёт после переименования.
  const turretName = buildings.find((b) => b.id === BASE_TURRET_ID)?.name ?? '';
  const shieldName = buildings.find((b) => b.id === BASE_SHIELD_ID)?.name ?? '';

  if (activePlatformId || !defense.alarm) return null;

  const undefended = defense.level === 'undefended';
  const strained = defense.level === 'strained';
  // Цвет всей плашки — по худшему из состояний: беззащитность важнее нехватки энергии.
  const tone = undefended
    ? { border: 'border-danger/70', text: 'text-danger' }
    : strained
      ? { border: 'border-warning/70', text: 'text-warning' }
      : { border: 'border-accent/60', text: 'text-accent' };

  const shieldPct = Math.round(defense.shieldRatio * 100);
  const basePct = Math.round(defense.baseRatio * 100);

  return (
    <>
      {/*
        Красная виньетка по краям экрана — единственный индикатор, который видно, даже если
        игрок смотрит в панель, а не на карту. Держится только пока урон идёт РЕАЛЬНО: постоянно
        мигающий экран за минуту становится фоном и перестаёт читаться.
      */}
      {defense.takingDamage && (
        <div
          className="pointer-events-none absolute inset-0 z-20 animate-pulse"
          style={{ boxShadow: 'inset 0 0 90px 10px rgba(255, 85, 85, 0.35)' }}
        />
      )}

      <div className="pointer-events-auto absolute left-1/2 top-3 z-30 w-[min(30rem,calc(100vw-1.5rem))] -translate-x-1/2">
        <div className={`rounded border ${tone.border} bg-cyber-black/95 shadow-lg`}>
          {/* Строка состояния: что происходит и сколько это ещё продлится */}
          <div className="flex items-center gap-2 px-3 py-1.5">
            <AlertTriangle size={14} className={`shrink-0 ${tone.text} ${undefended ? 'animate-pulse' : ''}`} />
            <span className={`text-xs font-bold ${tone.text}`}>
              {undefended ? 'БАЗА БЕЗ ОБОРОНЫ' : 'БАЗА ПОД АТАКОЙ'}
            </span>
            <span className="font-mono text-[10px] tabular-nums text-cyber-text-dim">
              врагов: {defense.enemies}
              {defense.secondsLeft > 0 && ` · до конца волны ${defense.secondsLeft} с`}
            </span>
            <button
              type="button"
              className="ml-auto shrink-0 rounded border border-cyber-gray/60 px-2 py-0.5 text-[10px] text-cyber-text-dim hover:text-cyber-text"
              onClick={() => openPanel('combat')}
            >
              Оборона
            </button>
          </div>

          {/* Полосы: корпус базы и щит. Их падение — это и есть «база страдает». */}
          <div className="grid grid-cols-2 gap-3 border-t border-cyber-gray/30 px-3 py-1.5">
            <div>
              <div className="flex items-baseline justify-between text-[10px] text-cyber-text-dim">
                <span>Корпус базы</span>
                <span className="font-mono tabular-nums">
                  {formatNumber(combat.baseHp)} / {formatNumber(combat.baseMaxHp)}
                </span>
              </div>
              <Meter value={basePct} max={100} tone={basePct < 40 ? 'danger' : basePct < 75 ? 'warning' : 'accent'} />
            </div>
            <div>
              <div className="flex items-baseline justify-between text-[10px] text-cyber-text-dim">
                <span>Щит</span>
                <span className="font-mono tabular-nums">
                  {defense.shieldCount > 0
                    ? `${formatNumber(combat.shieldHp)} / ${formatNumber(combat.shieldMaxHp)}`
                    : 'нет'}
                </span>
              </div>
              <Meter value={defense.shieldCount > 0 ? shieldPct : 0} max={100} tone={defense.shieldDown ? 'danger' : 'info'} />
            </div>
          </div>

          {/* Что именно делает оборона — и что делать игроку, если она не делает ничего */}
          <div className="border-t border-cyber-gray/30 px-3 py-1.5">
            {undefended ? (
              <div className="flex items-center gap-2">
                <ShieldAlert size={13} className="shrink-0 text-danger" />
                <span className="min-w-0 flex-1 text-[11px] leading-snug text-cyber-text-dim">
                  Ни турелей, ни щитов — весь урон идёт прямо по корпусу, а повреждения снижают
                  производство. Постройте {turretName} или {shieldName}.
                </span>
                <button
                  type="button"
                  className="shrink-0 rounded border border-danger/60 px-2 py-0.5 text-[10px] text-danger hover:bg-danger/10"
                  onClick={() => openPanel('build')}
                >
                  Строительство
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                <span className="inline-flex items-center gap-1">
                  <Crosshair
                    size={12}
                    className={defense.firing ? 'text-warning' : defense.turretsStarved ? 'text-danger' : 'text-cyber-text-dim'}
                  />
                  <span className="text-cyber-text-dim">
                    Турели: <span className="font-mono tabular-nums">{defense.turretCount}</span>
                    {defense.turretCount === 0
                      ? ' — нет'
                      : defense.firing
                        ? ' — ведут огонь'
                        : defense.turretsStarved
                          ? ' — молчат'
                          : ' — целей нет'}
                  </span>
                </span>

                <span className="inline-flex items-center gap-1">
                  {defense.shieldDown ? (
                    <ShieldAlert size={12} className="text-danger" />
                  ) : (
                    <ShieldCheck size={12} className={defense.shieldCount > 0 ? 'text-info' : 'text-cyber-text-dim'} />
                  )}
                  <span className="text-cyber-text-dim">
                    Щиты: <span className="font-mono tabular-nums">{defense.shieldCount}</span>
                    {defense.shieldCount === 0
                      ? ' — нет'
                      : defense.shieldDown
                        ? ' — пробит'
                        : ` — заряд ${shieldPct}%`}
                  </span>
                </span>

                {strained && (
                  <button
                    type="button"
                    className="ml-auto inline-flex shrink-0 items-center gap-1 rounded border border-warning/60 px-2 py-0.5 text-[10px] text-warning hover:bg-warning/10"
                    onClick={() => openPanel('power')}
                    title="Во время волны турели и щиты едят энергию: при её нехватке они не работают"
                  >
                    <Zap size={11} /> Энергия
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
