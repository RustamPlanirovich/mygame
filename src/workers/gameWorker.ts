/**
 * Web Worker для тяжелых вычислений игры
 * Обрабатывает:
 * - Расчеты proximity-бонусов
 * - Проверку достижений
 * - Расчеты производственных цепочек
 * - Pathfinding для логистики
 */

export interface WorkerRequest {
  id: string;
  type: 'proximity' | 'achievements' | 'production' | 'pathfinding';
  data: any;
}

export interface WorkerResponse {
  id: string;
  type: string;
  result: any;
  error?: string;
}

// Proximity calculations
interface ProximityData {
  gridCells: Array<{ x: number; y: number; buildingId: string | null }>;
}

function calculateProximityBonuses(data: ProximityData): Record<string, number> {
  const bonuses: Record<string, number> = {};
  
  // Создаем map для быстрого доступа
  const gridMap = new Map<string, string>();
  for (const cell of data.gridCells) {
    if (cell.buildingId) {
      gridMap.set(`${cell.x},${cell.y}`, cell.buildingId);
    }
  }

  for (const cell of data.gridCells) {
    if (!cell.buildingId) continue;
    
    let bonus = 0;
    const { x, y, buildingId } = cell;
    
    // Проверяем окружающие клетки (3x3)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        
        const neighborId = gridMap.get(`${x + dx},${y + dy}`);
        if (neighborId) {
          // Простая логика бонусов - можно расширить
          if (buildingId.includes('mine') && neighborId.includes('refinery')) {
            bonus += 0.1;
          } else if (buildingId.includes('factory') && neighborId.includes('storage')) {
            bonus += 0.05;
          } else if (buildingId.includes('lab') && neighborId.includes('lab')) {
            bonus += 0.15;
          }
        }
      }
    }
    
    bonuses[`${x},${y}`] = bonus;
  }
  
  return bonuses;
}

// Achievement checking
interface AchievementData {
  buildingCount: number;
  totalCredits: string; // Decimal as string
  totalResearchPoints: string;
  technologiesUnlocked: number;
}

function checkAchievements(data: AchievementData): string[] {
  const unlocked: string[] = [];
  
  // Преобразуем строки в числа для сравнения
  const credits = parseFloat(data.totalCredits);
  const rp = parseFloat(data.totalResearchPoints);
  
  // Простые проверки достижений
  if (data.buildingCount >= 10) unlocked.push('builder_novice');
  if (data.buildingCount >= 50) unlocked.push('builder_expert');
  if (data.buildingCount >= 100) unlocked.push('builder_master');
  
  if (credits >= 1000) unlocked.push('millionaire');
  if (credits >= 1000000) unlocked.push('billionaire');
  
  if (rp >= 100) unlocked.push('researcher_novice');
  if (rp >= 1000) unlocked.push('researcher_expert');
  
  if (data.technologiesUnlocked >= 5) unlocked.push('tech_enthusiast');
  if (data.technologiesUnlocked >= 15) unlocked.push('tech_master');
  
  return unlocked;
}

// Production chain calculations
interface ProductionData {
  buildingProduction: Record<string, Record<string, string>>; // buildingId -> resourceType -> amount
}

interface ProductionResult {
  totalProduction: Record<string, string>; // resource -> amount
  bottlenecks: string[]; // building IDs that are bottlenecks
}

function calculateProduction(data: ProductionData): ProductionResult {
  const production: Record<string, number> = {};
  const bottlenecks: string[] = [];
  
  for (const [buildingId, resources] of Object.entries(data.buildingProduction)) {
    for (const [resource, amountStr] of Object.entries(resources)) {
      const amount = parseFloat(amountStr);
      
      if (!production[resource]) {
        production[resource] = 0;
      }
      production[resource] += amount;
      
      // Проверка на bottleneck (упрощенно - если производство меньше 1/сек)
      if (amount < 1) {
        bottlenecks.push(buildingId);
      }
    }
  }
  
  // Конвертируем обратно в строки
  const totalProduction: Record<string, string> = {};
  for (const [res, amt] of Object.entries(production)) {
    totalProduction[res] = amt.toString();
  }
  
  return { totalProduction, bottlenecks };
}

// Pathfinding (A* algorithm)
interface PathfindingData {
  start: { x: number; y: number };
  end: { x: number; y: number };
  obstacles: { x: number; y: number }[];
  gridWidth: number;
  gridHeight: number;
}

interface PathNode {
  x: number;
  y: number;
  g: number; // cost from start
  h: number; // heuristic to end
  f: number; // g + h
  parent: PathNode | null;
}

function heuristic(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function findPath(data: PathfindingData): { x: number; y: number }[] {
  const { start, end, obstacles, gridWidth, gridHeight } = data;
  
  // Создаем set препятствий для быстрой проверки
  const obstacleSet = new Set(obstacles.map(o => `${o.x},${o.y}`));
  
  const openList: PathNode[] = [];
  const closedSet = new Set<string>();
  
  const startNode: PathNode = {
    x: start.x,
    y: start.y,
    g: 0,
    h: heuristic(start, end),
    f: 0,
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;
  openList.push(startNode);
  
  const MAX_ITERATIONS = 1000;
  let iterations = 0;
  
  while (openList.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    
    // Находим узел с минимальным f
    openList.sort((a, b) => a.f - b.f);
    const current = openList.shift()!;
    
    // Достигли цели
    if (current.x === end.x && current.y === end.y) {
      const path: { x: number; y: number }[] = [];
      let node: PathNode | null = current;
      while (node) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path;
    }
    
    closedSet.add(`${current.x},${current.y}`);
    
    // Проверяем соседей (4 направления)
    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];
    
    for (const neighbor of neighbors) {
      // Проверяем границы
      if (neighbor.x < 0 || neighbor.x >= gridWidth || neighbor.y < 0 || neighbor.y >= gridHeight) {
        continue;
      }
      
      const neighborKey = `${neighbor.x},${neighbor.y}`;
      
      // Проверяем препятствия и закрытые узлы
      if (obstacleSet.has(neighborKey) || closedSet.has(neighborKey)) {
        continue;
      }
      
      const g = current.g + 1;
      const h = heuristic(neighbor, end);
      const f = g + h;
      
      // Проверяем, есть ли уже в открытом списке с лучшей стоимостью
      const existingIdx = openList.findIndex(n => n.x === neighbor.x && n.y === neighbor.y);
      if (existingIdx !== -1) {
        if (g < openList[existingIdx].g) {
          openList[existingIdx].g = g;
          openList[existingIdx].f = f;
          openList[existingIdx].parent = current;
        }
      } else {
        openList.push({
          x: neighbor.x,
          y: neighbor.y,
          g,
          h,
          f,
          parent: current,
        });
      }
    }
  }
  
  // Путь не найден
  return [];
}

// Message handler
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  
  try {
    let result: any;
    
    switch (request.type) {
      case 'proximity':
        result = calculateProximityBonuses(request.data);
        break;
        
      case 'achievements':
        result = checkAchievements(request.data);
        break;
        
      case 'production':
        result = calculateProduction(request.data);
        break;
        
      case 'pathfinding':
        result = findPath(request.data);
        break;
        
      default:
        throw new Error(`Unknown request type: ${request.type}`);
    }
    
    const response: WorkerResponse = {
      id: request.id,
      type: request.type,
      result,
    };
    
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      id: request.id,
      type: request.type,
      result: null,
      error: error instanceof Error ? error.message : String(error),
    };
    
    self.postMessage(response);
  }
};

// Экспортируем пустой объект для TypeScript
export {};
