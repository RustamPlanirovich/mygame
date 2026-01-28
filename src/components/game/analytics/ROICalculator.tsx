/**
 * ROICalculator Component
 * 
 * Калькулятор окупаемости зданий - табличный вид
 */

import React, { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, ArrowUpDown, ArrowUp, ArrowDown, Zap, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useAnalyticsStore } from '../../../features/analyticsStore';
import { useGameStore } from '../../../features/gameStore';
import type { BuildingROI } from '../../../core/gameTypes.analytics';
import { getProfitabilityColor } from '../../../core/gameTypes.analytics';
import { D, formatNumber } from '../../../core/math/format';
import { formatROI, getROIColor, getProfitabilityIcon } from '../../../utils/roiCalculator';

type SortField = 'name' | 'count' | 'roi' | 'payback' | 'profit' | 'energy';
type SortDirection = 'asc' | 'desc';

// Компактная строка таблицы
function ROITableRow({ roi, isExpanded, onToggle }: { 
  roi: BuildingROI; 
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const roiColor = getROIColor(roi.currentROI);
  const profitColor = D(roi.netProfitPerSec).gte(0) ? '#22c55e' : '#ef4444';
  const energyVal = D(roi.energyConsumption);
  
  return (
    <>
      <tr 
        className="border-b border-cyber-gray-700/50 hover:bg-cyber-gray-800/30 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        {/* Название + иконка */}
        <td className="py-2 px-2">
          <div className="flex items-center gap-2">
            <span className="text-base">{getProfitabilityIcon(roi.profitability)}</span>
            <div className="min-w-0">
              <div className="text-sm text-cyber-gray-200 truncate max-w-[140px]" title={roi.buildingName}>
                {roi.buildingName}
              </div>
            </div>
            {isExpanded ? (
              <ChevronUp className="w-3 h-3 text-cyber-gray-500 flex-shrink-0" />
            ) : (
              <ChevronDown className="w-3 h-3 text-cyber-gray-500 flex-shrink-0" />
            )}
          </div>
        </td>
        
        {/* ROI */}
        <td className="py-2 px-2 text-right">
          <span className="text-sm font-bold" style={{ color: roiColor }}>
            {formatROI(roi.currentROI)}
          </span>
        </td>
        
        {/* Окупаемость */}
        <td className="py-2 px-2 text-right">
          <span className="text-xs text-cyber-gray-300">
            {roi.paybackTimeFormatted}
          </span>
        </td>
        
        {/* Прибыль/с */}
        <td className="py-2 px-2 text-right">
          <span className="text-sm font-medium" style={{ color: profitColor }}>
            {D(roi.netProfitPerSec).gte(0) ? '+' : ''}{formatNumber(D(roi.netProfitPerSec))}
          </span>
        </td>
        
        {/* Энергия */}
        <td className="py-2 px-2 text-right">
          {energyVal.gt(0) ? (
            <span className="text-xs text-yellow-400 flex items-center justify-end gap-1">
              <Zap className="w-3 h-3" />
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
          <td colSpan={5} className="py-2 px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-cyber-gray-500">Стоимость постройки:</span>
                <div className="text-cyber-gray-200 font-medium">{formatNumber(D(roi.totalCost))}</div>
              </div>
              <div>
                <span className="text-cyber-gray-500">Доход/с:</span>
                <div className="text-green-400 font-medium">+{formatNumber(D(roi.revenuePerSec))}</div>
              </div>
              <div>
                <span className="text-cyber-gray-500">Расходы/с:</span>
                <div className="text-red-400 font-medium">-{formatNumber(D(roi.operatingCostPerSec))}</div>
              </div>
              <div>
                <span className="text-cyber-gray-500">Статус:</span>
                <div className={roi.isOperating ? 'text-green-400' : 'text-red-400'}>
                  {roi.isOperating ? '✓ Работает' : '✗ Остановлено'}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function ROICalculator() {
  const buildingROIs = useAnalyticsStore(state => state.buildingROIs);
  const buildings = useGameStore(state => state.buildings);
  const resources = useGameStore(state => state.resources);
  const updateROIs = useAnalyticsStore(state => state.updateROIs);
  
  const [sortField, setSortField] = useState<SortField>('roi');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filter, setFilter] = useState<'all' | 'profitable' | 'unprofitable'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleRefresh = () => {
    updateROIs(buildings, resources);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDirection === 'desc' 
      ? <ArrowDown className="w-3 h-3" /> 
      : <ArrowUp className="w-3 h-3" />;
  };

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
      <div className="bg-cyber-gray-800/50 rounded-lg border border-cyber-gray-700 p-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-cyber-gray-200 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyber-green-400" />
            Анализ ROI зданий
          </h3>
          <button
            onClick={handleRefresh}
            className="text-xs bg-cyber-gray-700 hover:bg-cyber-gray-600 text-cyber-gray-300 px-2 py-1 rounded transition-colors"
          >
            ↻ Обновить
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded bg-cyber-gray-900/50">
            <p className="text-lg font-bold text-green-400">{stats.profitableCount}</p>
            <p className="text-[10px] text-cyber-gray-500">Прибыльных</p>
          </div>
          <div className="p-2 rounded bg-cyber-gray-900/50">
            <p className="text-lg font-bold text-red-400">{stats.unprofitableCount}</p>
            <p className="text-[10px] text-cyber-gray-500">Убыточных</p>
          </div>
          <div className="p-2 rounded bg-cyber-gray-900/50">
            <p 
              className="text-lg font-bold"
              style={{ color: stats.totalProfit.gte(0) ? '#22c55e' : '#ef4444' }}
            >
              {stats.totalProfit.gte(0) ? '+' : ''}{formatNumber(stats.totalProfit)}/с
            </p>
            <p className="text-[10px] text-cyber-gray-500">Чистая прибыль</p>
          </div>
          <div className="p-2 rounded bg-cyber-gray-900/50">
            <p className="text-lg font-bold text-yellow-400 flex items-center justify-center gap-1">
              <Zap className="w-4 h-4" />
              {formatNumber(stats.totalEnergy)}
            </p>
            <p className="text-[10px] text-cyber-gray-500">Энергопотребление</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-cyber-gray-500">Фильтр:</span>
        <button
          onClick={() => setFilter('all')}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            filter === 'all' 
              ? 'bg-cyber-blue text-white' 
              : 'bg-cyber-gray-700 text-cyber-gray-300 hover:bg-cyber-gray-600'
          }`}
        >
          Все ({buildingROIs.length})
        </button>
        <button
          onClick={() => setFilter('profitable')}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            filter === 'profitable' 
              ? 'bg-green-600 text-white' 
              : 'bg-cyber-gray-700 text-cyber-gray-300 hover:bg-cyber-gray-600'
          }`}
        >
          ✓ Прибыльные ({stats.profitableCount})
        </button>
        <button
          onClick={() => setFilter('unprofitable')}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            filter === 'unprofitable' 
              ? 'bg-red-600 text-white' 
              : 'bg-cyber-gray-700 text-cyber-gray-300 hover:bg-cyber-gray-600'
          }`}
        >
          ✗ Убыточные ({stats.unprofitableCount})
        </button>
      </div>

      {/* Таблица зданий */}
      {sortedROIs.length === 0 ? (
        <div className="bg-cyber-gray-800/50 rounded-lg border border-cyber-gray-700 p-6 text-center">
          <Info className="w-8 h-8 text-cyber-gray-600 mx-auto mb-2" />
          <p className="text-cyber-gray-500 text-sm">
            {filter === 'all' 
              ? 'Нет построенных зданий для анализа'
              : `Нет ${filter === 'profitable' ? 'прибыльных' : 'убыточных'} зданий`
            }
          </p>
          <p className="text-cyber-gray-600 text-xs mt-1">
            Постройте здания, чтобы увидеть их эффективность
          </p>
        </div>
      ) : (
        <div className="bg-cyber-gray-800/30 rounded-lg border border-cyber-gray-700 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-cyber-gray-900/80 text-xs text-cyber-gray-400">
              <tr>
                <th 
                  className="py-2 px-2 cursor-pointer hover:text-cyber-gray-200 transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Здание
                    <SortIcon field="name" />
                  </div>
                </th>
                <th 
                  className="py-2 px-2 text-right cursor-pointer hover:text-cyber-gray-200 transition-colors"
                  onClick={() => handleSort('roi')}
                >
                  <div className="flex items-center justify-end gap-1">
                    ROI/ч
                    <SortIcon field="roi" />
                  </div>
                </th>
                <th 
                  className="py-2 px-2 text-right cursor-pointer hover:text-cyber-gray-200 transition-colors"
                  onClick={() => handleSort('payback')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Окупаемость
                    <SortIcon field="payback" />
                  </div>
                </th>
                <th 
                  className="py-2 px-2 text-right cursor-pointer hover:text-cyber-gray-200 transition-colors"
                  onClick={() => handleSort('profit')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Прибыль/с
                    <SortIcon field="profit" />
                  </div>
                </th>
                <th 
                  className="py-2 px-2 text-right cursor-pointer hover:text-cyber-gray-200 transition-colors"
                  onClick={() => handleSort('energy')}
                >
                  <div className="flex items-center justify-end gap-1">
                    ⚡
                    <SortIcon field="energy" />
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
      )}
      
      {/* Подсказка */}
      <div className="text-[10px] text-cyber-gray-600 flex items-center gap-1">
        <Info className="w-3 h-3" />
        ROI = (прибыль/час ÷ стоимость) × 100%. Кликните на строку для деталей.
      </div>
    </div>
  );
}
