/**
 * BottleneckAnalyzer Component
 * 
 * Анализ и отображение узких мест производства
 */

import React from 'react';
import { AlertTriangle, AlertCircle, Info, Skull, Clock, ArrowRight } from 'lucide-react';
import { useAnalyticsStore } from '../../../features/analyticsStore';
import { useGameStore } from '../../../features/gameStore';
import type { Bottleneck, BottleneckSeverity } from '../../../core/gameTypes.analytics';
import { getSeverityColor, formatDuration } from '../../../core/gameTypes.analytics';
import { D, formatNumber, formatRate } from '../../../core/math/format';

interface BottleneckCardProps {
  bottleneck: Bottleneck;
}

function BottleneckCard({ bottleneck }: BottleneckCardProps) {
  const buildings = useGameStore(state => state.buildings);
  
  const SeverityIcon = {
    low: Info,
    medium: AlertCircle,
    high: AlertTriangle,
    critical: Skull,
  }[bottleneck.severity];
  
  const severityColor = getSeverityColor(bottleneck.severity);
  
  const producerNames = bottleneck.producingBuildings
    .map(id => buildings.find(b => b.id === id)?.name || id)
    .slice(0, 3);
  
  const consumerNames = bottleneck.consumingBuildings
    .map(id => buildings.find(b => b.id === id)?.name || id)
    .slice(0, 3);

  return (
    <div 
      className="bg-cyber-gray-800/50 rounded-lg border p-4"
      style={{ borderColor: severityColor }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <SeverityIcon 
            className="w-5 h-5" 
            style={{ color: severityColor }}
          />
          <span 
            className="text-sm font-medium capitalize"
            style={{ color: severityColor }}
          >
            {bottleneck.resource.replace(/_/g, ' ')}
          </span>
        </div>
        <span 
          className="text-xs px-2 py-1 rounded-full"
          style={{ 
            backgroundColor: `${severityColor}20`,
            color: severityColor,
          }}
        >
          {bottleneck.severity === 'critical' ? 'Критично' :
           bottleneck.severity === 'high' ? 'Высокий' :
           bottleneck.severity === 'medium' ? 'Средний' : 'Низкий'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
        <div>
          <span className="text-cyber-gray-500">Производство</span>
          <p className="text-green-400">{formatRate(D(bottleneck.production))}/с</p>
        </div>
        <div>
          <span className="text-cyber-gray-500">Потребление</span>
          <p className="text-red-400">{formatRate(D(bottleneck.consumption))}/с</p>
        </div>
        <div>
          <span className="text-cyber-gray-500">Дефицит</span>
          <p className="text-yellow-400">-{formatRate(D(bottleneck.deficit))}/с</p>
        </div>
        <div>
          <span className="text-cyber-gray-500">Запас</span>
          <p className="text-cyber-gray-200">{formatNumber(D(bottleneck.currentStock))}</p>
        </div>
      </div>

      {bottleneck.timeToDepletion !== null && bottleneck.timeToDepletion > 0 && (
        <div className="flex items-center gap-2 mb-3 text-xs">
          <Clock className="w-3 h-3 text-yellow-500" />
          <span className="text-yellow-400">
            Истощится через {formatDuration(bottleneck.timeToDepletion)}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 mb-3 text-xs text-cyber-gray-400">
        <div className="flex-1">
          <span className="block mb-1">Производители:</span>
          <div className="flex flex-wrap gap-1">
            {producerNames.length > 0 ? (
              producerNames.map((name, i) => (
                <span key={i} className="bg-green-900/30 text-green-400 px-2 py-0.5 rounded">
                  {name}
                </span>
              ))
            ) : (
              <span className="text-red-400">Нет производителей!</span>
            )}
            {bottleneck.producingBuildings.length > 3 && (
              <span className="text-cyber-gray-500">
                +{bottleneck.producingBuildings.length - 3}
              </span>
            )}
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-cyber-gray-600" />
        <div className="flex-1">
          <span className="block mb-1">Потребители:</span>
          <div className="flex flex-wrap gap-1">
            {consumerNames.map((name, i) => (
              <span key={i} className="bg-red-900/30 text-red-400 px-2 py-0.5 rounded">
                {name}
              </span>
            ))}
            {bottleneck.consumingBuildings.length > 3 && (
              <span className="text-cyber-gray-500">
                +{bottleneck.consumingBuildings.length - 3}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-cyber-gray-900/50 rounded p-2 text-xs">
        <p className="text-cyber-gray-300">{bottleneck.recommendation}</p>
      </div>
    </div>
  );
}

export function BottleneckAnalyzer() {
  const bottlenecks = useAnalyticsStore(state => state.bottlenecks);
  const buildings = useGameStore(state => state.buildings);
  const resources = useGameStore(state => state.resources);
  const updateBottlenecks = useAnalyticsStore(state => state.updateBottlenecks);

  const handleRefresh = () => {
    updateBottlenecks(buildings, resources);
  };

  const criticalCount = bottlenecks.filter(b => b.severity === 'critical').length;
  const highCount = bottlenecks.filter(b => b.severity === 'high').length;
  const mediumCount = bottlenecks.filter(b => b.severity === 'medium').length;
  const lowCount = bottlenecks.filter(b => b.severity === 'low').length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-cyber-gray-800/50 rounded-lg border border-cyber-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-cyber-gray-200">
            Анализ узких мест
          </h3>
          <button
            onClick={handleRefresh}
            className="text-xs bg-cyber-gray-700 hover:bg-cyber-gray-600 text-cyber-gray-300 px-3 py-1 rounded transition-colors"
          >
            Обновить
          </button>
        </div>

        {bottlenecks.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-green-400 font-medium">Узких мест не обнаружено</p>
            <p className="text-cyber-gray-500 text-sm mt-1">
              Производство работает эффективно
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center p-2 rounded bg-red-900/20">
              <p className="text-2xl font-bold text-red-400">{criticalCount}</p>
              <p className="text-xs text-red-400/70">Критичных</p>
            </div>
            <div className="text-center p-2 rounded bg-orange-900/20">
              <p className="text-2xl font-bold text-orange-400">{highCount}</p>
              <p className="text-xs text-orange-400/70">Высоких</p>
            </div>
            <div className="text-center p-2 rounded bg-yellow-900/20">
              <p className="text-2xl font-bold text-yellow-400">{mediumCount}</p>
              <p className="text-xs text-yellow-400/70">Средних</p>
            </div>
            <div className="text-center p-2 rounded bg-blue-900/20">
              <p className="text-2xl font-bold text-blue-400">{lowCount}</p>
              <p className="text-xs text-blue-400/70">Низких</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottleneck Cards */}
      {bottlenecks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bottlenecks.map(bottleneck => (
            <BottleneckCard key={bottleneck.id} bottleneck={bottleneck} />
          ))}
        </div>
      )}
    </div>
  );
}
