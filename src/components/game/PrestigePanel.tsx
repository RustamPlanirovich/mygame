import { useGameStore } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format';
import { PRESTIGE_UPGRADES, canBuyPrestigeUpgrade, getTotalPrestigeBonuses } from '../../core/constants/prestige';
import type { PrestigeUpgradeId } from '../../core/gameTypes';
import { RotateCcw, Zap, Star, Info } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Modal } from '../ui';

type TabType = 'prestige' | 'ascension';

export function PrestigePanel() {
  const { 
    prestige,
    ascension,
    calculatePrestigeGain, 
    performPrestige, 
    buyPrestigeUpgrade,
    toggleFastMode,
    checkAscensionRequirements,
    calculateAscensionGain,
    performAscension,
  } = useGameStore();

  const [activeTab, setActiveTab] = useState<TabType>('prestige');
  const [selectedUpgrade, setSelectedUpgrade] = useState<PrestigeUpgradeId | null>(null);

  /*
   * Панель подписана на весь стор (`useGameStore()` без селектора), поэтому
   * перерисовывается на каждом тике — ~20 раз в секунду. Инлайновая стрелка в onClose
   * была бы новой ссылкой на каждый такой рендер и заставляла бы Modal перерисовываться
   * вхолостую вместе с панелью. Ссылка должна быть одна на всё время жизни панели.
   */
  const closeUpgrade = useCallback(() => setSelectedUpgrade(null), []);

  const quantumGain = calculatePrestigeGain();
  const totalBonuses = getTotalPrestigeBonuses(prestige);
  const canAscend = checkAscensionRequirements();
  const ascensionGain = calculateAscensionGain();

  // Группируем улучшения по tier
  const upgradesByTier = {
    1: [] as PrestigeUpgradeId[],
    2: [] as PrestigeUpgradeId[],
    3: [] as PrestigeUpgradeId[],
    4: [] as PrestigeUpgradeId[],
  };

  (Object.keys(PRESTIGE_UPGRADES) as PrestigeUpgradeId[]).forEach(id => {
    const upgrade = PRESTIGE_UPGRADES[id];
    upgradesByTier[upgrade.tier].push(id);
  });

  const renderUpgrade = (upgradeId: PrestigeUpgradeId) => {
    const upgrade = PRESTIGE_UPGRADES[upgradeId];
    const currentLevel = prestige.upgrades[upgradeId] || 0;
    const cost = upgrade.cost * (currentLevel + 1);
    const check = canBuyPrestigeUpgrade(upgradeId, prestige);
    const maxed = currentLevel >= upgrade.maxLevel;

    return (
      <div
        key={upgradeId}
        className={`border rounded-lg p-2.5 cursor-pointer hover:border-cyan-400 transition-all ${
          maxed
            ? 'border-green-500/50 bg-green-900/20'
            : check.canBuy
            ? 'border-blue-500/50 bg-blue-900/20'
            : 'border-gray-600 bg-gray-800/50 opacity-60'
        }`}
        onClick={() => setSelectedUpgrade(upgradeId)}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-xl flex-shrink-0">{upgrade.icon}</span>
            <h4 className="text-sm font-bold text-white truncate">{upgrade.name}</h4>
            <Info size={14} className="text-gray-400 flex-shrink-0" />
          </div>
          
          {currentLevel > 0 && (
            <div className="ml-1.5 px-1.5 py-0.5 bg-blue-600 rounded text-white text-[10px] font-bold flex-shrink-0">
              Lv {currentLevel}/{upgrade.maxLevel}
            </div>
          )}
        </div>

        <p className="text-[11px] text-gray-400 mb-2 line-clamp-2">{upgrade.description}</p>

        {/* Кнопки действий */}
        {!maxed ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (check.canBuy) buyPrestigeUpgrade(upgradeId);
            }}
            disabled={!check.canBuy}
            className={`w-full px-2 py-1.5 rounded font-bold text-[11px] transition-all ${
              check.canBuy
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {check.canBuy ? `Купить за ${cost} QP` : (check.reason || 'Недоступно')}
          </button>
        ) : (
          <div className="text-center py-1.5">
            <span className="text-green-400 font-bold text-[11px]">✓ Максимальный уровень</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-2.5 space-y-2.5">
      {/* Вкладки */}
      <div className="flex gap-1 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('prestige')}
          className={`px-3 py-1.5 font-bold transition-all text-[11px] ${
            activeTab === 'prestige'
              ? 'border-b-2 border-cyan-400 text-cyan-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <RotateCcw size={12} className="inline mr-1" />
          Престиж
        </button>
        <button
          onClick={() => setActiveTab('ascension')}
          className={`px-3 py-1.5 font-bold transition-all text-[11px] ${
            activeTab === 'ascension'
              ? 'border-b-2 border-purple-400 text-purple-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Star size={12} className="inline mr-1" />
          Вознесение
        </button>
      </div>

      {/* Контент вкладки Престиж */}
      {activeTab === 'prestige' && (
        <>
          {/* Заголовок и статистика */}
          <div className="cyber-panel p-2">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-bold text-white flex items-center gap-1">
                <RotateCcw className="text-cyan-400" size={14} />
                <span>Престиж</span>
              </h2>
              
              {prestige.upgrades['quantum_fast_mode'] && (
                <button
                  onClick={toggleFastMode}
                  className={`px-2 py-1 rounded font-bold transition-all text-[10px] ${
                    prestige.fastModeEnabled
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                      : 'bg-gray-600 hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  <Zap size={12} className="inline mr-0.5" />
                  {prestige.fastModeEnabled ? 'Fast Mode: ON' : 'Fast Mode: OFF'}
                </button>
              )}
            </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
          <div className="text-center">
            <p className="text-[10px] text-gray-400">Quantum Points</p>
            <p className="text-base font-bold text-cyan-400">{prestige.availableQuantumPoints}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-400">Всего QP</p>
            <p className="text-base font-bold text-purple-400">{prestige.lifetimeQuantumPoints}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-400">Престижей</p>
            <p className="text-base font-bold text-blue-400">{prestige.prestigeCount}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-400">Концовок</p>
            <p className="text-base font-bold text-yellow-400">{prestige.stats.endingsAchieved.length}/4</p>
          </div>
        </div>

        {/* Текущие бонусы */}
        <div className="border-t border-gray-700 pt-2">
          <h3 className="text-sm font-bold text-white mb-1">Активные Бонусы:</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1 text-[10px]">
            <div className="text-green-400">
              📦 Производство: x{totalBonuses.productionMultiplier.toFixed(2)}
            </div>
            <div className="text-purple-400">
              🔬 Исследования: x{totalBonuses.researchMultiplier.toFixed(2)}
            </div>
            <div className="text-yellow-400">
              ⚡ Энергия: -{totalBonuses.energyEfficiency.toFixed(0)}%
            </div>
            <div className="text-cyan-400">
              🏗️ Стоимость: -{totalBonuses.buildingCostReduction.toFixed(0)}%
            </div>
            {totalBonuses.gameSpeedMultiplier > 1 && (
              <div className="text-orange-400">
                ⏩ Скорость: x{totalBonuses.gameSpeedMultiplier.toFixed(1)}
              </div>
            )}
            {totalBonuses.resourceRetention > 0 && (
              <div className="text-blue-400">
                💾 Сохранение: {totalBonuses.resourceRetention.toFixed(0)}%
              </div>
            )}
          </div>
        </div>

        {/* Кнопка престижа */}
        <div className="mt-2 p-2 bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-lg">
          <p className="text-white text-center mb-1 text-[11px]">
            При престиже вы получите: <span className="font-bold text-cyan-400">{quantumGain} Quantum Points</span>
          </p>
          <p className="text-[10px] text-gray-400 text-center mb-2">
            Прогресс будет сброшен, но престиж-улучшения сохранятся
          </p>
          <button
            onClick={performPrestige}
            disabled={quantumGain <= 0}
            className={`w-full px-4 py-2 rounded-lg font-bold text-sm transition-all ${
              quantumGain > 0
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white animate-pulse'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            ✨ ПРЕСТИЖ ✨
          </button>
        </div>
      </div>

      {/* Tier 1: Базовые улучшения */}
      <div>
        <h3 className="text-sm font-bold text-white mb-1.5">Tier 1: Базовые Улучшения</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {upgradesByTier[1].map(renderUpgrade)}
        </div>
      </div>

      {/* Tier 2: Продвинутые */}
      <div>
        <h3 className="text-sm font-bold text-white mb-1.5">Tier 2: Продвинутые Улучшения</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {upgradesByTier[2].map(renderUpgrade)}
        </div>
      </div>

      {/* Tier 3: Мощные */}
      <div>
        <h3 className="text-sm font-bold text-white mb-1.5">Tier 3: Мощные Улучшения</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {upgradesByTier[3].map(renderUpgrade)}
        </div>
      </div>

      {/* Tier 4: Ультимативные */}
      <div>
        <h3 className="text-sm font-bold text-white mb-1.5">Tier 4: Ультимативные и Награды</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {upgradesByTier[4].map(renderUpgrade)}
        </div>
      </div>
        </>
      )}

      {/* Контент вкладки Ascension */}
      {activeTab === 'ascension' && (
        <div className="space-y-2.5">
          {/* Заголовок */}
          <div className="cyber-panel p-2">
            <h2 className="text-base font-bold text-white flex items-center gap-1 mb-2">
              <Star className="text-purple-400" size={14} />
              <span>Вознесение</span>
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
              <div className="text-center">
                <p className="text-[10px] text-gray-400">Ascension Points</p>
                <p className="text-base font-bold text-purple-400">{ascension.ascensionPoints}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-400">Всего AP</p>
                <p className="text-base font-bold text-pink-400">{ascension.lifetimeAscensionPoints}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-400">Вознесений</p>
                <p className="text-base font-bold text-cyan-400">{ascension.ascensionCount}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-400">Престижей</p>
                <p className="text-base font-bold text-blue-400">{prestige.prestigeCount}</p>
              </div>
            </div>

            {/* Текущие множители */}
            <div className="border-t border-gray-700 pt-2">
              <h3 className="text-sm font-bold text-white mb-1">Бонусы Вознесения:</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1 text-[10px]">
                <div className="text-cyan-400">
                  🌀 QP Gain: x{ascension.multipliers.qpGain.toFixed(2)}
                </div>
                <div className="text-green-400">
                  📦 Производство: x{ascension.multipliers.globalProduction.toFixed(2)}
                </div>
                <div className="text-purple-400">
                  🔬 Исследования: x{ascension.multipliers.researchSpeed.toFixed(2)}
                </div>
                <div className="text-yellow-400">
                  💰 Стартовые кредиты: +{formatNumber(ascension.multipliers.startingCredits)}
                </div>
              </div>
            </div>

            {/* Разблокировки */}
            <div className="mt-2 border-t border-gray-700 pt-2">
              <h3 className="text-sm font-bold text-white mb-1">Разблокированные Системы:</h3>
              <div className="space-y-0.5 text-[10px]">
                <div className={ascension.unlocks.infiniteResearch ? 'text-green-400' : 'text-gray-500'}>
                  {ascension.unlocks.infiniteResearch ? '✓' : '✗'} Бесконечные Исследования (1+ вознесение)
                </div>
                <div className={ascension.unlocks.buildingEvolution ? 'text-green-400' : 'text-gray-500'}>
                  {ascension.unlocks.buildingEvolution ? '✓' : '✗'} Эволюция Зданий (2+ вознесений)
                </div>
                <div className={ascension.unlocks.proceduralGalaxies ? 'text-green-400' : 'text-gray-500'}>
                  {ascension.unlocks.proceduralGalaxies ? '✓' : '✗'} Процедурные Галактики (3+ вознесений)
                </div>
              </div>
            </div>
          </div>

          {/* Требования */}
          <div className="cyber-panel p-2">
            <h3 className="text-sm font-bold text-white mb-1.5">Требования для Вознесения:</h3>
            <div className="space-y-0.5 text-[10px]">
              <div className={prestige.prestigeCount >= 10 ? 'text-green-400' : 'text-red-400'}>
                {prestige.prestigeCount >= 10 ? '✓' : '✗'} 10+ Престижей ({prestige.prestigeCount}/10)
              </div>
              <div className={prestige.lifetimeQuantumPoints >= 1000000 ? 'text-green-400' : 'text-red-400'}>
                {prestige.lifetimeQuantumPoints >= 1000000 ? '✓' : '✗'} 1M+ Lifetime QP ({formatNumber(prestige.lifetimeQuantumPoints)}/1M)
              </div>
              <div className="text-gray-400">
                ✓ Все мегаструктуры построены (проверка в игре)
              </div>
            </div>
          </div>

          {/* Кнопка Вознесения */}
          <div className="cyber-panel p-2 bg-gradient-to-r from-purple-900/50 to-pink-900/50">
            <p className="text-white text-center mb-1 text-[11px]">
              При вознесении вы получите: <span className="font-bold text-purple-400">{ascensionGain} Ascension Points</span>
            </p>
            <p className="text-[10px] text-red-400 text-center mb-1 font-bold">
              ⚠️ ПОЛНЫЙ СБРОС! Все престиж-улучшения и прогресс будут потеряны!
            </p>
            <p className="text-[10px] text-gray-400 text-center mb-2">
              Вы сохраните только Ascension Points и бонусы вознесения
            </p>
            <button
              onClick={performAscension}
              disabled={!canAscend}
              className={`w-full px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                canAscend
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white animate-pulse'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              🌟 ВОЗНЕСЕНИЕ 🌟
            </button>
          </div>
        </div>
      )}

      {/* Модальное окно с информацией об улучшении */}
      {selectedUpgrade &&
        (() => {
          const upgrade = PRESTIGE_UPGRADES[selectedUpgrade];
          const currentLevel = prestige.upgrades[selectedUpgrade] || 0;
          const cost = upgrade.cost * (currentLevel + 1);
          const check = canBuyPrestigeUpgrade(selectedUpgrade, prestige);
          const maxed = currentLevel >= upgrade.maxLevel;

          return (
            <Modal
              open
              onClose={closeUpgrade}
              size="sm"
              icon={<span className="text-2xl leading-none">{upgrade.icon}</span>}
              title={upgrade.name}
              subtitle={currentLevel > 0 ? `Уровень ${currentLevel}/${upgrade.maxLevel}` : undefined}
            >
              <div className="p-4">
                  <p className="text-sm text-gray-300 mb-4">{upgrade.description}</p>

                  {/* Эффекты */}
                  <div className="mb-4">
                    <h4 className="text-sm font-bold text-cyan-400 mb-2">Эффекты:</h4>
                    <div className="space-y-1.5 text-sm">
                      {upgrade.effects.productionMultiplier && currentLevel > 0 && (
                        <p className="text-green-400">
                          📦 Производство: +{((Math.pow(upgrade.effects.productionMultiplier, currentLevel) - 1) * 100).toFixed(0)}%
                        </p>
                      )}
                      {upgrade.effects.researchMultiplier && currentLevel > 0 && (
                        <p className="text-purple-400">
                          🔬 Исследования: +{((Math.pow(upgrade.effects.researchMultiplier, currentLevel) - 1) * 100).toFixed(0)}%
                        </p>
                      )}
                      {upgrade.effects.energyEfficiency && currentLevel > 0 && (
                        <p className="text-yellow-400">
                          ⚡ Потребление энергии: -{upgrade.effects.energyEfficiency * currentLevel}%
                        </p>
                      )}
                      {upgrade.effects.buildingCostReduction && currentLevel > 0 && (
                        <p className="text-cyan-400">
                          🏗️ Стоимость зданий: -{upgrade.effects.buildingCostReduction * currentLevel}%
                        </p>
                      )}
                      {upgrade.effects.startingCredits && currentLevel > 0 && (
                        <p className="text-green-400">
                          💰 Стартовые кредиты: +{formatNumber(upgrade.effects.startingCredits.mul(currentLevel))}
                        </p>
                      )}
                      {upgrade.effects.startingInfluence && currentLevel > 0 && (
                        <p className="text-yellow-400">
                          👑 Стартовое влияние: +{formatNumber(upgrade.effects.startingInfluence.mul(currentLevel))}
                        </p>
                      )}
                      {upgrade.effects.special && (
                        <p className="text-orange-400 italic">
                          ✨ {upgrade.effects.special}
                        </p>
                      )}
                      {currentLevel === 0 && (
                        <p className="text-gray-500 italic">Купите улучшение, чтобы увидеть эффекты</p>
                      )}
                    </div>
                  </div>

                  {/* Требования */}
                  {upgrade.prerequisites.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-bold text-cyan-400 mb-2">Требует:</h4>
                      <div className="space-y-1">
                        {upgrade.prerequisites.map(id => (
                          <p key={id} className="text-sm text-gray-300">
                            • {PRESTIGE_UPGRADES[id].name}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Кнопка покупки */}
                  {!maxed ? (
                    <button
                      onClick={() => {
                        if (check.canBuy) {
                          buyPrestigeUpgrade(selectedUpgrade);
                          setSelectedUpgrade(null);
                        }
                      }}
                      disabled={!check.canBuy}
                      className={`w-full px-4 py-3 rounded-lg font-bold text-base transition-all ${
                        check.canBuy
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
                          : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {check.canBuy ? `Купить за ${cost} QP` : (check.reason || 'Недоступно')}
                    </button>
                  ) : (
                    <div className="text-center py-3 bg-green-900/30 border border-green-500 rounded-lg">
                      <span className="text-green-400 font-bold text-base">✓ Максимальный уровень достигнут</span>
                    </div>
                  )}
              </div>
            </Modal>
          );
        })()}
    </div>
  );
}

