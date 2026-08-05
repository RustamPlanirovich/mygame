/**
 * Production Chain Helpers
 * 
 * Анализ и визуализация цепочек производства ресурсов (Factorio-style)
 */

import Decimal from 'break_eternity.js';
import type { 
  ResourceType, 
  Building,
  ProductionNode,
  ProductionChain,
  ProductionChainAnalysis,
  ResourceState
} from '../core/gameTypes';
import { RESOURCE_LABEL } from '../core/constants/labels';

// ============================================================================
// Production Chain Analysis
// ============================================================================

/**
 * Строит граф производства для всех ресурсов
 */
export function buildProductionGraph(
  buildings: Building[],
  resources: Record<ResourceType, ResourceState>
): Map<ResourceType, ProductionNode> {
  const graph = new Map<ResourceType, ProductionNode>();

  // Инициализируем узлы для всех ресурсов
  const resourceTypes = Object.keys(resources) as ResourceType[];
  for (const resource of resourceTypes) {
    graph.set(resource, {
      resource,
      production: new Decimal(0),
      consumption: new Decimal(0),
      balance: new Decimal(0),
      producers: [],
      consumers: [],
      efficiency: 1,
    });
  }

  // Анализируем каждое здание
  for (const building of buildings) {
    if (building.count === 0) continue;

    const totalCount = building.count;

    // Производство
    if (building.production) {
      for (const [resource, amountPerBuilding] of Object.entries(building.production)) {
        const resType = resource as ResourceType;
        const node = graph.get(resType);
        if (node) {
          const totalProduction = amountPerBuilding.mul(totalCount);
          node.production = node.production.add(totalProduction);
          node.producers.push(building.id);
        }
      }
    }

    // Потребление
    if (building.baseCost) {
      for (const [resource, cost] of Object.entries(building.baseCost)) {
        const resType = resource as ResourceType;
        const node = graph.get(resType);
        if (node) {
          // Потребление = стоимость на количество зданий (упрощённо, для отображения)
          // В реальности здания не потребляют непрерывно, но для визуализации цепочки это полезно
          const consumptionRate = cost.mul(0.01); // Условное потребление
          node.consumption = node.consumption.add(consumptionRate);
          node.consumers.push(building.id);
        }
      }
    }
  }

  // Рассчитываем баланс и эффективность для каждого узла
  for (const [, node] of graph) {
    node.balance = node.production.sub(node.consumption);
    
    // Эффективность: насколько хорошо покрыто потребление
    if (node.consumption.gt(0)) {
      node.efficiency = Math.min(1, node.production.div(node.consumption).toNumber());
    } else {
      node.efficiency = node.production.gt(0) ? 1 : 0;
    }
  }

  return graph;
}

/**
 * Находит цепочки производства от базовых ресурсов к конечным продуктам
 */
export function findProductionChains(
  graph: Map<ResourceType, ProductionNode>
): ProductionChain[] {
  const chains: ProductionChain[] = [];

  // Определяем базовые ресурсы (только производятся, не потребляются)
  const baseResources: ResourceType[] = [];
  const endResources: ResourceType[] = [];

  for (const [resource, node] of graph) {
    if (node.production.gt(0) && node.consumption.eq(0)) {
      baseResources.push(resource);
    }
    if (node.consumption.gt(0) && node.producers.length === 0) {
      endResources.push(resource);
    }
  }

  // Строим цепочки от каждого базового ресурса
  for (const startRes of baseResources) {
    for (const endRes of endResources) {
      const chain = buildChain(startRes, endRes, graph);
      if (chain && chain.nodes.length > 1) {
        chains.push(chain);
      }
    }
  }

  return chains;
}

/**
 * Строит цепочку от начального ресурса к конечному
 */
function buildChain(
  start: ResourceType,
  end: ResourceType,
  graph: Map<ResourceType, ProductionNode>
): ProductionChain | null {
  const visited = new Set<ResourceType>();
  const path: ProductionNode[] = [];

  function dfs(current: ResourceType): boolean {
    if (visited.has(current)) return false;
    visited.add(current);

    const node = graph.get(current);
    if (!node) return false;

    path.push(node);

    if (current === end) return true;

    // Ищем следующие узлы через потребителей
    for (const consumer of node.consumers) {
      // Упрощённая логика - в реальности нужно смотреть, что потребляет каждое здание
      // Для демонстрации просто продолжаем поиск
      const nextResources = Array.from(graph.keys()).filter(r => 
        graph.get(r)?.producers.includes(consumer)
      );
      
      for (const nextRes of nextResources) {
        if (dfs(nextRes)) return true;
      }
    }

    path.pop();
    return false;
  }

  if (dfs(start)) {
    return {
      startResource: start,
      endResource: end,
      nodes: [...path],
      bottleneck: findBottleneck(path),
      efficiency: calculateChainEfficiency(path),
    };
  }

  return null;
}

/**
 * Находит узкое место в цепочке (наименьшая эффективность)
 */
