/**
 * Production Chain Visualizer Component
 * 
 * Визуализация цепочек производства ресурсов (Factorio-style)
 */

import { useMemo } from 'react';
import { useGameStore } from '../../features/gameStore';
import {
  analyzeProductionChains,
  getEfficiencyColor,
  formatBalance,
  getChainStatus,
  buildProductionGraph,
  getRelatedResources,
} from '../../utils/productionChainHelpers';
import { ArrowRight, AlertTriangle, CheckCircle, TrendingUp, Activity } from 'lucide-react';
import { resourceLabel } from '../../core/i18n/label';
import { GameIcon, IconText } from '../ui/icons';

/*
 * Эффективность узла = min(1, производство / потребление) — то есть какую долю потребности
 * закрывает производство (см. buildProductionGraph). Само число «60%» ни о чём не говорит,
 * поэтому рядом с ним везде идёт словесная расшифровка: без неё вкладка читалась как набор
 * процентов без единицы измерения.
 */
function efficiencyHint(efficiency: number, hasConsumption: boolean): string {
  if (!hasConsumption) return 'Никто не потребляет — весь объём идёт на склад';
  if (efficiency >= 0.99) return 'Производства хватает всем потребителям';
  return `Потребителям достаётся только ${(efficiency * 100).toFixed(0)}% от нужного объёма`;
}

