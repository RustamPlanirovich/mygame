import { useGameStore } from '../../features/gameStore';
import { SHIP_DEFINITIONS, calculateShipUpgradeCost } from '../../core/constants/ships';
import { formatNumber } from '../../core/math/format';
import { D } from '../../core/math/format';
import type { Ship, ShipType } from '../../core/gameTypes';
import { Anchor, Award, Heart, Shield, Sword, Settings, Trash2, Wrench } from 'lucide-react';
import { notify } from '../../utils/notifications';
import { GameIcon, IconText } from '../ui/icons';

export function FleetPanel() {
  const ships = useGameStore((s) => s.fleet.ships);
  const autoDefend = useGameStore((s) => s.fleet.autoDefend);
  const credits = useGameStore((s) => s.currency.credits);
  const resources = useGameStore((s) => s.resources);
  const platforms = useGameStore((s) => s.galaxies.platforms);
  
  const buildShip = useGameStore((s) => s.buildShip);
  const upgradeShip = useGameStore((s) => s.upgradeShip);
  const assignShip = useGameStore((s) => s.assignShip);
  const repairShip = useGameStore((s) => s.repairShip);
  const scrapShip = useGameStore((s) => s.scrapShip);
  const toggleAutoDefend = useGameStore((s) => s.toggleAutoDefend);

  const canAffordShip = (type: ShipType): boolean => {
    const def = SHIP_DEFINITIONS[type];
    return Object.entries(def.buildCost).every(([resource, cost]) => {
      if (resource === 'credits') {
        return credits.gte(cost as any);
      }
      return resources[resource as keyof typeof resources]?.amount.gte(cost as any) ?? false;
    });
  };

  const canAffordUpgrade = (ship: Ship): boolean => {
    const cost = calculateShipUpgradeCost(ship.type, ship.upgradeLevel);
    return Object.entries(cost).every(([resource, costAmount]) => {
      if (resource === 'credits') {
        return credits.gte(costAmount as any);
      }
      return resources[resource as keyof typeof resources]?.amount.gte(costAmount as any) ?? false;
    });
  };

  const handleBuildShip = (type: ShipType) => {
    if (!canAffordShip(type)) {
      notify.warning('Недостаточно ресурсов для постройки корабля!');
      return;
    }
    buildShip(type);
  };

  const handleUpgradeShip = (shipId: string) => {
    const ship = ships.find(s => s.id === shipId);
    if (!ship || !canAffordUpgrade(ship)) {
      notify.warning('Недостаточно ресурсов для улучшения корабля!');
      return;
    }
    upgradeShip(shipId);
  };

  const shipsByType = ships.reduce((acc, ship) => {
    if (!acc[ship.type]) acc[ship.type] = [];
    acc[ship.type].push(ship);
    return acc;
  }, {} as Record<ShipType, Ship[]>);

  const totalFleetStats = ships.reduce((acc, ship) => ({
    dps: acc.dps.add(ship.dps),
    hp: acc.hp.add(ship.hp),
    maxHp: acc.maxHp.add(ship.maxHp),
  }), { dps: D(0), hp: D(0), maxHp: D(0) });

  return (
    <div className="p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white"><GameIcon icon="🚀" /> Флот</h2>
          <p className="text-[10px] text-gray-400">Управление кораблями</p>
        </div>
        <div className="text-right">
          <div className="text-gray-400 text-[10px]">Кораблей:</div>
          <div className="text-base font-bold text-cyan-400">{ships.length}</div>
        </div>
      </div>

      {/* Fleet Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gradient-to-br from-red-900/30 to-red-800/20 rounded-lg p-2.5 border border-red-700/50">
          <div className="flex items-center gap-1.5 text-red-400 mb-1">
            <Sword size={14} />
            <span className="text-[10px] font-semibold">Общий DPS</span>
          </div>
          <div className="text-lg font-bold text-white">{formatNumber(totalFleetStats.dps)}</div>
        </div>
        <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-lg p-2.5 border border-green-700/50">
          <div className="flex items-center gap-1.5 text-green-400 mb-1">
            <Heart size={14} />
            <span className="text-[10px] font-semibold">HP</span>
          </div>
          <div className="text-lg font-bold text-white truncate" title={`${formatNumber(totalFleetStats.hp)} / ${formatNumber(totalFleetStats.maxHp)}`}>{formatNumber(totalFleetStats.hp)}</div>
        </div>
        <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-lg p-2.5 border border-blue-700/50">
          <div className="flex items-center gap-1.5 text-blue-400 mb-1">
            <Shield size={14} />
            <span className="text-[10px] font-semibold">Автозащита</span>
          </div>
          <button
            onClick={toggleAutoDefend}
            className={`text-[11px] font-bold px-2 py-0.5 rounded ${
              autoDefend
                ? 'bg-green-600 text-white'
                : 'bg-gray-600 text-gray-300'
            }`}
          >
            {autoDefend ? 'ВКЛ' : 'ВЫКЛ'}
          </button>
        </div>
      </div>

      {/* Build Ships */}
      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
        <h3 className="text-base font-bold text-white mb-2 flex items-center gap-1.5">
          <Settings size={14} className="text-cyan-400" />
          Постройка кораблей
        </h3>
        <div className="space-y-1.5">
          {(Object.keys(SHIP_DEFINITIONS) as ShipType[]).map((type) => {
            const def = SHIP_DEFINITIONS[type];
            const canAfford = canAffordShip(type);
            const count = shipsByType[type]?.length || 0;
            
            return (
              <button
                key={type}
                onClick={() => handleBuildShip(type)}
                disabled={!canAfford}
                className={`
                  w-full p-2 rounded-lg border transition-all flex items-center gap-2
                  ${canAfford
                    ? 'border-cyan-600/50 hover:border-cyan-400 bg-cyan-900/20 hover:bg-cyan-800/30'
                    : 'border-gray-700 bg-gray-800/30 opacity-50 cursor-not-allowed'
                  }
                `}
              >
                <span className="text-xl flex-shrink-0"><GameIcon icon={def.icon} /></span>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-white truncate">{def.name}</span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">×{count}</span>
                  </div>
                  <div className="text-[10px] text-gray-400 truncate"><IconText>{def.description}</IconText></div>
                  <div className="flex gap-2 mt-1 text-[10px] text-gray-300 flex-wrap">
                    {Object.entries(def.buildCost).map(([res, cost]) => (
                      <span key={res} className="whitespace-nowrap">
                        <IconText>{res === 'credits' ? '💰' : res}</IconText>: {formatNumber(cost)}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ships List */}
      {ships.length === 0 ? (
        <div className="bg-gray-800/30 rounded-lg p-6 text-center border border-gray-700">
          <div className="text-3xl mb-2"><GameIcon icon="🛸" /></div>
          <div className="text-gray-400 text-sm mb-1">Флот пуст</div>
          <div className="text-[11px] text-gray-500">
            Постройте первый корабль для защиты баз и атак
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <h3 className="text-base font-bold text-white flex items-center gap-1.5">
            <Anchor size={14} className="text-cyan-400" />
            Корабли ({ships.length})
          </h3>
          {ships.map((ship) => (
            <ShipCard
              key={ship.id}
              ship={ship}
              canAffordUpgrade={canAffordUpgrade(ship)}
              onUpgrade={() => handleUpgradeShip(ship.id)}
              onAssign={(targetId) => assignShip(ship.id, targetId)}
              onRepair={() => repairShip(ship.id)}
              onScrap={() => scrapShip(ship.id)}
              platforms={platforms}
            />
          ))}
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-2.5">
        <div className="text-sm text-blue-300">
          <div className="font-semibold mb-1.5 text-[11px]"><GameIcon icon="ℹ️" /> Информация о флоте</div>
          <ul className="space-y-0.5 text-[10px] text-blue-200/80">
            <li>• Корабли защищают базы от вражеских атак</li>
            <li>• Автозащита автоматически направляет корабли на защиту атакуемых платформ</li>
            <li>• Улучшение кораблей увеличивает их характеристики</li>
            <li>• Поврежденные корабли можно отремонтировать за 20% от стоимости постройки</li>
            <li>• Утилизация корабля возвращает 30% ресурсов</li>
            <li>• Флагманы усиливают весь флот бонусами</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

interface ShipCardProps {
  ship: Ship;
  canAffordUpgrade: boolean;
  onUpgrade: () => void;
  onAssign: (targetId: string) => void;
  onRepair: () => void;
  onScrap: () => void;
  platforms: any[];
}

function ShipCard({ ship, canAffordUpgrade, onUpgrade, onAssign, onRepair, onScrap, platforms }: ShipCardProps) {
  const def = SHIP_DEFINITIONS[ship.type];
  const hpPercent = ship.hp.div(ship.maxHp).mul(100).toNumber();
  const isDamaged = hpPercent < 100;

  const getStatusColor = (status: Ship['status']) => {
    switch (status) {
      case 'idle': return 'text-gray-400';
      case 'defending': return 'text-green-400';
      case 'attacking': return 'text-red-400';
      case 'damaged': return 'text-yellow-400';
      case 'repairing': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusLabel = (status: Ship['status']) => {
    switch (status) {
      case 'idle': return 'Ожидание';
      case 'defending': return 'Защита';
      case 'attacking': return 'Атака';
      case 'damaged': return 'Повреждён';
      case 'repairing': return 'Ремонт';
      default: return status;
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-lg p-2.5 border border-gray-700 hover:border-gray-600 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xl flex-shrink-0"><GameIcon icon={def.icon} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white truncate">{ship.name}</h4>
              <span className="text-[10px] text-gray-400 flex-shrink-0">Ур.{ship.level}{ship.upgradeLevel > 0 && <span className="text-cyan-400">+{ship.upgradeLevel}</span>}</span>
            </div>
            <div className={`text-[10px] ${getStatusColor(ship.status)} font-semibold`}>
              {getStatusLabel(ship.status)}
            </div>
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {isDamaged && (
            <button
              onClick={onRepair}
              className="p-1.5 bg-green-700 hover:bg-green-600 text-white rounded transition-all"
              title="Отремонтировать"
            >
              <Wrench size={12} />
            </button>
          )}
          <button
            onClick={onScrap}
            className="p-1.5 bg-red-700 hover:bg-red-600 text-white rounded transition-all"
            title="Утилизировать"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* HP Bar */}
      <div className="mb-2">
        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              hpPercent > 75
                ? 'bg-green-500'
                : hpPercent > 40
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${hpPercent}%` }}
          />
        </div>
      </div>

      {/* Stats - inline badges */}
      <div className="flex gap-1.5 mb-2 text-[10px] flex-wrap">
        <span className="bg-gray-700/50 rounded px-1.5 py-0.5 text-white">
          <GameIcon icon="❤️" /> {formatNumber(ship.hp)}/{formatNumber(ship.maxHp)}
        </span>
        <span className="bg-gray-700/50 rounded px-1.5 py-0.5 text-red-400">
          <GameIcon icon="⚔️" /> {formatNumber(ship.dps)}
        </span>
        <span className="bg-gray-700/50 rounded px-1.5 py-0.5 text-orange-400">
          <GameIcon icon="🛡️" /> {formatNumber(ship.armor)}
        </span>
        <span className="bg-gray-700/50 rounded px-1.5 py-0.5 text-cyan-400">
          <GameIcon icon="⚡" /> {(ship.speed * 100).toFixed(0)}%
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5">
        <button
          onClick={onUpgrade}
          disabled={!canAffordUpgrade}
          className={`
            flex-1 py-1.5 px-2 rounded font-semibold text-[11px] transition-all
            ${canAffordUpgrade
              ? 'bg-cyan-700 hover:bg-cyan-600 text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          <Award className="inline mr-0.5" size={11} />
          Улучшить
        </button>
        <select
          value={ship.assignedTo || ''}
          onChange={(e) => onAssign(e.target.value)}
          className="flex-1 py-1.5 px-2 bg-gray-700 text-white rounded text-[11px]"
        >
          <option value="">Без назначения</option>
          <option value="main_base">Главная база</option>
          {platforms.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