function findBottleneck(nodes: ProductionNode[]): ResourceType | null {
  if (nodes.length === 0) return null;

  let bottleneck = nodes[0];
  for (const node of nodes) {
    if (node.efficiency < bottleneck.efficiency) {
      bottleneck = node;
    }
  }

  return bottleneck.efficiency < 0.8 ? bottleneck.resource : null;
}

/**
 * Рассчитывает общую эффективность цепочки
 */
function calculateChainEfficiency(nodes: ProductionNode[]): number {
  if (nodes.length === 0) return 0;

  let totalEfficiency = 0;
  for (const node of nodes) {
    totalEfficiency += node.efficiency;
  }

  return totalEfficiency / nodes.length;
}

/**
 * Анализирует все цепочки производства и даёт рекомендации
 */
export function analyzeProductionChains(
  buildings: Building[],
  resources: Record<ResourceType, ResourceState>
): ProductionChainAnalysis {
  const graph = buildProductionGraph(buildings, resources);
  const chains = findProductionChains(graph);

  // Находим все узкие места
  const bottlenecks: ResourceType[] = [];
  for (const chain of chains) {
    if (chain.bottleneck && !bottlenecks.includes(chain.bottleneck)) {
      bottlenecks.push(chain.bottleneck);
    }
  }

  // Генерируем рекомендации
  const suggestions = generateSuggestions(graph, bottlenecks, chains);

  // Общая эффективность
  let totalEfficiency = 0;
  if (chains.length > 0) {
    for (const chain of chains) {
      totalEfficiency += chain.efficiency;
    }
    totalEfficiency /= chains.length;
  }

  return {
    chains,
    bottlenecks,
    suggestions,
    efficiency: totalEfficiency,
  };
}

/**
 * Генерирует рекомендации по улучшению производства
 */
function generateSuggestions(
  graph: Map<ResourceType, ProductionNode>,
  bottlenecks: ResourceType[],
  chains: ProductionChain[]
): string[] {
  const suggestions: string[] = [];

  // Рекомендации по узким местам
  for (const bottleneck of bottlenecks) {
    const node = graph.get(bottleneck);
    if (node) {
      if (node.efficiency < 0.5) {
        suggestions.push(
          `⚠️ Критическое узкое место: ${getResourceName(bottleneck)}. ` +
          `Производство: ${node.production.toNumber().toFixed(1)}/с, ` +
          `Потребление: ${node.consumption.toNumber().toFixed(1)}/с. ` +
          `Увеличьте производство минимум в ${(1 / node.efficiency).toFixed(1)}x`
        );
      } else if (node.efficiency < 0.8) {
        suggestions.push(
          `⚠️ Узкое место: ${getResourceName(bottleneck)}. ` +
          `Рекомендуется увеличить производство на ${((1 - node.efficiency) * 100).toFixed(0)}%`
        );
      }
    }
  }

  // Рекомендации по переизбытку
  for (const [resource, node] of graph) {
    if (node.production.gt(0) && node.consumption.eq(0) && node.balance.gt(100)) {
      suggestions.push(
        `💡 Переизбыток: ${getResourceName(resource)} (+${node.balance.toNumber().toFixed(1)}/с). ` +
        `Можно снизить производство или найти применение`
      );
    }
  }

  // Рекомендации по неэффективным цепочкам
  for (const chain of chains) {
    if (chain.efficiency < 0.6 && chain.nodes.length > 2) {
      suggestions.push(
        `🔧 Неэффективная цепочка: ${getResourceName(chain.startResource)} → ` +
        `${getResourceName(chain.endResource)} (${(chain.efficiency * 100).toFixed(0)}%). ` +
        `Оптимизируйте промежуточные звенья`
      );
    }
  }

  // Общие рекомендации
  const balancedResources = Array.from(graph.values()).filter(
    n => n.efficiency >= 0.9 && n.efficiency <= 1.1
  ).length;
  const totalResources = graph.size;

  if (balancedResources / totalResources > 0.8) {
    suggestions.push(
      `✅ Отличный баланс производства! ${balancedResources}/${totalResources} ` +
      `ресурсов работают эффективно`
    );
  }

  return suggestions;
}

/**
 * Получает читаемое название ресурса
 */
function getResourceName(resource: ResourceType): string {
  // Локальная таблица покрывала 6 ресурсов из 73, остальные подсказки печатались
  // английским id ("natural_gas"). RESOURCE_LABEL — канонический полный словарь.
  return RESOURCE_LABEL[resource] || resource;
}

/**
 * Получает цвет для визуализации эффективности
 */
export function getEfficiencyColor(efficiency: number): string {
  if (efficiency >= 0.9) return '#6aeda1'; // green
  if (efficiency >= 0.7) return '#ffb86c'; // amber
  if (efficiency >= 0.5) return '#fca62f'; // orange
  return '#ff5555'; // red
}

/**
 * Форматирует баланс ресурса
 */
