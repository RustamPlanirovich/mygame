import { useGameStore } from '../../features/gameStore';
import { GALAXIES, canUnlockGalaxy } from '../../core/constants/galaxies';
import type { GalaxyId } from '../../core/gameTypes';
import { formatNumber } from '../../core/math/format';
import { 
  getSpecialFeatureDescription, 
  getSpecialFeatureColor, 
  getDiscoveryCost 
} from '../../utils/galaxyGenerator';

export function GalaxyMap() {
  const currentGalaxyId = useGameStore((s) => s.galaxies.currentGalaxyId);
  const unlockedGalaxies = useGameStore((s) => s.galaxies.unlockedGalaxies);
  const platforms = useGameStore((s) => s.galaxies.platforms);
  const unlockedTechnologies = useGameStore((s) => s.research.technologies);
  const switchGalaxy = useGameStore((s) => s.switchGalaxy);
  const unlockGalaxy = useGameStore((s) => s.unlockGalaxy);
  const influence = useGameStore((s) => s.currency.influence);
  const credits = useGameStore((s) => s.currency.credits);
  
  // Procedural galaxies
  const proceduralGalaxies = useGameStore((s) => s.proceduralGalaxies.galaxies);
  const proceduralUnlocked = useGameStore((s) => s.ascension.unlocks.proceduralGalaxies);
  const generateProceduralGalaxy = useGameStore((s) => s.generateProceduralGalaxy);
  const exploreProceduralGalaxy = useGameStore((s) => s.exploreProceduralGalaxy);

  const galaxyEntries = Object.entries(GALAXIES) as [GalaxyId, typeof GALAXIES[GalaxyId]][];
  
  // Count platforms per galaxy
  const platformCounts = platforms.reduce((acc, platform) => {
    acc[platform.galaxyId] = (acc[platform.galaxyId] || 0) + 1;
    return acc;
  }, {} as Record<GalaxyId, number>);

  const handleGalaxyClick = (galaxyId: GalaxyId) => {
    const isUnlocked = unlockedGalaxies.includes(galaxyId);
    
    if (isUnlocked) {
      // Switch to this galaxy
      switchGalaxy(galaxyId);
    } else {
      // Try to unlock
      const canUnlock = canUnlockGalaxy(galaxyId, unlockedTechnologies);
      if (canUnlock) {
        // TODO: Check if player has enough influence
        const unlockCost = 1000; // Base cost, can scale by galaxy level
        if (influence.gte(unlockCost)) {
          unlockGalaxy(galaxyId);
        } else {
          alert(`Требуется ${unlockCost} влияния для открытия этой галактики`);
        }
      } else {
        const galaxy = GALAXIES[galaxyId];
        alert(`Требуется исследование: ${galaxy.unlockRequirement || 'неизвестно'}`);
      }
    }
  };

  const getDangerColor = (level: string) => {
    switch (level) {
      case 'very_low': return '#4ade80';
      case 'low': return '#84cc16';
      case 'medium': return '#facc15';
      case 'high': return '#fb923c';
      case 'very_high': return '#f87171';
      case 'extreme': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const getDangerLabel = (level: string) => {
    switch (level) {
      case 'very_low': return 'Очень низкая';
      case 'low': return 'Низкая';
      case 'medium': return 'Средняя';
      case 'high': return 'Высокая';
      case 'very_high': return 'Очень высокая';
      case 'extreme': return 'Экстремальная';
      default: return level;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">🌌 Карта Галактик</h2>
        <div className="text-sm text-gray-400">
          Открыто: {unlockedGalaxies.length}/{galaxyEntries.length}
        </div>
      </div>

      {/* Current Galaxy Info */}
      <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg p-4 border border-blue-500/30">
        <div className="text-sm text-gray-400 mb-1">Текущая галактика</div>
        <div className="text-xl font-bold text-white">
          {GALAXIES[currentGalaxyId].name}
        </div>
        <div className="text-sm text-gray-300 mt-1">
          {GALAXIES[currentGalaxyId].description}
        </div>
      </div>

      {/* Galaxy Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {galaxyEntries.map(([galaxyId, galaxy]) => {
          const isUnlocked = unlockedGalaxies.includes(galaxyId);
          const isCurrent = currentGalaxyId === galaxyId;
          const canUnlock = canUnlockGalaxy(galaxyId, unlockedTechnologies);

          return (
            <button
              key={galaxyId}
              onClick={() => handleGalaxyClick(galaxyId)}
              disabled={!isUnlocked && !canUnlock}
              className={`
                relative p-4 rounded-lg border-2 text-left transition-all
                ${isCurrent 
                  ? 'border-cyan-400 bg-cyan-900/30 shadow-lg shadow-cyan-500/20' 
                  : isUnlocked
                  ? 'border-gray-600 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-800/70'
                  : canUnlock
                  ? 'border-gray-700 bg-gray-900/30 hover:border-gray-600'
                  : 'border-gray-800 bg-gray-900/20 opacity-50 cursor-not-allowed'
                }
              `}
              style={
                isUnlocked ? {
                  backgroundColor: galaxy.theme?.backgroundColor || undefined,
                } : undefined
              }
            >
              {/* Lock Icon for locked galaxies */}
              {!isUnlocked && (
                <div className="absolute top-2 right-2">
                  <span className="text-2xl">🔒</span>
                </div>
              )}

              {/* Current Badge */}
              {isCurrent && (
                <div className="absolute top-2 right-2 bg-cyan-500 text-white text-xs px-2 py-1 rounded">
                  Активна
                </div>
              )}

              <div className="text-2xl mb-2">{galaxy.name}</div>
              
              <div className="text-sm text-gray-300 mb-3 line-clamp-2">
                {galaxy.description}
              </div>

              {/* Danger Level */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-400">Опасность:</span>
                <span 
                  className="text-xs font-semibold px-2 py-0.5 rounded"
                  style={{ 
                    backgroundColor: getDangerColor(galaxy.dangerLevel) + '20',
                    color: getDangerColor(galaxy.dangerLevel)
                  }}
                >
                  {getDangerLabel(galaxy.dangerLevel)}
                </span>
              </div>

              {/* Platforms Count */}
              {isUnlocked && platformCounts[galaxyId] > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-400">Платформы:</span>
                  <span className="text-xs font-semibold text-cyan-400 bg-cyan-900/30 px-2 py-0.5 rounded">
                    🛰️ {platformCounts[galaxyId]}
                  </span>
                </div>
              )}

              {/* Resource Bonuses */}
              {galaxy.resourceBonuses && Object.keys(galaxy.resourceBonuses).length > 0 && (
                <div className="text-xs text-gray-400 mb-2">
                  <span className="font-semibold">Бонусы:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(galaxy.resourceBonuses).slice(0, 3).map(([res, mult]) => (
                      <span key={res} className="bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded">
                        {res.replace('_', ' ')}: +{((mult - 1) * 100).toFixed(0)}%
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Unlock Requirement */}
              {!isUnlocked && galaxy.unlockRequirement && (
                <div className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                  <span>🔬</span>
                  <span>Требуется: {galaxy.unlockRequirement}</span>
                </div>
              )}

              {/* Available Deposits */}
              <div className="text-xs text-gray-500 mt-2">
                Доступные ресурсы: {galaxy.availableDeposits.slice(0, 4).join(', ')}
                {galaxy.availableDeposits.length > 4 && '...'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700">
        <div className="text-sm font-semibold text-white mb-2">Легенда</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-cyan-500"></div>
            <span className="text-gray-400">Активная галактика</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gray-600"></div>
            <span className="text-gray-400">Открытая галактика</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🔒</span>
            <span className="text-gray-400">Требуется исследование</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">⭐</span>
            <span className="text-gray-400">Бонусы к ресурсам</span>
          </div>
        </div>
      </div>

      {/* Procedural Galaxies Section */}
      {proceduralUnlocked && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">🌠 Процедурные Галактики</h2>
            <div className="text-sm text-gray-400">
              Открыто: {proceduralGalaxies.filter(g => g.discovered).length}/{proceduralGalaxies.length}
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-lg p-4 border border-purple-500/30">
            <div className="text-sm text-gray-300">
              🌌 Процедурные галактики - это бесконечные случайно генерируемые миры с уникальными свойствами и наградами.
              Каждая галактика создается с помощью детерминированного алгоритма и будет одинаковой при перезагрузке игры.
            </div>
          </div>

          {/* Generate New Galaxy Button */}
          {proceduralGalaxies.length === 0 || proceduralGalaxies[proceduralGalaxies.length - 1].discovered ? (
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-semibold mb-1">
                    Сгенерировать новую галактику #{8 + proceduralGalaxies.length}
                  </div>
                  <div className="text-sm text-gray-400">
                    Стоимость: {formatNumber(getDiscoveryCost(8 + proceduralGalaxies.length))} кредитов
                  </div>
                </div>
                <button
                  onClick={generateProceduralGalaxy}
                  disabled={credits.lt(getDiscoveryCost(8 + proceduralGalaxies.length))}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 
                           disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  Генерировать
                </button>
              </div>
            </div>
          ) : null}

          {/* Procedural Galaxies Grid */}
          {proceduralGalaxies.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {proceduralGalaxies.map((galaxy) => {
                const isDiscovered = galaxy.discovered;
                const featureColor = getSpecialFeatureColor(galaxy.generated.specialFeature);

                return (
                  <div
                    key={galaxy.galaxyNumber}
                    className={`
                      relative p-4 rounded-lg border-2 transition-all
                      ${isDiscovered
                        ? 'border-purple-500 bg-purple-900/20'
                        : 'border-gray-700 bg-gray-800/30'
                      }
                    `}
                    style={isDiscovered ? {
                      borderColor: featureColor,
                      boxShadow: `0 0 20px ${featureColor}40`,
                    } : undefined}
                  >
                    {/* Galaxy Number Badge */}
                    <div className="absolute top-2 right-2 bg-gray-900/80 text-white text-xs px-2 py-1 rounded">
                      #{galaxy.galaxyNumber}
                    </div>

                    {/* Lock Icon */}
                    {!isDiscovered && (
                      <div className="absolute top-2 left-2">
                        <span className="text-2xl">🔒</span>
                      </div>
                    )}

                    <div className="text-2xl mb-2">{galaxy.generated.name}</div>

                    {/* Special Feature */}
                    {galaxy.generated.specialFeature && (
                      <div 
                        className="text-sm font-semibold px-2 py-1 rounded mb-2 inline-block"
                        style={{
                          backgroundColor: featureColor + '20',
                          color: featureColor,
                        }}
                      >
                        {galaxy.generated.specialFeature === 'black_hole' && '🌀 Черная дыра'}
                        {galaxy.generated.specialFeature === 'nebula' && '☁️ Туманность'}
                        {galaxy.generated.specialFeature === 'quasar' && '💫 Квазар'}
                        {galaxy.generated.specialFeature === 'ruins' && '🏛️ Руины'}
                      </div>
                    )}

                    {/* Difficulty */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-400">Сложность:</span>
                      <span className="text-xs font-semibold text-red-400">
                        ×{galaxy.generated.difficulty.toFixed(1)}
                      </span>
                    </div>

                    {/* Resource Modifiers (only if discovered) */}
                    {isDiscovered && Object.keys(galaxy.generated.resourceModifiers).length > 0 && (
                      <div className="text-xs text-gray-400 mb-2">
                        <span className="font-semibold">Бонусы к ресурсам:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(galaxy.generated.resourceModifiers)
                            .slice(0, 3)
                            .map(([res, mult]) => (
                              <span 
                                key={res} 
                                className={`px-1.5 py-0.5 rounded ${
                                  mult > 1 
                                    ? 'bg-green-900/30 text-green-400' 
                                    : 'bg-red-900/30 text-red-400'
                                }`}
                              >
                                {res}: {mult > 1 ? '+' : ''}{((mult - 1) * 100).toFixed(0)}%
                              </span>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Rewards (only if discovered) */}
                    {isDiscovered && galaxy.rewards.uniqueBonus && (
                      <div className="text-xs text-amber-400 mb-2 flex items-center gap-1">
                        <span>🎁</span>
                        <span>{galaxy.rewards.uniqueBonus}</span>
                      </div>
                    )}

                    {/* Artifact (only if discovered and has artifact) */}
                    {isDiscovered && galaxy.rewards.artifactId && (
                      <div className="text-xs text-purple-400 mb-2 flex items-center gap-1">
                        <span>💎</span>
                        <span>Артефакт: {galaxy.rewards.artifactId}</span>
                      </div>
                    )}

                    {/* Description (only if discovered) */}
                    {isDiscovered && galaxy.generated.specialFeature && (
                      <div className="text-xs text-gray-400 mt-2 italic">
                        {getSpecialFeatureDescription(galaxy.generated.specialFeature)}
                      </div>
                    )}

                    {/* Explore Button */}
                    {!isDiscovered && (
                      <button
                        onClick={() => exploreProceduralGalaxy(galaxy.galaxyNumber)}
                        className="w-full mt-3 px-3 py-2 bg-purple-600 hover:bg-purple-700 
                                 text-white text-sm rounded-lg transition-colors"
                      >
                        Исследовать галактику
                      </button>
                    )}

                    {/* Status Badge */}
                    {galaxy.completed && (
                      <div className="absolute bottom-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                        ✓ Завершена
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
