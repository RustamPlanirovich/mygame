/**
 * ROICalculator Component
 *
 * Калькулятор окупаемости зданий - табличный вид
 */

import { memo, useCallback, useMemo, useState } from 'react';
import { TrendingUp, ArrowUpDown, ArrowUp, ArrowDown, Zap, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useAnalyticsStore } from '../../../features/analyticsStore';
import { useGameStore } from '../../../features/gameStore';
import { EmptyState, Panel, Stat } from '../../ui';
import type { BuildingROI } from '../../../core/gameTypes.analytics';
import { D, formatNumber } from '../../../core/math/format';
import { formatROI, getROIColor, getProfitabilityIcon } from '../../../utils/roiCalculator';
import { GameIcon } from '../../ui/icons';

type SortField = 'name' | 'count' | 'roi' | 'payback' | 'profit' | 'energy';
type SortDirection = 'asc' | 'desc';

/**
 * Раньше SortIcon объявлялся ВНУТРИ ROICalculator: на каждый рендер получался новый
 * тип компонента, и React размонтировал/монтировал все пять иконок заново вместо
 * обычного обновления. Объявление на уровне модуля делает тип стабильным.
 */
function SortIcon({ field, sortField, sortDirection }: {
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
}) {
  if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  return sortDirection === 'desc'
    ? <ArrowDown className="h-3 w-3" />
    : <ArrowUp className="h-3 w-3" />;
}