export function formatBalance(balance: Decimal): string {
  const num = balance.toNumber();
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(1)}/с`;
}

/**
 * Получает статус цепочки
 */
export function getChainStatus(chain: ProductionChain): {
  label: string;
  color: string;
} {
  if (chain.efficiency >= 0.9) {
    return { label: 'Отлично', color: '#6aeda1' };
  }
  if (chain.efficiency >= 0.7) {
    return { label: 'Хорошо', color: '#ffb86c' };
  }
  if (chain.efficiency >= 0.5) {
    return { label: 'Удовлетворительно', color: '#fca62f' };
  }
  return { label: 'Плохо', color: '#ff5555' };
}

/**
 * Находит связанные ресурсы для данного ресурса
 */
export function getRelatedResources(
  resource: ResourceType,
  graph: Map<ResourceType, ProductionNode>
): {
  inputs: ResourceType[];
  outputs: ResourceType[];
} {
  const node = graph.get(resource);
  if (!node) return { inputs: [], outputs: [] };

  const inputs: ResourceType[] = [];
  const outputs: ResourceType[] = [];

  // Входы - ресурсы, которые потребляются производителями этого ресурса
  for (const producer of node.producers) {
    for (const [otherRes, otherNode] of graph) {
      if (otherNode.consumers.includes(producer)) {
        if (!inputs.includes(otherRes)) {
          inputs.push(otherRes);
        }
      }
    }
  }

  // Выходы - ресурсы, которые производятся потребителями этого ресурса
  for (const consumer of node.consumers) {
    for (const [otherRes, otherNode] of graph) {
      if (otherNode.producers.includes(consumer)) {
        if (!outputs.includes(otherRes)) {
          outputs.push(otherRes);
        }
      }
    }
  }

  return { inputs, outputs };
}

/**
 * Информация о шаге в производственной цепочке
 */
export interface ProductionChainStep {
  resource: ResourceType;
  buildings: string[]; // ID зданий, которые производят этот ресурс
  isProducing: boolean; // Производится ли сейчас
  inputs?: ProductionChainStep[]; // Требуемые входные ресурсы
}

/**
 * Строит полную производственную цепочку для ресурса
 * Показывает какие здания и материалы нужны для производства
 */
export function getResourceProductionChain(
  targetResource: ResourceType,
  buildings: Building[]
): ProductionChainStep | null {
  const visited = new Set<ResourceType>();

  function buildChainRecursive(resource: ResourceType): ProductionChainStep | null {
    // Предотвращаем циклы
    if (visited.has(resource)) {
      return null;
    }
    visited.add(resource);

    // Находим здания, которые производят этот ресурс
    const producers = buildings.filter(b => 
      b.production && resource in b.production
    );

    const producerIds = producers.map(b => b.id);
    const isProducing = producers.some(b => b.count > 0);

    // Если это базовый ресурс (добывается, а не производится)
    if (producers.length === 0) {
      return {
        resource,
        buildings: [],
        isProducing: false,
        inputs: undefined,
      };
    }

    // Находим все входные ресурсы для производителей
    const inputResources = new Set<ResourceType>();
    for (const producer of producers) {
      if (producer.consumption) {
        for (const inputRes of Object.keys(producer.consumption)) {
          inputResources.add(inputRes as ResourceType);
        }
      }
      // Также учитываем стоимость строительства как "входные ресурсы"
      if (producer.baseCost) {
        for (const costRes of Object.keys(producer.baseCost)) {
          if (costRes !== 'energy') { // Энергию не считаем материалом
            inputResources.add(costRes as ResourceType);
          }
        }
      }
    }

    // Рекурсивно строим цепочки для входных ресурсов
    const inputs: ProductionChainStep[] = [];
    for (const inputRes of inputResources) {
      const inputChain = buildChainRecursive(inputRes);
      if (inputChain) {
        inputs.push(inputChain);
      }
    }

    visited.delete(resource);

    return {
      resource,
      buildings: producerIds,
      isProducing,
      inputs: inputs.length > 0 ? inputs : undefined,
    };
  }

  return buildChainRecursive(targetResource);
}

/**
 * Собирает плоский список всех ресурсов и зданий в цепочке
 */
export function flattenProductionChain(
  chain: ProductionChainStep | null
): Array<{ resource: ResourceType; buildings: string[]; isProducing: boolean; level: number }> {
  if (!chain) return [];

  const result: Array<{ resource: ResourceType; buildings: string[]; isProducing: boolean; level: number }> = [];
  const visited = new Set<ResourceType>();

  function traverse(step: ProductionChainStep, level: number) {
    if (visited.has(step.resource)) return;
    visited.add(step.resource);

    result.push({
      resource: step.resource,
      buildings: step.buildings,
      isProducing: step.isProducing,
      level,
    });

    if (step.inputs) {
      for (const input of step.inputs) {
        traverse(input, level + 1);
      }
    }
  }

  traverse(chain, 0);
  return result;
}
