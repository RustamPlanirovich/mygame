import { useGameStore } from '../../features/gameStore';
import { GALAXIES } from '../../core/constants/galaxies';
import { formatNumber } from '../../core/math/format';
import type { SpacePlatform } from '../../core/gameTypes';
import { Shield, Zap, Package, TrendingUp, Trash2, Wrench } from 'lucide-react';

export function PlatformsPanel() {
  const currentGalaxyId = useGameStore((s) => s.galaxies.currentGalaxyId);
  const platforms = useGameStore((s) => s.galaxies.platforms);
  const autoTransportEnabled = useGameStore((s) => s.galaxies.autoTransportEnabled);
  const fuelReserve = useGameStore((s) => s.galaxies.fuelReserve);
  const credits = useGameStore((s) => s.currency.credits);
  const influence = useGameStore((s) => s.currency.influence);
  
  const createPlatform = useGameStore((s) => s.createPlatform);
  const upgradePlatform = useGameStore((s) => s.upgradePlatform);
  const toggleAutoTransport = useGameStore((s) => s.toggleAutoTransport);
  const removePlatform = useGameStore((s) => s.removePlatform);
  const repairPlatform = useGameStore((s) => s.repairPlatform);

  const currentGalaxy = GALAXIES[currentGalaxyId];
  const platformsInCurrentGalaxy = platforms.filter(p => p.galaxyId === currentGalaxyId);

  const handleCreatePlatform = () => {
    const cost = {
      credits: 50000,
      influence: 1000,
    };

    if (credits.lt(cost.credits)) {
      alert(`Недостаточно кредитов! Требуется: ${formatNumber(cost.credits)}`);
      return;
    }

    if (influence.lt(cost.influence)) {
      alert(`Недостаточно влияния! Требуется: ${formatNumber(cost.influence)}`);
      return;
    }

    const platformName = `Платформа ${platforms.length + 1}`;
    createPlatform(currentGalaxyId, platformName);
  };

  const handleUpgrade = (platformId: string, upgradeType: 'defense' | 'mining' | 'storage') => {
    const platform = platforms.find(p => p.id === platformId);
    if (!platform) return;

    const currentLevel = platform.upgrades?.[upgradeType] || 0;
    const cost = calculateUpgradeCost(currentLevel, upgradeType);

    if (credits.lt(cost)) {
      alert(`Недостаточно кредитов! Требуется: ${formatNumber(cost)}`);
      return;
    }

    upgradePlatform(platformId, upgradeType);
  };

  const calculateUpgradeCost = (currentLevel: number, upgradeType: string): number => {
    const baseCosts = {
      defense: 10000,
      mining: 15000,
      storage: 8000,
    };
    const base = baseCosts[upgradeType as keyof typeof baseCosts] || 10000;
    return Math.floor(base * Math.pow(1.5, currentLevel));
  };

  const getUpgradeLabel = (type: 'defense' | 'mining' | 'storage'): string => {
    switch (type) {
      case 'defense': return 'Защита';
      case 'mining': return 'Добыча';
      case 'storage': return 'Хранилище';
    }
  };

  const getUpgradeIcon = (type: 'defense' | 'mining' | 'storage') => {
    switch (type) {
      case 'defense': return Shield;
      case 'mining': return Zap;
      case 'storage': return Package;
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">🛰️ Платформы</h2>
          <p className="text-xs text-gray-400 mt-0.5">Галактика: {currentGalaxy.name}</p>
        </div>
        <div className="text-right text-xs">
          <div className="text-gray-400">Платформ:</div>
          <div className="text-lg font-bold text-cyan-400">{platformsInCurrentGalaxy.length}</div>
        </div>
      </div>

      {/* Auto-transport Toggle */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🚀</div>
            <div>
              <div className="font-semibold text-white">Автоматическая транспортировка</div>
              <div className="text-xs text-gray-400">
                Автоматически отправлять ресурсы с платформ на главную станцию
              </div>
            </div>
          </div>
          <button
            onClick={toggleAutoTransport}
            className={`
              px-4 py-2 rounded-lg font-semibold transition-all
              ${autoTransportEnabled
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-600 hover:bg-gray-700 text-gray-300'
              }
            `}
          >
            {autoTransportEnabled ? 'Включено' : 'Выключено'}
          </button>
        </div>
        {autoTransportEnabled && (
          <div className="mt-3 pt-3 border-t border-gray-700 flex items-center gap-2 text-sm">
            <span className="text-gray-400">Топливный резерв:</span>
            <span className="text-cyan-400 font-semibold">{formatNumber(fuelReserve)}</span>
            <span className="text-gray-500">единиц</span>
          </div>
        )}
      </div>

      {/* Create Platform Button */}
      <button
        onClick={handleCreatePlatform}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
      >
        <span className="text-xl">➕</span>
        <span>Построить новую платформу</span>
        <span className="text-xs opacity-75">(50,000 💰 + 1,000 🏛️)</span>
      </button>

      {/* Platforms List */}
      {platformsInCurrentGalaxy.length === 0 ? (
        <div className="bg-gray-800/30 rounded-lg p-8 text-center border border-gray-700">
          <div className="text-4xl mb-3">🛸</div>
          <div className="text-gray-400 mb-2">Платформ в этой галактике пока нет</div>
          <div className="text-sm text-gray-500">
            Постройте первую платформу для автономной добычи ресурсов
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {platformsInCurrentGalaxy.map((platform) => (
            <PlatformCard
              key={platform.id}
              platform={platform}
              onUpgrade={handleUpgrade}
              onRemove={removePlatform}
              onRepair={repairPlatform}
              calculateCost={calculateUpgradeCost}
              getUpgradeLabel={getUpgradeLabel}
              getUpgradeIcon={getUpgradeIcon}
            />
          ))}
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
        <div className="text-sm text-blue-300">
          <div className="font-semibold mb-2">ℹ️ Информация о платформах</div>
          <ul className="space-y-1 text-xs text-blue-200/80">
            <li>• Платформы автоматически добывают ресурсы из месторождений</li>
            <li>• Улучшение "Добыча" увеличивает скорость добычи на 50% за уровень</li>
            <li>• Улучшение "Защита" увеличивает HP (+50%), броню (+40%) и щиты (+50%, реген +30%) за уровень</li>
            <li>• Улучшение "Хранилище" увеличивает вместимость на 100% за уровень</li>
            <li>• При включенной авто-транспортировке ресурсы доставляются на главную станцию</li>
            <li>• Постройте турели и радары на платформах для защиты от атак</li>
            <li>• Броня снижает физический урон, щиты блокируют энергетический урон</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

interface PlatformCardProps {
  platform: SpacePlatform;
  onUpgrade: (platformId: string, upgradeType: 'defense' | 'mining' | 'storage') => void;
  onRemove: (platformId: string) => void;
  onRepair: (platformId: string, repairType: 'hull' | 'armor' | 'shield' | 'all') => void;
  calculateCost: (currentLevel: number, upgradeType: string) => number;
  getUpgradeLabel: (type: 'defense' | 'mining' | 'storage') => string;
  getUpgradeIcon: (type: 'defense' | 'mining' | 'storage') => React.ComponentType<any>;
}

function PlatformCard({ platform, onUpgrade, onRemove, onRepair, calculateCost, getUpgradeLabel, getUpgradeIcon }: PlatformCardProps) {
  const hpPercent = platform.hp.div(platform.maxHp).mul(100).toNumber();
  const shieldPercent = platform.shieldMaxHp.gt(0) 
    ? platform.shieldHp.div(platform.shieldMaxHp).mul(100).toNumber() 
    : 0;
  const armorPercent = platform.maxArmor.gt(0)
    ? platform.armor.div(platform.maxArmor).mul(100).toNumber()
    : 0;

  const defenseLevel = platform.upgrades?.defense || 0;
  const miningLevel = platform.upgrades?.mining || 0;
  const storageLevel = platform.upgrades?.storage || 0;

  return (
    <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-lg p-5 border border-gray-700 hover:border-gray-600 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🛰️</span>
            <span>{platform.name}</span>
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            ID: {platform.id.slice(0, 12)}...
          </p>
        </div>
        <button
          onClick={() => onRemove(platform.id)}
          className="text-red-400 hover:text-red-300 p-2 hover:bg-red-900/20 rounded transition-all"
          title="Удалить платформу"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Health Bars */}
      <div className="space-y-2 mb-4">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-400">HP</span>
            <span className="text-white font-mono">
              {formatNumber(platform.hp)} / {formatNumber(platform.maxHp)}
            </span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all"
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>

        {platform.maxArmor.gt(0) && (
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-400">Броня</span>
              <span className="text-orange-400 font-mono">
                {formatNumber(platform.armor)} / {formatNumber(platform.maxArmor)}
              </span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 transition-all"
                style={{ width: `${armorPercent}%` }}
              />
            </div>
          </div>
        )}

        {platform.shieldMaxHp.gt(0) && (
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-400">Щиты</span>
              <span className="text-cyan-400 font-mono">
                {formatNumber(platform.shieldHp)} / {formatNumber(platform.shieldMaxHp)}
              </span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all"
                style={{ width: `${shieldPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Repair Buttons */}
      {(hpPercent < 100 || armorPercent < 100 || shieldPercent < 100) && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="text-xs text-gray-400 mb-2 flex items-center gap-2">
            <Wrench size={14} />
            <span>Ремонт (10💰/HP, 5💰/броня, 3💰/щиты)</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {hpPercent < 100 && (
              <button
                onClick={() => onRepair(platform.id, 'hull')}
                className="bg-red-900/30 hover:bg-red-900/50 border border-red-700/50 hover:border-red-600 rounded px-2 py-1.5 text-xs text-red-300 transition-all"
              >
                HP
              </button>
            )}
            {platform.maxArmor.gt(0) && armorPercent < 100 && (
              <button
                onClick={() => onRepair(platform.id, 'armor')}
                className="bg-orange-900/30 hover:bg-orange-900/50 border border-orange-700/50 hover:border-orange-600 rounded px-2 py-1.5 text-xs text-orange-300 transition-all"
              >
                Броня
              </button>
            )}
            {platform.shieldMaxHp.gt(0) && shieldPercent < 100 && (
              <button
                onClick={() => onRepair(platform.id, 'shield')}
                className="bg-cyan-900/30 hover:bg-cyan-900/50 border border-cyan-700/50 hover:border-cyan-600 rounded px-2 py-1.5 text-xs text-cyan-300 transition-all"
              >
                Щиты
              </button>
            )}
            {(hpPercent < 100 || armorPercent < 100 || shieldPercent < 100) && (
              <button
                onClick={() => onRepair(platform.id, 'all')}
                className="bg-green-900/30 hover:bg-green-900/50 border border-green-700/50 hover:border-green-600 rounded px-2 py-1.5 text-xs text-green-300 transition-all"
              >
                Всё
              </button>
            )}
          </div>
        </div>
      )}

      {/* Upgrades */}
      <div className="grid grid-cols-3 gap-2">
        {(['defense', 'mining', 'storage'] as const).map((upgradeType) => {
          const level = platform.upgrades?.[upgradeType] || 0;
          const cost = calculateCost(level, upgradeType);
          const Icon = getUpgradeIcon(upgradeType);
          const label = getUpgradeLabel(upgradeType);

          return (
            <button
              key={upgradeType}
              onClick={() => onUpgrade(platform.id, upgradeType)}
              className="bg-gray-700/50 hover:bg-gray-700 border border-gray-600 hover:border-gray-500 rounded-lg p-3 transition-all group"
            >
              <div className="flex flex-col items-center gap-1">
                <Icon className="text-gray-400 group-hover:text-white transition-colors" size={20} />
                <div className="text-xs text-gray-300">{label}</div>
                <div className="text-sm font-bold text-white">Ур. {level}</div>
                <div className="text-xs text-cyan-400">
                  <TrendingUp className="inline" size={12} />
                  {formatNumber(cost)}💰
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Production Info */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="text-xs text-gray-400 space-y-1">
          <div className="flex items-center justify-between">
            <span>Уровень защиты:</span>
            <span className="text-purple-400 font-semibold">
              {defenseLevel}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Скорость добычи:</span>
            <span className="text-green-400 font-semibold">
              +{((1 + miningLevel * 0.5) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Вместимость:</span>
            <span className="text-blue-400 font-semibold">
              {1 + storageLevel}x
            </span>
          </div>
        </div>
        
        {/* Combat Status */}
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="text-xs text-gray-400 space-y-1">
            <div className="flex items-center justify-between">
              <span>Статус:</span>
              <span className={platform.combat.underAttack ? "text-red-400 font-semibold animate-pulse" : "text-green-400"}>
                {platform.combat.underAttack ? "⚠️ ПОД АТАКОЙ" : "🛡️ В БЕЗОПАСНОСТИ"}
              </span>
            </div>
            {platform.combat.enemies.length > 0 && (
              <div className="flex items-center justify-between">
                <span>Враги:</span>
                <span className="text-red-400 font-semibold">
                  {platform.combat.enemies.length}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span>Турели:</span>
              <span className="text-cyan-400">
                {platform.combat.turretCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Радары:</span>
              <span className="text-yellow-400">
                {platform.combat.radarCount}
              </span>
            </div>
            {platform.shieldRegenRate.gt(0) && (
              <div className="flex items-center justify-between">
                <span>Реген щитов:</span>
                <span className="text-cyan-300">
                  +{formatNumber(platform.shieldRegenRate)}/с
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
