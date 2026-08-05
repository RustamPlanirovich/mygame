/**
 * ResourceDistribution Component
 *
 * Распределение ресурсов (pie chart)
 */

import { memo, useCallback, useMemo } from 'react';
import { PieChart as PieIcon } from 'lucide-react';
import { useGameStore } from '../../../features/gameStore';
import { DonutChart } from './charts';
import { EmptyState, Panel } from '../../ui';
import { D, formatNumber } from '../../../core/math/format';
import type { LabeledDataPoint } from '../../../core/gameTypes.analytics';
import {
  createResourceDistributionData,
  createEnergyConsumptionData,
} from '../../../utils/analyticsHelpers';
import { distributionSignature } from './distributionSignature';

type DistributionType = 'resources' | 'energy' | 'production';

interface ResourceDistributionProps {
  type?: DistributionType;
}

type GameState = ReturnType<typeof useGameStore.getState>;

function computeDistribution(state: GameState, type: DistributionType): LabeledDataPoint[] {
  return type === 'energy'
    ? createEnergyConsumptionData(state.buildings)
    : createResourceDistributionData(state.resources, 8);
}

export const ResourceDistribution = memo(function ResourceDistribution({
  type = 'resources',
}: ResourceDistributionProps) {
  /*
   * Подписываемся на СТРОКУ-дайджест, а не на срез стора.
   *
   * Прежний код читал `state.resources` целиком. tick() возвращает новый объект
   * resources 20 раз в секунду, поэтому Object.is всегда давал false и диаграмма
   * пересобиралась на каждом тике, даже когда на экране не менялось ничего.
   *
   * Дайджест — обычная строка, она сравнивается по значению, так что перерисовка
   * происходит ровно тогда, когда изменилось бы видимое содержимое.
   */
  const selectSignature = useCallback(
    (state: GameState) => distributionSignature(computeDistribution(state, type)),
    [type],
  );

  const signature = useGameStore(selectSignature);

  const { data, title, centerValue, centerLabel } = useMemo(() => {
    const entries = computeDistribution(useGameStore.getState(), type);
    const total = entries.reduce((acc, item) => acc + D(item.value).toNumber(), 0);

    const mapped = entries.map(item => ({
      // Подписи уже локализованы в createResourceDistributionData / createEnergyConsumptionData.
      name: item.label,
      value: D(item.value).toNumber(),
      color: item.color,
    }));

    return type === 'energy'
      ? {
          data: mapped,
          title: 'Потребление энергии',
          centerValue: formatNumber(D(total)),
          centerLabel: 'Всего/с',
        }
      : {
          data: mapped,
          title: 'Распределение ресурсов',
          centerValue: formatNumber(D(total)),
          centerLabel: 'Всего',
        };
    // signature — это и есть «содержимое изменилось»; сами данные читаем из getState().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, signature]);

  if (data.length === 0) {
    return (
      <Panel title={title} icon={<PieIcon className="h-5 w-5" />}>
        <EmptyState title="Нет данных для отображения" />
      </Panel>
    );
  }

  return (
    <Panel title={title} icon={<PieIcon className="h-5 w-5" />}>
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
            className="flex items-center justify-between rounded bg-cyber-gray-900/50 p-2 text-xs"
          >
            <div className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="max-w-[80px] truncate capitalize text-cyber-gray-300">
                {item.name}
              </span>
            </div>
            <span className="font-medium text-cyber-gray-200">
              {formatNumber(D(item.value))}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
});
