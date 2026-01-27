/**
 * ResourceDistribution Component
 * 
 * Распределение ресурсов (pie chart)
 */

import React, { useMemo } from 'react';
import { PieChart as PieIcon } from 'lucide-react';
import { useGameStore } from '../../../features/gameStore';
import { PieChart, DonutChart } from './charts';
import { D, formatNumber } from '../../../core/math/format';
import { createResourceDistributionData, createEnergyConsumptionData } from '../../../utils/analyticsHelpers';

type DistributionType = 'resources' | 'energy' | 'production';

interface ResourceDistributionProps {
  type?: DistributionType;
}

export function ResourceDistribution({ type = 'resources' }: ResourceDistributionProps) {
  const resources = useGameStore(state => state.resources);
  const buildings = useGameStore(state => state.buildings);

  const { data, title, centerValue, centerLabel } = useMemo(() => {
    if (type === 'energy') {
      const energyData = createEnergyConsumptionData(buildings);
      const totalEnergy = energyData.reduce((acc, item) => acc + D(item.value).toNumber(), 0);
      
      return {
        data: energyData.map(item => ({
          name: item.label,
          value: D(item.value).toNumber(),
          color: item.color,
        })),
        title: 'Потребление энергии',
        centerValue: formatNumber(D(totalEnergy)),
        centerLabel: 'Всего/с',
      };
    }

    const resourceData = createResourceDistributionData(resources, 8);
    const totalResources = resourceData.reduce((acc, item) => acc + D(item.value).toNumber(), 0);
    
    return {
      data: resourceData.map(item => ({
        name: item.label.replace(/_/g, ' '),
        value: D(item.value).toNumber(),
        color: item.color,
      })),
      title: 'Распределение ресурсов',
      centerValue: formatNumber(D(totalResources)),
      centerLabel: 'Всего',
    };
  }, [type, resources, buildings]);

  if (data.length === 0) {
    return (
      <div className="bg-cyber-gray-800/50 rounded-lg border border-cyber-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <PieIcon className="w-5 h-5 text-cyber-green-400" />
          <h3 className="text-lg font-medium text-cyber-gray-200">{title}</h3>
        </div>
        <div className="flex items-center justify-center h-48">
          <p className="text-cyber-gray-500">Нет данных для отображения</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-cyber-gray-800/50 rounded-lg border border-cyber-gray-700 p-6">
      <div className="flex items-center gap-2 mb-4">
        <PieIcon className="w-5 h-5 text-cyber-green-400" />
        <h3 className="text-lg font-medium text-cyber-gray-200">{title}</h3>
      </div>
      
      <DonutChart
        data={data}
        height={280}
        centerValue={centerValue}
        centerLabel={centerLabel}
        showLegend={true}
      />

      {/* Legend with values */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {data.slice(0, 8).map((item) => (
          <div 
            key={item.name}
            className="flex items-center justify-between text-xs p-2 rounded bg-cyber-gray-900/50"
          >
            <div className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-cyber-gray-300 capitalize truncate max-w-[80px]">
                {item.name}
              </span>
            </div>
            <span className="text-cyber-gray-200 font-medium">
              {formatNumber(D(item.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
