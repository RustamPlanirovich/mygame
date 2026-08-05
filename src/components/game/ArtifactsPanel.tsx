import { useGameStore } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format';
import { 
  ARTIFACT_RARITY_CONFIGS,
  getRarityName,
  getEffectDescription,
  getUpgradeCost,
  getEffectMultiplier,
  calculateUsedSlots,
  canEquipArtifact,
} from '../../utils/artifactHelpers';
import type { Artifact, ArtifactRarity } from '../../core/gameTypes';
import { Sparkles, TrendingUp, Lock, Unlock } from 'lucide-react';
import { useState } from 'react';
import { GameIcon, IconText } from '../ui/icons';

type FilterType = 'all' | ArtifactRarity;

export function ArtifactsPanel() {
  const { 
    artifacts,
    currency,
    prestige,
    ascension,
    equipArtifact,
    unequipArtifact,
    upgradeArtifact,
  } = useGameStore();

  const [filter, setFilter] = useState<FilterType>('all');

  const filteredArtifacts = artifacts.discovered.filter(artifact => 
    filter === 'all' || artifact.rarity === filter
  );

  const equippedArtifacts = artifacts.discovered.filter(a => 
    artifacts.equipped.includes(a.id)
  );

  const unequippedArtifacts = filteredArtifacts.filter(a => 
    !artifacts.equipped.includes(a.id)
  );

  const usedSlots = calculateUsedSlots(artifacts.discovered, artifacts.equipped);
  const availableSlots = artifacts.maxSlots - usedSlots;

  // Сортировка: редкие первыми
  const rarityOrder: Record<ArtifactRarity, number> = {
    mythic: 5,
    legendary: 4,
    epic: 3,
    rare: 2,
    common: 1,
  };
  
  unequippedArtifacts.sort((a, b) => 
    rarityOrder[b.rarity] - rarityOrder[a.rarity]
  );

  const renderArtifactCard = (artifact: Artifact, isEquipped: boolean) => {
    const config = ARTIFACT_RARITY_CONFIGS[artifact.rarity];
    const cost = getUpgradeCost(artifact);
    const multiplier = getEffectMultiplier(artifact);
    const canUpgrade = artifact.level < artifact.maxLevel && 
      currency.credits.gte(cost.credits) &&
      (!cost.qp || prestige.availableQuantumPoints >= cost.qp.toNumber()) &&
      (!cost.ap || ascension.ascensionPoints >= cost.ap.toNumber());
    
    const canEquip = !isEquipped && canEquipArtifact(
      artifact,
      artifacts.equipped,
      artifacts.discovered,
      artifacts.maxSlots
    );

    return (
      <div
        key={artifact.id}
        className="p-4 rounded-lg border-2 transition-all hover:scale-105"
        style={{ 
          borderColor: config.color,
          backgroundColor: `${config.color}15`,
        }}
      >
        {/* Заголовок */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h4 className="font-bold text-sm mb-1" style={{ color: config.color }}>
              {artifact.name}
            </h4>
            {artifact.description && (
              <p className="text-xs text-gray-400"><IconText>{artifact.description}</IconText></p>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2">
            <Sparkles size={14} style={{ color: config.color }} />
            <span className="text-xs font-bold" style={{ color: config.color }}>
              {getRarityName(artifact.rarity)}
            </span>
          </div>
        </div>

        {/* Уровень */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 bg-gray-700 rounded-full h-2">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(artifact.level / artifact.maxLevel) * 100}%`,
                backgroundColor: config.color,
              }}
            />
          </div>
          <span className="text-xs text-gray-300">
            Ур. {artifact.level}/{artifact.maxLevel}
          </span>
        </div>

        {/* Эффекты */}
        <div className="space-y-1 mb-3">
          {artifact.effects.map((effect, idx) => (
            <div key={idx} className="text-xs text-gray-300 flex items-center gap-1">
              <TrendingUp size={12} className="text-green-400" />
              <span>{getEffectDescription(effect)}</span>
              {artifact.level > 0 && (
                <span className="text-yellow-400">
                  (×{multiplier.toFixed(1)})
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Слоты */}
        <div className="text-xs text-gray-400 mb-3">
          Требуется слотов: {artifact.slotsRequired}
        </div>

        {/* Действия */}
        <div className="flex gap-2">
          {/* Кнопка экипировки */}
          {isEquipped ? (
            <button
              onClick={() => unequipArtifact(artifact.id)}
              className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1"
            >
              <Unlock size={14} />
              Снять
            </button>
          ) : (
            <button
              onClick={() => equipArtifact(artifact.id)}
              disabled={!canEquip}
              className={`flex-1 px-3 py-2 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1 ${
                canEquip 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-gray-600 cursor-not-allowed opacity-50'
              }`}
            >
              <Lock size={14} />
              {canEquip ? 'Экипировать' : 'Нет места'}
            </button>
          )}

          {/* Кнопка улучшения */}
          {artifact.level < artifact.maxLevel && (
            <button
              onClick={() => upgradeArtifact(artifact.id)}
              disabled={!canUpgrade}
              className={`flex-1 px-3 py-2 rounded text-xs font-bold transition-colors ${
                canUpgrade 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-gray-600 cursor-not-allowed opacity-50'
              }`}
              title={`Улучшить: ${formatNumber(cost.credits)} кредитов${
                cost.qp ? `, ${formatNumber(cost.qp)} QP` : ''
              }${cost.ap ? `, ${cost.ap.toFixed(0)} AP` : ''}`}
            >
              <GameIcon icon="↑" /> Улучшить
            </button>
          )}
        </div>

        {/* Стоимость улучшения */}
        {artifact.level < artifact.maxLevel && (
          <div className="mt-2 text-xs text-gray-400 space-y-0.5">
            <div><GameIcon icon="💰" /> {formatNumber(cost.credits)}</div>
            {cost.qp && <div><GameIcon icon="⚛️" /> {formatNumber(cost.qp)} QP</div>}
            {cost.ap && <div><GameIcon icon="✨" /> {cost.ap.toFixed(0)} AP</div>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col gap-3 p-3 bg-gray-900/50 rounded-lg overflow-y-auto">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-purple-400 flex items-center gap-1.5">
          <Sparkles size={18} />
          Артефакты
        </h2>
        <div className="text-right">
          <div className="text-sm text-gray-300">
            Найдено: {artifacts.totalFound}
          </div>
          <div className="text-sm text-gray-300">
            Улучшено: {artifacts.totalUpgraded}
          </div>
        </div>
      </div>

      {/* Информация о слотах */}
      <div className="p-4 bg-gray-800 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-gray-300">Слоты артефактов</span>
          <span className="text-lg font-bold text-purple-400">
            {usedSlots} / {artifacts.maxSlots}
          </span>
        </div>
        <div className="bg-gray-700 rounded-full h-3">
          <div
            className="bg-purple-500 h-full rounded-full transition-all"
            style={{ width: `${(usedSlots / artifacts.maxSlots) * 100}%` }}
          />
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Доступно слотов: {availableSlots}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          <GameIcon icon="💡" /> Получайте +1 слот за каждые 5 вознесений
        </div>
      </div>

      {/* Экипированные артефакты */}
      {equippedArtifacts.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-green-400 mb-2 flex items-center gap-2">
            <Lock size={18} />
            Экипированные ({equippedArtifacts.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {equippedArtifacts.map(artifact => renderArtifactCard(artifact, true))}
          </div>
        </div>
      )}

      {/* Фильтры */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
            filter === 'all' 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Все ({artifacts.discovered.length})
        </button>
        {(['mythic', 'legendary', 'epic', 'rare', 'common'] as ArtifactRarity[]).map(rarity => {
          const count = artifacts.discovered.filter(a => a.rarity === rarity).length;
          if (count === 0) return null;
          
          const config = ARTIFACT_RARITY_CONFIGS[rarity];
          return (
            <button
              key={rarity}
              onClick={() => setFilter(rarity)}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                filter === rarity 
                  ? 'text-white' 
                  : 'text-gray-300 hover:opacity-80'
              }`}
              style={{ 
                backgroundColor: filter === rarity ? config.color : `${config.color}40`,
              }}
            >
              {getRarityName(rarity)} ({count})
            </button>
          );
        })}
      </div>

      {/* Инвентарь */}
      <div className="flex-1">
        <h3 className="text-lg font-bold text-gray-300 mb-2">
          Инвентарь ({unequippedArtifacts.length})
        </h3>
        
        {unequippedArtifacts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {filter === 'all' 
              ? 'У вас пока нет артефактов. Открывайте процедурные галактики для их получения!'
              : `Нет артефактов редкости "${getRarityName(filter)}"`
            }
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {unequippedArtifacts.map(artifact => renderArtifactCard(artifact, false))}
          </div>
        )}
      </div>

      {/* Подсказка */}
      {artifacts.discovered.length === 0 && (
        <div className="p-4 bg-blue-900/30 border border-blue-500/50 rounded-lg">
          <h4 className="font-bold text-blue-400 mb-2"><GameIcon icon="💡" /> Как получить артефакты?</h4>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Открывайте процедурные галактики (5-10% шанс)</li>
            <li>• Выполняйте сложные достижения</li>
            <li>• Получайте награды за вознесения</li>
            <li>• Участвуйте в случайных событиях</li>
          </ul>
        </div>
      )}
    </div>
  );
}