export const ProductionChainVisualizer = () => {
  const buildings = useGameStore(state => state.buildings);
  const resources = useGameStore(state => state.resources);

  // Анализируем цепочки производства
  const analysis = useMemo(() => {
    return analyzeProductionChains(buildings, resources);
  }, [buildings, resources]);

  const graph = useMemo(() => {
    return buildProductionGraph(buildings, resources);
  }, [buildings, resources]);

  const { chains, bottlenecks, suggestions, efficiency } = analysis;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-cyber-text flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyber-accent" />
          Цепочки Производства
        </h3>
        <div
          className="flex items-center gap-2"
          title="Средняя доля закрытой потребности по всем цепочкам: 100% — ни один потребитель не голодает"
        >
          <span className="text-xs text-cyber-text-dim">Потребность закрыта на:</span>
          <span
            className="text-sm font-bold"
            style={{ color: getEfficiencyColor(efficiency) }}
          >
            {(efficiency * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Как читать эту вкладку: без пояснения проценты и «+1.2/с» ни о чём не говорят */}
      <div className="p-3 rounded bg-cyber-bg-dark border border-cyber-border text-[11px] text-cyber-text-dim space-y-1">
        <div className="text-cyber-blue font-medium">Как читать</div>
        <div>
          <span className="text-cyber-text">Процент</span> — какая доля потребности в ресурсе
          закрыта производством. 100% — хватает всем, 50% — потребители работают вполсилы.
        </div>
        <div>
          <span className="text-cyber-text">Баланс</span> — сколько остаётся в секунду после
          всех потребителей. Плюс уходит на склад, минус проедает запас.
        </div>
        <div>
          <span className="text-cyber-text">Узкое место</span> — ресурс с наименьшим покрытием
          в цепочке: он ограничивает всю цепочку, и починить надо именно его.
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-cyber-blue"><GameIcon icon="💡" /> Рекомендации</h4>
          <div className="space-y-2">
            {suggestions.map((suggestion, i) => (
              <div 
                key={i}
                className="p-3 rounded bg-cyber-bg-dark border border-cyber-border text-xs text-cyber-text"
              >
                {suggestion}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottlenecks */}
      {bottlenecks.length > 0 && (
        <div className="p-3 rounded bg-red-900/20 border border-red-500/30">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h4 className="text-sm font-bold text-red-400">Узкие места</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {bottlenecks.map((resource) => {
              const node = graph.get(resource);
              return (
                <div
                  key={resource}
                  className="px-2 py-1 rounded bg-red-800/30 border border-red-500/50 text-xs"
                  title={node ? efficiencyHint(node.efficiency, node.consumption.gt(0)) : undefined}
                >
                  <span className="text-red-300 font-medium">{resourceLabel(resource)}</span>
                  {node && (
                    <span className="ml-2 text-red-400">
                      {(node.efficiency * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Production Chains */}
      {chains.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-cyber-blue"><GameIcon icon="🔗" /> Активные цепочки</h4>
          {chains.map((chain, i) => {
            const status = getChainStatus(chain);
            return (
              <ProductionChainCard key={i} chain={chain} status={status} />
            );
          })}
        </div>
      ) : (
        <div className="p-4 rounded bg-cyber-bg-dark border border-cyber-border text-center">
          <p className="text-sm text-cyber-text-dim">
            Пока нет активных цепочек производства
          </p>
          <p className="text-xs text-cyber-text-dim mt-1">
            Постройте здания для создания производственных цепочек
          </p>
        </div>
      )}

      {/* Баланс по ресурсам. Раньше называлось «График ресурсов», хотя графика здесь нет —
          это список ресурсов с производством, потреблением и остатком. */}
      <div className="space-y-2">
        <h4 className="text-sm font-bold text-cyber-blue"><GameIcon icon="📊" /> Баланс по ресурсам</h4>
        <ResourceGraph graph={graph} />
      </div>
    </div>
  );
};

// Карточка цепочки производства
const ProductionChainCard = ({ 
  chain, 
  status 
}: { 
  chain: import('../../core/gameTypes').ProductionChain; 
  status: { label: string; color: string };
}) => {
  return (
    <div className="p-3 rounded bg-cyber-bg-dark border border-cyber-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-cyber-text">
            {resourceLabel(chain.startResource)}
          </span>
          <ArrowRight className="w-4 h-4 text-cyber-text-dim" />
          <span className="text-sm font-medium text-cyber-text">
            {resourceLabel(chain.endResource)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span 
            className="text-xs px-2 py-0.5 rounded font-medium"
            style={{ 
              backgroundColor: `${status.color}20`,
              color: status.color,
              border: `1px solid ${status.color}50`
            }}
          >
            <IconText>{status.label}</IconText>
          </span>
        </div>
      </div>

      {/* Chain nodes */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {chain.nodes.map((node, i) => (
          <div key={i} className="flex items-center gap-2 shrink-0">
            <div
              className="px-2 py-1 rounded text-xs border"
              style={{
                backgroundColor: `${getEfficiencyColor(node.efficiency)}20`,
                borderColor: `${getEfficiencyColor(node.efficiency)}50`,
              }}
              title={`${resourceLabel(node.resource)}: ${efficiencyHint(node.efficiency, node.consumption.gt(0))}`}
            >
              <div className="font-medium" style={{ color: getEfficiencyColor(node.efficiency) }}>
                {resourceLabel(node.resource)}
              </div>
              <div className="text-[10px] text-cyber-text-dim mt-0.5">
                {/* Раньше здесь было просто «+1.2/с» без указания, что это остаток. */}
                остаток {formatBalance(node.balance)}
              </div>
            </div>
            {i < chain.nodes.length - 1 && (
              <ArrowRight className="w-3 h-3 text-cyber-text-dim" />
            )}
          </div>
        ))}
      </div>

      {/* Bottleneck warning */}
      {chain.bottleneck && (
        <div className="mt-2 p-2 rounded bg-red-900/20 border border-red-500/30 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">
            Узкое место: <span className="font-medium">{resourceLabel(chain.bottleneck)}</span>
            {' '}— он ограничивает всю цепочку
          </span>
        </div>
      )}
    </div>
  );
};

// График всех ресурсов
const ResourceGraph = ({ 
  graph 
}: { 
  graph: Map<import('../../core/gameTypes').ResourceType, import('../../core/gameTypes').ProductionNode> 
}) => {
  const sortedNodes = useMemo(() => {
    return Array.from(graph.values())
      .filter(node => node.production.gt(0) || node.consumption.gt(0))
      .sort((a, b) => b.efficiency - a.efficiency);
  }, [graph]);

  if (sortedNodes.length === 0) {
    return (
      <div className="p-3 rounded bg-cyber-bg-dark border border-cyber-border text-center text-xs text-cyber-text-dim">
        Нет активных ресурсов
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sortedNodes.map((node) => (
        <ResourceNode key={node.resource} node={node} graph={graph} />
      ))}
    </div>
  );
};

// Узел ресурса
const ResourceNode = ({ 
  node,
  graph
}: { 
  node: import('../../core/gameTypes').ProductionNode;
  graph: Map<import('../../core/gameTypes').ResourceType, import('../../core/gameTypes').ProductionNode>;
}) => {
  const related = useMemo(() => {
    return getRelatedResources(node.resource, graph);
  }, [node.resource, graph]);

  const efficiencyColor = getEfficiencyColor(node.efficiency);
  const isBalanced = node.balance.abs().lt(0.1);
  const hasConsumption = node.consumption.gt(0);

  // Один короткий вывод вместо трёх чисел, которые игрок должен сопоставлять сам.
  const verdict = useMemo(() => {
    if (hasConsumption && node.efficiency < 0.99) {
      const need = node.consumption.sub(node.production);
      return {
        color: '#ff8080',
        text: `Дефицит: не хватает ${need.toNumber().toFixed(1)}/с. Добавьте производство или отключите часть потребителей.`,
      };
    }
    if (node.balance.gt(0.1)) {
      return {
        color: '#8be9fd',
        text: `Профицит ${node.balance.toNumber().toFixed(1)}/с — излишек копится на складе. Можно пустить в переработку или на продажу.`,
      };
    }
    if (isBalanced && hasConsumption) {
      return { color: '#6aeda1', text: 'Производство и потребление совпадают — запас не растёт и не тает.' };
    }
    return { color: '#7f849f', text: 'Ресурс никто не потребляет — весь объём идёт на склад.' };
  }, [node.balance, node.consumption, node.efficiency, node.production, hasConsumption, isBalanced]);

  return (
    <div className="p-3 rounded bg-cyber-bg-darker border border-cyber-border">
      {/* Resource Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-cyber-text">{resourceLabel(node.resource)}</span>
          {isBalanced && (
            <span title="Производство совпадает с потреблением">
              <CheckCircle className="w-4 h-4 text-green-400" />
            </span>
          )}
        </div>
        <div
          className="text-xs font-bold px-2 py-0.5 rounded"
          style={{
            backgroundColor: `${efficiencyColor}20`,
            color: efficiencyColor
          }}
          title={efficiencyHint(node.efficiency, hasConsumption)}
        >
          {(node.efficiency * 100).toFixed(0)}%
        </div>
      </div>

      {/* Словесный вывод: главное, чего не хватало — что именно делать с этими числами */}
      <div className="mb-2 text-[11px]" style={{ color: verdict.color }}>
        {verdict.text}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-cyber-text-dim">Производство</div>
          <div className="text-green-400 font-medium">
            +{node.production.toNumber().toFixed(1)}/с
          </div>
        </div>
        <div>
          <div className="text-cyber-text-dim">Потребление</div>
          <div className="text-red-400 font-medium">
            -{node.consumption.toNumber().toFixed(1)}/с
          </div>
        </div>
        <div>
          <div className="text-cyber-text-dim">Остаток</div>
          <div
            className="font-medium"
            style={{ color: node.balance.gte(0) ? '#6aeda1' : '#ff5555' }}
          >
            {formatBalance(node.balance)}
          </div>
        </div>
      </div>

      {/* Related resources */}
      {(related.inputs.length > 0 || related.outputs.length > 0) && (
        <div className="mt-2 pt-2 border-t border-cyber-border/50 flex gap-4 text-[10px]">
          {related.inputs.length > 0 && (
            <div>
              <span className="text-cyber-text-dim">Из чего делается: </span>
              <span className="text-cyber-accent">{related.inputs.map(resourceLabel).join(', ')}</span>
            </div>
          )}
          {related.outputs.length > 0 && (
            <div>
              <span className="text-cyber-text-dim">Куда идёт: </span>
              <span className="text-cyber-green">{related.outputs.map(resourceLabel).join(', ')}</span>
            </div>
          )}
        </div>
      )}

      {/* Buildings. «произв.»/«потреб.» без расшифровки читались как обрывки слов. */}
      <div className="mt-2 flex gap-3 text-[10px]">
        {node.producers.length > 0 && (
          <div className="text-cyber-text-dim">
            <TrendingUp className="w-3 h-3 inline mr-1" />
            производят: {node.producers.length}
          </div>
        )}
        {node.consumers.length > 0 && (
          <div className="text-cyber-text-dim">
            <Activity className="w-3 h-3 inline mr-1" />
            потребляют: {node.consumers.length}
          </div>
        )}
      </div>
    </div>
  );
};
