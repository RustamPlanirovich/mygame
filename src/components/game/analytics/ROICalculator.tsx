/**
 * ROICalculator Component
 * 
 * Калькулятор окупаемости зданий
 */

import React, { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Clock, Zap, DollarSign, ArrowUpDown } from 'lucide-react';
import { useAnalyticsStore } from '../../../features/analyticsStore';
import { useGameStore } from '../../../features/gameStore';
import type { BuildingROI, ProfitabilityLevel } from '../../../core/gameTypes.analytics';
import { getProfitabilityColor } from '../../../core/gameTypes.analytics';
import { D, formatNumber, formatRate } from '../../../core/math/format';
import { formatROI, getROIColor, getProfitabilityIcon } from '../../../utils/roiCalculator';
import { BarChart } from './charts';

type SortField = 'roi' | 'payback' | 'profit' | 'cost';
type SortDirection = 'asc' | 'desc';

interface ROICardProps {
  roi: BuildingROI;
}

function ROICard({ roi }: ROICardProps) {
  const profitColor = getProfitabilityColor(roi.profitability);
  const roiColor = getROIColor(roi.currentROI);

  return (
    <div 
      className="bg-cyber-gray-800/50 rounded-lg border p-4"
      style={{ borderColor: `${profitColor}40` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{getProfitabilityIcon(roi.profitability)}</span>
          <div>
            <h4 className="text-sm font-medium text-cyber-gray-200">
              {roi.buildingName}
            </h4>
            <span className="text-xs text-cyber-gray-500">{roi.buildingType}</span>
          </div>
        </div>
        <div className="text-right">
          <p 
            className="text-lg font-bold"
            style={{ color: roiColor }}
          >
            {formatROI(roi.currentROI)}
          </p>
          <span className="text-xs text-cyber-gray-500">ROI/час</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
        <div className="flex items-center gap-1">
          <DollarSign className="w-3 h-3 text-cyber-gray-500" />
          <span className="text-cyber-gray-500">Стоимость:</span>
          <span className="text-cyber-gray-200">{formatNumber(D(roi.totalCost))}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-cyber-gray-500" />
          <span className="text-cyber-gray-500">Окупаемость:</span>
          <span className="text-cyber-gray-200">{roi.paybackTimeFormatted}</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3 text-green-500" />
          <span className="text-cyber-gray-500">Доход:</span>
          <span className="text-green-400">{formatRate(D(roi.revenuePerSec))}/с</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingDown className="w-3 h-3 text-red-500" />
          <span className="text-cyber-gray-500">Расходы:</span>
          <span className="text-red-400">{formatRate(D(roi.operatingCostPerSec))}/с</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-cyber-gray-700">
        <div className="flex items-center gap-1 text-xs">
          <Zap className="w-3 h-3 text-yellow-500" />
          <span className="text-cyber-gray-500">Энергия:</span>
          <span className="text-yellow-400">{formatRate(D(roi.energyConsumption))}/с</span>
        </div>
        <span 
          className="text-sm font-medium"
          style={{ color: D(roi.netProfitPerSec).gte(0) ? '#22c55e' : '#ef4444' }}
        >
          {D(roi.netProfitPerSec).gte(0) ? '+' : ''}{formatRate(D(roi.netProfitPerSec))}/с
        </span>
      </div>
    </div>
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

  const sortedROIs = useMemo(() => {
    let filtered = [...buildingROIs];
    
    if (filter === 'profitable') {
      filtered = filtered.filter(r => r.currentROI > 0);
    } else if (filter === 'unprofitable') {
      filtered = filtered.filter(r => r.currentROI <= 0);
    }
    
    return filtered.sort((a, b) => {
      let aVal: number, bVal: number;
      
      switch (sortField) {
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
        case 'cost':
          aVal = D(a.totalCost).toNumber();
          bVal = D(b.totalCost).toNumber();
          break;
        default:
          return 0;
      }
      
      return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [buildingROIs, sortField, sortDirection, filter]);

  // Статистика
  const stats = useMemo(() => {
    const profitable = buildingROIs.filter(r => r.currentROI > 0);
    const unprofitable = buildingROIs.filter(r => r.currentROI < 0);
    const totalProfit = buildingROIs.reduce(
      (acc, r) => acc.add(D(r.netProfitPerSec)), 
      D(0)
    );
    
    return {
      profitableCount: profitable.length,
      unprofitableCount: unprofitable.length,
      totalProfit,
      avgROI: buildingROIs.length > 0
        ? buildingROIs.reduce((acc, r) => acc + r.currentROI, 0) / buildingROIs.length
        : 0,
    };
  }, [buildingROIs]);

  // Данные для графика
  const chartData = useMemo(() => {
    return sortedROIs.slice(0, 10).map(roi => ({
      name: roi.buildingName.length > 15 
        ? roi.buildingName.substring(0, 12) + '...' 
        : roi.buildingName,
      value: roi.currentROI,
      color: getROIColor(roi.currentROI),
    }));
  }, [sortedROIs]);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-cyber-gray-800/50 rounded-lg border border-cyber-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-cyber-gray-200">
            Калькулятор ROI
          </h3>
          <button
            onClick={handleRefresh}
            className="text-xs bg-cyber-gray-700 hover:bg-cyber-gray-600 text-cyber-gray-300 px-3 py-1 rounded transition-colors"
          >
            Пересчитать
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 rounded bg-cyber-gray-900/50">
            <p className="text-2xl font-bold text-green-400">{stats.profitableCount}</p>
            <p className="text-xs text-cyber-gray-500">Прибыльных</p>
          </div>
          <div className="text-center p-3 rounded bg-cyber-gray-900/50">
            <p className="text-2xl font-bold text-red-400">{stats.unprofitableCount}</p>
            <p className="text-xs text-cyber-gray-500">Убыточных</p>
          </div>
          <div className="text-center p-3 rounded bg-cyber-gray-900/50">
            <p 
              className="text-2xl font-bold"
              style={{ color: stats.totalProfit.gte(0) ? '#22c55e' : '#ef4444' }}
            >
              {stats.totalProfit.gte(0) ? '+' : ''}{formatRate(stats.totalProfit)}
            </p>
            <p className="text-xs text-cyber-gray-500">Чистая прибыль/с</p>
          </div>
          <div className="text-center p-3 rounded bg-cyber-gray-900/50">
            <p 
              className="text-2xl font-bold"
              style={{ color: getROIColor(stats.avgROI) }}
            >
              {formatROI(stats.avgROI)}
            </p>
            <p className="text-xs text-cyber-gray-500">Средний ROI</p>
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <BarChart
            data={chartData}
            title="Топ-10 по ROI"
            height={200}
            horizontal
            formatValue={(v) => `${v.toFixed(1)}%`}
          />
        )}
      </div>

      {/* Filters and Sort */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`text-xs px-3 py-1 rounded transition-colors ${
              filter === 'all' 
                ? 'bg-cyber-green-600 text-white' 
                : 'bg-cyber-gray-700 text-cyber-gray-300 hover:bg-cyber-gray-600'
            }`}
          >
            Все ({buildingROIs.length})
          </button>
          <button
            onClick={() => setFilter('profitable')}
            className={`text-xs px-3 py-1 rounded transition-colors ${
              filter === 'profitable' 
                ? 'bg-green-600 text-white' 
                : 'bg-cyber-gray-700 text-cyber-gray-300 hover:bg-cyber-gray-600'
            }`}
          >
            Прибыльные ({stats.profitableCount})
          </button>
          <button
            onClick={() => setFilter('unprofitable')}
            className={`text-xs px-3 py-1 rounded transition-colors ${
              filter === 'unprofitable' 
                ? 'bg-red-600 text-white' 
                : 'bg-cyber-gray-700 text-cyber-gray-300 hover:bg-cyber-gray-600'
            }`}
          >
            Убыточные ({stats.unprofitableCount})
          </button>
        </div>

        <div className="flex gap-2">
          {(['roi', 'payback', 'profit', 'cost'] as SortField[]).map(field => (
            <button
              key={field}
              onClick={() => handleSort(field)}
              className={`text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors ${
                sortField === field 
                  ? 'bg-cyber-gray-600 text-white' 
                  : 'bg-cyber-gray-800 text-cyber-gray-400 hover:bg-cyber-gray-700'
              }`}
            >
              {field === 'roi' && 'ROI'}
              {field === 'payback' && 'Окупаемость'}
              {field === 'profit' && 'Прибыль'}
              {field === 'cost' && 'Стоимость'}
              {sortField === field && (
                <ArrowUpDown className="w-3 h-3" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Building Cards */}
      {sortedROIs.length === 0 ? (
        <div className="bg-cyber-gray-800/50 rounded-lg border border-cyber-gray-700 p-8 text-center">
          <p className="text-cyber-gray-500">
            {filter === 'all' 
              ? 'Нет данных о зданиях. Постройте что-нибудь!'
              : `Нет ${filter === 'profitable' ? 'прибыльных' : 'убыточных'} зданий`
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedROIs.map(roi => (
            <ROICard key={roi.buildingId} roi={roi} />
          ))}
        </div>
      )}
    </div>
  );
}
