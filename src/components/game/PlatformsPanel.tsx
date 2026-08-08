import { useGameStore } from '../../features/gameStore';
import { GALAXIES } from '../../core/constants/galaxies';
import { formatNumber, D } from '../../core/math/format';
import type { SpacePlatform } from '../../core/gameTypes';
import { Shield, Zap, Package, TrendingUp, Trash2, Wrench, Settings } from 'lucide-react';
import { notify } from '../../utils/notifications';
import { GameIcon, IconText } from '../ui/icons';
import { resourceLabel } from '../../core/i18n/label';
import { totalTransportFuel } from '../../core/systems/transportFuel';

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
  const setActivePlatform = useGameStore((s) => s.setActivePlatform);
  const activePlatformId = useGameStore((s) => s.galaxies.activePlatformId);

  const resources = useGameStore((s) => s.resources);

  const currentGalaxy = GALAXIES[currentGalaxyId];
  const platformsInCurrentGalaxy = platforms.filter(p => p.galaxyId === currentGalaxyId);

  /*
   * Топливо перевозок — одно на караваны и авто-транспорт (bigplan.md, пункт 45). Показываем
   * все три источника всегда, а не только при включённой авто-транспортировке: раньше игрок,
   * у которого авто-вывоз выключен, вообще не видел ни резерва, ни кнопки покупки — и в
   * караванах упирался в «нужно топливо», не понимая, где его взять.
   */
  const liquidFuel = resources.liquid_fuel?.amount ?? D(0);
  const gasoline = resources.gasoline?.amount ?? D(0);
  const totalFuel = totalTransportFuel({ reserve: fuelReserve, liquidFuel, gasoline });
  const autoTransportPerSecond = D(0.1).mul(platforms.length);

  const handleBuyFuel = (amount: number) => {
    const cost = amount * 10; // 10 кредитов за единицу, см. buyFuel в сторе
    if (credits.lt(cost)) {
      notify.warning(`Недостаточно кредитов! Нужно ${formatNumber(cost)}`);
      return;
    }
    useGameStore.getState().buyFuel(amount);
    notify.success(`Куплено ${formatNumber(amount)} ед. топлива`);
  };

  const handleCreatePlatform = () => {
    const cost = {
      credits: 50000,
      influence: 1000,
    };

    if (credits.lt(cost.credits)) {
      notify.warning(`Недостаточно кредитов! Требуется: ${formatNumber(cost.credits)}`);
      return;
    }

    if (influence.lt(cost.influence)) {
      notify.warning(`Недостаточно влияния! Требуется: ${formatNumber(cost.influence)}`);
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
      notify.warning(`Недостаточно кредитов! Требуется: ${formatNumber(cost)}`);
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
          <h2 className="text-xl font-bold text-white"><GameIcon icon="🛰️" /> Платформы</h2>
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
            <div className="text-2xl"><GameIcon icon="🚀" /></div>
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
          <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-400">
            Расход: 0.1 ед. топлива в секунду за каждую платформу — сейчас{' '}
            <span className="text-cyan-400">{formatNumber(autoTransportPerSecond)}/сек</span>.
            Энергия платформы не вывозится: она нужна её же зданиям.
          </div>
        )}
      </div>

      {/* ——— Топливо перевозок: одно на караваны и авто-транспорт ——— */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-white flex items-center gap-2">
              <GameIcon icon="⛽" /> Топливо перевозок
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              Его жгут и караваны, и авто-транспортировка. Списывается по порядку:
              резерв → жидкое топливо → бензин.
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">Всего</div>
            <div className={`text-lg font-bold ${totalFuel.lt(10) ? 'text-red-400' : 'text-cyan-400'}`}>
              {formatNumber(totalFuel)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
          <div className="bg-gray-900/50 rounded px-2 py-1.5">
            <div className="text-gray-400">Резерв</div>
            <div className="text-cyan-300 font-semibold">{formatNumber(fuelReserve)}</div>
          </div>
          <div className="bg-gray-900/50 rounded px-2 py-1.5">
            <div className="text-gray-400">{resourceLabel('liquid_fuel')}</div>
            <div className="text-cyan-300 font-semibold">{formatNumber(liquidFuel)}</div>
          </div>
          <div className="bg-gray-900/50 rounded px-2 py-1.5">
            <div className="text-gray-400">{resourceLabel('gasoline')}</div>
            <div className="text-cyan-300 font-semibold">{formatNumber(gasoline)}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => handleBuyFuel(100)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-all"
          >
            +100 (1 000<GameIcon icon="💰" />)
          </button>
          <button
            onClick={() => handleBuyFuel(1000)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-all"
          >
            +1 000 (10 000<GameIcon icon="💰" />)
          </button>
          <span className="text-xs text-gray-500">10<GameIcon icon="💰" /> за единицу</span>
        </div>

        {totalFuel.lt(10) && (
          <div className="mt-3 text-xs text-amber-300 bg-amber-900/20 border border-amber-700/40 rounded p-2">
            Топлива почти нет — караваны отправить не получится, а авто-транспорт остановится.
            Резерв покупается за кредиты и доступен на любой карте: жидкое топливо и бензин
            делаются из нефти, а нефтяной жилы может не быть вовсе (например, на «Бесплодной Луне»).
          </div>
        )}
      </div>

      {/* Create Platform Button */}
      <button
        onClick={handleCreatePlatform}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
      >
        <span className="text-xl"><GameIcon icon="➕" /></span>
        <span>Построить новую платформу</span>
        <span className="text-xs opacity-75">(50,000 <GameIcon icon="💰" /> + 1,000 <GameIcon icon="🏛️" />)</span>
      </button>

      {/* Platforms List */}
      {platformsInCurrentGalaxy.length === 0 ? (
        <div className="bg-gray-800/30 rounded-lg p-8 text-center border border-gray-700">
          <div className="text-4xl mb-3"><GameIcon icon="🛸" /></div>
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
              onManage={setActivePlatform}
              calculateCost={calculateUpgradeCost}
              getUpgradeLabel={getUpgradeLabel}
              getUpgradeIcon={getUpgradeIcon}
              isActive={activePlatformId === platform.id}
            />
          ))}
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
        <div className="text-sm text-blue-300">
          <div className="font-semibold mb-2"><GameIcon icon="ℹ️" /> Информация о платформах</div>
          <ul className="space-y-1 text-xs text-blue-200/80">
            <li>• Нажмите кнопку <Settings className="inline" size={12} /> чтобы начать управлять платформой</li>
            <li>• Платформа — маленькая база: у неё своя сетка, свой склад и <b>своя энергосеть</b></li>
            <li>• Стройматериалы берутся со склада ГЛАВНОЙ БАЗЫ, а сырьё для работы зданий — со склада платформы</li>
            <li>• Без электростанции на самой платформе её здания стоять будут: энергия с базы не передаётся</li>
            <li>• Перерабатывающему заводу нужны входы — их привозят караваном или добывают тут же</li>
            <li>• Улучшение "Добыча" увеличивает скорость добычи на 50% за уровень</li>
            <li>• Улучшение "Защита" увеличивает HP (+50%), броню (+40%) и щиты (+50%, реген +30%) за уровень</li>
            <li>• Улучшение "Хранилище" увеличивает вместимость склада на 50% за уровень</li>
            <li>• При включенной авто-транспортировке ресурсы доставляются на главную станцию (10%/сек) за топливо</li>
            <li>• Постройте турели и радары на платформах для защиты от атак</li>
            <li>• Ресурсы платформы учитывают бонусы галактики, в которой она находится</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Энергобаланс платформы и разбор простоя (bigplan.md, пункт 45).
 *
 * До этого платформа была чёрным ящиком: ресурсы либо росли, либо нет, и почему — не
 * сообщалось нигде. А поскольку платформенные здания раньше работали без энергии и без
 * сырья вообще, любое объяснение было бы враньём. Теперь правила те же, что на базе, и
 * панель называет причину каждой вставшей клетки.
 */
function PlatformStatusBlock({ platform }: { platform: SpacePlatform }) {
  const status = platform.status;
  const tileCount = Object.keys(platform.grid.tiles ?? {}).length;

  if (tileCount === 0) {
    return (
      <div className="mb-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700 text-xs text-gray-400">
        Сетка платформы пуста. Нажмите <Settings className="inline" size={12} />, чтобы перейти на
        неё и построить добытчики — и обязательно электростанцию: энергия у платформы своя.
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const efficiencyPercent = Math.round(status.energyEfficiency * 100);
  const deficit = status.energyConsumption > status.energyProduction;

  const problems: string[] = [];
  if (status.noPower > 0) problems.push(`без энергии — ${status.noPower}`);
  if (status.noInput > 0) problems.push(`без сырья — ${status.noInput}`);
  if (status.noDeposit > 0) problems.push(`не на своей жиле — ${status.noDeposit}`);
  if (status.storageFull > 0) problems.push(`склад полон — ${status.storageFull}`);
  if (status.building > 0) problems.push(`строится — ${status.building}`);

  return (
    <div className="mb-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700 space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400"><GameIcon icon="⚡" /> Энергия платформы:</span>
        <span className={deficit ? 'text-amber-300 font-semibold' : 'text-green-400 font-semibold'}>
          {formatNumber(D(status.energyProduction))} / {formatNumber(D(status.energyConsumption))} ⚡/с
          {deficit ? ` · ${efficiencyPercent}% мощности` : ''}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">Работают:</span>
        <span className="text-green-400 font-semibold">
          {status.working} из {tileCount}
        </span>
      </div>

      {problems.length > 0 && (
        <div className="text-xs text-gray-400">Простаивают: {problems.join(', ')}</div>
      )}

      {status.noPower > 0 && (
        <div className="text-xs text-amber-300 bg-amber-900/20 border border-amber-700/40 rounded p-2">
          Зданиям не хватает энергии. Постройте на платформе электростанцию — с базы энергия
          не передаётся.
        </div>
      )}

      {status.missingInputs.length > 0 && (
        <div className="text-xs text-amber-300 bg-amber-900/20 border border-amber-700/40 rounded p-2">
          Не хватает сырья: {status.missingInputs.slice(0, 4).map(resourceLabel).join(', ')}
          {status.missingInputs.length > 4 ? ' и др.' : ''}. Привезите его караваном в разделе
          «Логистика» или добывайте на самой платформе.
        </div>
      )}

      {status.storageFull > 0 && (
        <div className="text-xs text-gray-400">
          Склад платформы заполнен — включите авто-транспортировку, отправьте караван или
          прокачайте «Хранилище».
        </div>
      )}
    </div>
  );
}

interface PlatformCardProps {
  platform: SpacePlatform;
  onUpgrade: (platformId: string, upgradeType: 'defense' | 'mining' | 'storage') => void;
  onRemove: (platformId: string) => void;
  onRepair: (platformId: string, repairType: 'hull' | 'armor' | 'shield' | 'all') => void;
  onManage: (platformId: string | null) => void;
  calculateCost: (currentLevel: number, upgradeType: string) => number;
  getUpgradeLabel: (type: 'defense' | 'mining' | 'storage') => string;
  getUpgradeIcon: (type: 'defense' | 'mining' | 'storage') => React.ComponentType<any>;
  isActive: boolean;
}

function PlatformCard({ platform, onUpgrade, onRemove, onRepair, onManage, calculateCost, getUpgradeLabel, getUpgradeIcon, isActive }: PlatformCardProps) {
  // Ensure all platform values are Decimal objects
  const hp = D(platform.hp);
  const maxHp = D(platform.maxHp);
  const shieldHp = D(platform.shieldHp);
  const shieldMaxHp = D(platform.shieldMaxHp);
  const armor = D(platform.armor);
  const maxArmor = D(platform.maxArmor);
  
  const hpPercent = hp.div(maxHp).mul(100).toNumber();
  const shieldPercent = shieldMaxHp.gt(0) 
    ? shieldHp.div(shieldMaxHp).mul(100).toNumber() 
    : 0;
  const armorPercent = maxArmor.gt(0)
    ? armor.div(maxArmor).mul(100).toNumber()
    : 0;

  const defenseLevel = platform.upgrades?.defense || 0;
  const miningLevel = platform.upgrades?.mining || 0;
  const storageLevel = platform.upgrades?.storage || 0;

  return (
    <div className={`bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-lg p-5 border transition-all ${
      isActive ? 'border-cyan-500 shadow-elev-3 shadow-cyan-500/20' : 'border-gray-700 hover:border-gray-600'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span><GameIcon icon="🛰️" /></span>
            <span>{platform.name}</span>
            {isActive && (
              <span className="bg-cyan-500 text-white text-[10px] px-1.5 py-0.5 rounded">
                АКТИВНА
              </span>
            )}
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            ID: {platform.id.slice(0, 12)}...
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onManage(isActive ? null : platform.id)}
            className={`p-2 rounded transition-all ${
              isActive 
                ? 'bg-cyan-600 hover:bg-cyan-700 text-white' 
                : 'text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/20'
            }`}
            title={isActive ? 'Вернуться на главную базу' : 'Управление платформой'}
          >
            <Settings size={18} />
          </button>
          <button
            onClick={() => {
              // Платформа стоит 50 000 ₡ и 1 000 влияния, возврата нет, а кнопка стоит
              // вплотную к «управлять». Один вопрос дешевле потерянной платформы.
              if (confirm(`Удалить платформу «${platform.name}»? Постройки и всё, что лежит на её складе, пропадут без возврата.`)) {
                onRemove(platform.id);
              }
            }}
            className="text-red-400 hover:text-red-300 p-2 hover:bg-red-900/20 rounded transition-all"
            title="Удалить платформу"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* ——— Что происходит на платформе прямо сейчас (bigplan.md, пункт 45) ——— */}
      <PlatformStatusBlock platform={platform} />

      {/* Platform Resources */}
      {platform.resources && Object.keys(platform.resources).length > 0 && (
        <div className="mb-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
          <div className="text-xs text-gray-400 mb-2 font-semibold"><GameIcon icon="📦" /> Ресурсы на платформе:</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(platform.resources)
              .filter(([_, res]) => res && res.amount && res.amount.gt(0))
              .slice(0, 6)
              .map(([resType, res]) => (
                <div key={resType} className="flex items-center justify-between bg-gray-800/50 px-2 py-1 rounded">
                  <span className="text-gray-300">{resType}:</span>
                  <span className="text-green-400 font-semibold">
                    {formatNumber(res!.amount)}
                  </span>
                </div>
              ))}
          </div>
          {Object.entries(platform.resources).filter(([_, res]) => res && res.amount && res.amount.gt(0)).length > 6 && (
            <div className="text-xs text-gray-500 mt-2 text-center">
              +{Object.entries(platform.resources).filter(([_, res]) => res && res.amount && res.amount.gt(0)).length - 6} ещё
            </div>
          )}
        </div>
      )}

      {/* Health Bars */}
      <div className="space-y-2 mb-4">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-400">HP</span>
            <span className="text-white font-mono">
              {formatNumber(hp)} / {formatNumber(maxHp)}
            </span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all"
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>

        {maxArmor.gt(0) && (
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-400">Броня</span>
              <span className="text-orange-400 font-mono">
                {formatNumber(armor)} / {formatNumber(maxArmor)}
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

        {shieldMaxHp.gt(0) && (
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-400">Щиты</span>
              <span className="text-cyan-400 font-mono">
                {formatNumber(shieldHp)} / {formatNumber(shieldMaxHp)}
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
            <span>Ремонт (10<GameIcon icon="💰" />/HP, 5<GameIcon icon="💰" />/броня, 3<GameIcon icon="💰" />/щиты)</span>
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
            {maxArmor.gt(0) && armorPercent < 100 && (
              <button
                onClick={() => onRepair(platform.id, 'armor')}
                className="bg-orange-900/30 hover:bg-orange-900/50 border border-orange-700/50 hover:border-orange-600 rounded px-2 py-1.5 text-xs text-orange-300 transition-all"
              >
                Броня
              </button>
            )}
            {shieldMaxHp.gt(0) && shieldPercent < 100 && (
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
          
          // Описания для каждого типа улучшения
          const getUpgradeDescription = (type: 'defense' | 'mining' | 'storage', lvl: number) => {
            switch (type) {
              case 'defense':
                return `Увеличивает HP, броню и щит платформы.\nТекущий бонус: +${(lvl * 50)}% к защите`;
              case 'mining':
                return `Ускоряет добычу ресурсов зданиями на платформе.\nТекущий бонус: +${(lvl * 50)}% к скорости добычи`;
              case 'storage':
                return `Увеличивает максимальное хранилище ресурсов.\nТекущий бонус: +${(lvl * 50)}% к вместимости`;
            }
          };

          return (
            <button
              key={upgradeType}
              onClick={() => onUpgrade(platform.id, upgradeType)}
              className="bg-gray-700/50 hover:bg-gray-700 border border-gray-600 hover:border-gray-500 rounded-lg p-3 transition-all group"
              title={getUpgradeDescription(upgradeType, level)}
            >
              <div className="flex flex-col items-center gap-1">
                <Icon className="text-gray-400 group-hover:text-white transition-colors" size={20} />
                <div className="text-xs text-gray-300">{label}</div>
                <div className="text-sm font-bold text-white">Ур. {level}</div>
                <div className="text-xs text-cyan-400">
                  <TrendingUp className="inline" size={12} />
                  {formatNumber(cost)}<GameIcon icon="💰" />
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
            <span><GameIcon icon="🛡️" /> Бонус защиты:</span>
            <span className="text-purple-400 font-semibold">
              +{(defenseLevel * 50)}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span><GameIcon icon="⚡" /> Бонус добычи:</span>
            <span className="text-green-400 font-semibold">
              +{(miningLevel * 50)}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span><GameIcon icon="📦" /> Бонус хранилища:</span>
            <span className="text-blue-400 font-semibold">
              +{(storageLevel * 50)}%
            </span>
          </div>
        </div>
        
        {/* Combat Status */}
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="text-xs text-gray-400 space-y-1">
            <div className="flex items-center justify-between">
              <span>Статус:</span>
              <span className={platform.combat.underAttack ? "text-red-400 font-semibold animate-pulse" : "text-green-400"}>
                <IconText>{platform.combat.underAttack ? "⚠️ ПОД АТАКОЙ" : "🛡️ В БЕЗОПАСНОСТИ"}</IconText>
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
            {platform.shieldRegenRate && D(platform.shieldRegenRate).gt(0) && (
              <div className="flex items-center justify-between">
                <span>Реген щитов:</span>
                <span className="text-cyan-300">
                  +{formatNumber(D(platform.shieldRegenRate))}/с
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
