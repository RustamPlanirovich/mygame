/**
 * Панель массовых действий над выделенными клетками (bigplan.md, пункты 10 и 28).
 *
 * Появляется только когда что-то выделено, поэтому в обычной игре не занимает места.
 * Показывает сумму возврата ДО подтверждения: массовый снос — самый дорогой способ потерять
 * прогресс, и делать его «на слово» нельзя.
 */

import { useMemo, useState } from 'react';
import { Trash2, Power, PowerOff, X } from 'lucide-react';
import { calculateCost, getBasePos, useGameStore } from '../../features/gameStore';
import { useUiStore } from '../../features/uiStore';
import { planDemolition, DEMOLITION_REFUND_RATE } from '../../core/systems/demolition';
import { resourceLabel } from '../../core/i18n/label';
import { formatNumber } from '../../core/math/format';
import { isBuildingDisableable } from '../../core/constants/buildingCategories';
import type { GridCoord, ResourceType } from '../../core/gameTypes';

function keyToCoord(key: string): GridCoord {
  const comma = key.indexOf(',');
  return { x: Number(key.slice(0, comma)), y: Number(key.slice(comma + 1)) };
}

export function SelectionActionBar() {
  const selectedTiles = useUiStore((s) => s.selectedTiles);
  const clearSelectedTiles = useUiStore((s) => s.clearSelectedTiles);

  const tiles = useGameStore((s) => s.grid.tiles);
  const tileDisabled = useGameStore((s) => s.grid.tileDisabled);
  const tileJobs = useGameStore((s) => s.grid.tileJobs);
  const buildings = useGameStore((s) => s.buildings);
  const gridWidth = useGameStore((s) => s.grid.width);
  const gridHeight = useGameStore((s) => s.grid.height);
  const removeBuildingsAt = useGameStore((s) => s.removeBuildingsAt);
  const setBuildingsDisabled = useGameStore((s) => s.setBuildingsDisabled);

  const [confirming, setConfirming] = useState(false);

  /*
   * План сноса считается тем же кодом, что применяет стор, — иначе показанная сумма возврата
   * и фактическая расходились бы при любой правке правил.
   */
  const plan = useMemo(() => {
    const basePos = getBasePos({ width: gridWidth, height: gridHeight });
    return planDemolition(
      selectedTiles,
      tiles,
      buildings,
      calculateCost,
      { baseKey: `${basePos.x},${basePos.y}`, tileJobs },
    );
  }, [selectedTiles, tiles, buildings, tileJobs, gridWidth, gridHeight]);

  // Сколько из выделенного реально можно выключить: склады и оборона не отключаются.
  const disableable = useMemo(
    () => selectedTiles.filter((k) => tiles[k] && isBuildingDisableable(tiles[k])),
    [selectedTiles, tiles],
  );
  const anyEnabled = disableable.some((k) => !tileDisabled?.[k]);
  const anyDisabled = disableable.some((k) => tileDisabled?.[k]);

  if (selectedTiles.length === 0) return null;

  const coords = plan.keys.map(keyToCoord);
  const refundEntries = Object.entries(plan.refund) as Array<[ResourceType, (typeof plan.refund)[ResourceType]]>;

  const applyDemolition = () => {
    removeBuildingsAt(coords);
    clearSelectedTiles();
    setConfirming(false);
  };

  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-30 -translate-x-1/2">
      <div className="rounded border border-cyber-yellow/50 bg-cyber-black/95 px-3 py-2 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-xs text-cyber-yellow">
            Выделено: <span className="font-mono tabular-nums">{plan.keys.length}</span>
            {plan.keys.length !== selectedTiles.length && (
              <span className="text-cyber-text-dim">
                {' '}из {selectedTiles.length}
              </span>
            )}
          </span>

          {!confirming ? (
            <>
              <button
                type="button"
                className="btn btn-xs flex items-center gap-1"
                disabled={!anyEnabled}
                onClick={() => setBuildingsDisabled(disableable.map(keyToCoord), true)}
                title="Выключить выделенные здания: перестанут производить и потреблять"
              >
                <PowerOff size={12} /> Выключить
              </button>

              <button
                type="button"
                className="btn btn-xs flex items-center gap-1"
                disabled={!anyDisabled}
                onClick={() => setBuildingsDisabled(disableable.map(keyToCoord), false)}
                title="Включить выделенные здания"
              >
                <Power size={12} /> Включить
              </button>

              <button
                type="button"
                className="btn-danger btn-xs flex items-center gap-1"
                disabled={plan.keys.length === 0}
                onClick={() => setConfirming(true)}
              >
                <Trash2 size={12} /> Снести
              </button>

              <button
                type="button"
                className="btn btn-xs"
                onClick={clearSelectedTiles}
                title="Снять выделение (Esc)"
              >
                <X size={12} />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div className="text-xs">
                <div className="text-cyber-text">
                  Снести {plan.keys.length}{' '}
                  {plan.keys.length === 1 ? 'здание' : 'зданий'}?
                </div>
                {/* Сумма возврата до подтверждения: это и есть цена ошибки. */}
                <div className="mt-0.5 text-[10px] text-cyber-text-dim">
                  Вернётся ({Math.round(DEMOLITION_REFUND_RATE * 100)}% стоимости):{' '}
                  {refundEntries.length === 0 ? (
                    'ничего'
                  ) : (
                    refundEntries
                      .map(([res, amount]) => `${resourceLabel(res)} ${formatNumber(amount!)}`)
                      .join(', ')
                  )}
                  {plan.refundCredits.gt(0) && `, кредиты ${formatNumber(plan.refundCredits)}`}
                </div>
                <div className="mt-0.5 text-[10px] text-cyber-text-dim">
                  Излишек сверх вместимости склада пропадёт.
                </div>
              </div>

              <button type="button" className="btn-danger btn-xs" onClick={applyDemolition}>
                Снести
              </button>
              <button type="button" className="btn btn-xs" onClick={() => setConfirming(false)}>
                Отмена
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