// Компактная строка таблицы
const ROITableRow = memo(function ROITableRow({ roi, isExpanded, onToggle }: {
  roi: BuildingROI;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const roiColor = getROIColor(roi.currentROI);
  const profitColor = D(roi.netProfitPerSec).gte(0) ? '#3ee07f' : '#ff5555';
  const energyVal = D(roi.energyConsumption);

  return (
    <>
      <tr className="cursor-pointer transition-colors" onClick={onToggle}>
        {/* Название + иконка */}
        <td>
          <div className="flex items-center gap-2">
            <span className="text-base"><GameIcon icon={getProfitabilityIcon(roi.profitability)} /></span>
            <div className="min-w-0">
              <div className="max-w-[150px] truncate text-xs text-cyber-gray-200" title={roi.buildingName}>
                {roi.buildingName}
              </div>
            </div>
            {isExpanded ? (
              <ChevronUp className="h-3 w-3 flex-shrink-0 text-cyber-gray-500" />
            ) : (
              <ChevronDown className="h-3 w-3 flex-shrink-0 text-cyber-gray-500" />
            )}
          </div>
        </td>

        {/* ROI */}
        <td className="text-right">
          <span className="text-sm font-bold" style={{ color: roiColor }}>
            {formatROI(roi.currentROI)}
          </span>
        </td>

        {/* Окупаемость */}
        <td className="text-right">
          <span className="text-xs text-cyber-gray-300">
            {roi.paybackTimeFormatted}
          </span>
        </td>

        {/* Прибыль/с */}
        <td className="text-right">
          <span className="text-sm font-medium" style={{ color: profitColor }}>
            {D(roi.netProfitPerSec).gte(0) ? '+' : ''}{formatNumber(D(roi.netProfitPerSec))}
          </span>
        </td>

        {/* Энергия */}
        <td className="text-right">
          {energyVal.gt(0) ? (
            <span className="flex items-center justify-end gap-1 text-xs text-yellow-400">
              <Zap className="h-3 w-3" />
              {formatNumber(energyVal)}
            </span>
          ) : (
            <span className="text-xs text-cyber-gray-600">—</span>
          )}
        </td>
      </tr>

      {/* Расширенная информация */}
      {isExpanded && (
        <tr className="bg-cyber-gray-900/50">
          <td colSpan={5}>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 py-1">
              <Stat label="Стоимость" value={formatNumber(D(roi.totalCost))} />
              <Stat label="Доход/с" tone="accent" value={`+${formatNumber(D(roi.revenuePerSec))}`} />
              <Stat label="Расходы/с" tone="danger" value={`-${formatNumber(D(roi.operatingCostPerSec))}`} />
              <Stat
                label="Статус"
                tone={roi.isOperating ? 'accent' : 'danger'}
                value={roi.isOperating ? '✓ Работает' : '✗ Остановлено'}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
});

export const ROICalculator = memo(function ROICalculator() {
  const buildingROIs = useAnalyticsStore(state => state.buildingROIs);
  const updateROIs = useAnalyticsStore(state => state.updateROIs);

  const [sortField, setSortField] = useState<SortField>('roi');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filter, setFilter] = useState<'all' | 'profitable' | 'unprofitable'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /*
   * buildings/resources нужны только здесь, в момент клика. Подписка на них
   * перерисовывала таблицу 20 раз в секунду вместе с игровым тиком.
   */
  const handleRefresh = useCallback(() => {
    const { buildings, resources } = useGameStore.getState();
    updateROIs(buildings, resources);
  }, [updateROIs]);

  const handleSort = useCallback((field: SortField) => {
    setSortField(prevField => {
      if (prevField === field) {
        setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
        return prevField;
      }
      setSortDirection('desc');
      return field;
    });
  }, []);

  const sortedROIs = useMemo(() => {
    let filtered = [...buildingROIs];

    if (filter === 'profitable') {
      filtered = filtered.filter(r => r.currentROI > 0);
    } else if (filter === 'unprofitable') {
      filtered = filtered.filter(r => r.currentROI <= 0);
    }

    return filtered.sort((a, b) => {
      let aVal: number | string, bVal: number | string;

      switch (sortField) {
        case 'name':
          aVal = a.buildingName;
          bVal = b.buildingName;
          return sortDirection === 'desc'
            ? bVal.localeCompare(aVal)
            : aVal.localeCompare(bVal);
        case 'roi':
          aVal = a.currentROI;
          bVal = b.currentROI;
          break;
        case 'payback':
          aVal = a.paybackTimeSeconds === Infinity ? 999999999 : a.paybackTimeSeconds;
          bVal = b.paybackTimeSeconds === Infinity ? 999999999 : b.paybackTimeSeconds;
          break;
        case 'profit':
          aVal = D(a.netProfitPerSec).toNumber();
          bVal = D(b.netProfitPerSec).toNumber();
          break;
        case 'energy':
          aVal = D(a.energyConsumption).toNumber();
          bVal = D(b.energyConsumption).toNumber();
          break;
        default:
          return 0;
      }

      return sortDirection === 'desc' ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });
  }, [buildingROIs, sortField, sortDirection, filter]);

  // Статистика
  const stats = useMemo(() => {
    const profitable = buildingROIs.filter(r => r.currentROI > 0);
    const unprofitable = buildingROIs.filter(r => r.currentROI < 0);
    const neutral = buildingROIs.filter(r => r.currentROI === 0);
    const totalProfit = buildingROIs.reduce(
      (acc, r) => acc.add(D(r.netProfitPerSec)),
      D(0)
    );
    const totalEnergy = buildingROIs.reduce(
      (acc, r) => acc.add(D(r.energyConsumption)),
      D(0)
    );

    return {
      profitableCount: profitable.length,
      unprofitableCount: unprofitable.length,
      neutralCount: neutral.length,
      totalProfit,
      totalEnergy,
      avgROI: buildingROIs.length > 0
        ? buildingROIs.reduce((acc, r) => acc + r.currentROI, 0) / buildingROIs.length
        : 0,
    };
  }, [buildingROIs]);

  return (
    <div className="space-y-4">
      {/* Summary - компактная статистика */}
      <Panel
        title="Анализ ROI зданий"
        icon={<TrendingUp className="h-4 w-4" />}
        actions={
          <button onClick={handleRefresh} className="btn btn-xs">
            <GameIcon icon="↻" /> Обновить
          </button>
        }
      >
        {/*
          Две колонки. `md:grid-cols-4` включался по ширине ОКНА и давал плитки по
          90px — «Чистая прибыль» и «Энергопотребление» налезали друг на друга.
        */}
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0 rounded bg-cyber-gray-900/50 p-2">
            <Stat align="center" tone="accent" label="Прибыльных" value={stats.profitableCount} />
          </div>
          <div className="min-w-0 rounded bg-cyber-gray-900/50 p-2">
            <Stat align="center" tone="danger" label="Убыточных" value={stats.unprofitableCount} />
          </div>
          <div className="min-w-0 rounded bg-cyber-gray-900/50 p-2">
            <Stat
              align="center"
              tone={stats.totalProfit.gte(0) ? 'accent' : 'danger'}
              label="Чистая прибыль"
              value={`${stats.totalProfit.gte(0) ? '+' : ''}${formatNumber(stats.totalProfit)}/с`}
            />
          </div>
          <div className="min-w-0 rounded bg-cyber-gray-900/50 p-2">
            <Stat
              align="center"
              tone="warning"
              icon={<Zap className="h-3.5 w-3.5" />}
              label="Энергия"
              value={formatNumber(stats.totalEnergy)}
            />
          </div>
        </div>
      </Panel>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-cyber-gray-500">Фильтр:</span>
        <button
          onClick={() => setFilter('all')}
          className={`btn btn-xs ${filter === 'all' ? 'btn-info' : ''}`}
        >
          Все ({buildingROIs.length})
        </button>
        <button
          onClick={() => setFilter('profitable')}
          className={`btn btn-xs ${filter === 'profitable' ? 'btn-primary' : ''}`}
        >
          <GameIcon icon="✓" /> Прибыльные ({stats.profitableCount})
        </button>
        <button
          onClick={() => setFilter('unprofitable')}
          className={`btn btn-xs ${filter === 'unprofitable' ? 'btn-danger' : ''}`}
        >
          <GameIcon icon="✗" /> Убыточные ({stats.unprofitableCount})
        </button>
      </div>

      {/* Таблица зданий */}
      {sortedROIs.length === 0 ? (
        <EmptyState
          icon={<Info className="h-8 w-8" />}
          title={
            filter === 'all'
              ? 'Нет построенных зданий для анализа'
              : `Нет ${filter === 'profitable' ? 'прибыльных' : 'убыточных'} зданий`
          }
          hint="Постройте здания, чтобы увидеть их эффективность"
        />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[420px] whitespace-nowrap">
              <thead>
                <tr>
                  <th
                    className="cursor-pointer transition-colors hover:text-cyber-gray-200"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Здание
                      <SortIcon field="name" sortField={sortField} sortDirection={sortDirection} />
                    </div>
                  </th>
                  <th
                    className="cursor-pointer text-right transition-colors hover:text-cyber-gray-200"
                    onClick={() => handleSort('roi')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      ROI/ч
                      <SortIcon field="roi" sortField={sortField} sortDirection={sortDirection} />
                    </div>
                  </th>
                  <th
                    className="cursor-pointer text-right transition-colors hover:text-cyber-gray-200"
                    onClick={() => handleSort('payback')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Окупаемость
                      <SortIcon field="payback" sortField={sortField} sortDirection={sortDirection} />
                    </div>
                  </th>
                  <th
                    className="cursor-pointer text-right transition-colors hover:text-cyber-gray-200"
                    onClick={() => handleSort('profit')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Прибыль/с
                      <SortIcon field="profit" sortField={sortField} sortDirection={sortDirection} />
                    </div>
                  </th>
                  <th
                    className="cursor-pointer text-right transition-colors hover:text-cyber-gray-200"
                    onClick={() => handleSort('energy')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <GameIcon icon="⚡" />
                      <SortIcon field="energy" sortField={sortField} sortDirection={sortDirection} />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedROIs.map(roi => (
                  <ROITableRow
                    key={roi.buildingId}
                    roi={roi}
                    isExpanded={expandedId === roi.buildingId}
                    onToggle={() => setExpandedId(
                      expandedId === roi.buildingId ? null : roi.buildingId
                    )}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Подсказка */}
      <div className="flex items-center gap-1 text-[10px] text-cyber-gray-600">
        <Info className="h-3 w-3" />
        ROI = (прибыль/час ÷ стоимость) × 100%. Кликните на строку для деталей.
      </div>
    </div>
  );
});
