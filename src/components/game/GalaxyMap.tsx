import { useGameStore } from '../../features/gameStore';
import { GALAXIES, canUnlockGalaxy } from '../../core/constants/galaxies';
import type { GalaxyId } from '../../core/gameTypes';
import { formatNumber } from '../../core/math/format';
import { 
  getSpecialFeatureDescription, 
  getSpecialFeatureColor, 
  getDiscoveryCost 
} from '../../utils/galaxyGenerator';
import { notify } from '../../utils/notifications';
import { dangerLabel, localizeGalaxyBonus, localizeGeneratedName, resourceLabel, specialFeatureLabel, technologyLabel } from '../../core/i18n/label';
import { GameIcon, IconText } from '../ui/icons';

// Эмодзи особенностей: сама подпись берётся из specialFeatureLabel, здесь только иконка.
const SPECIAL_FEATURE_ICON: Record<string, string> = {
  black_hole: '🌀',
  nebula: '☁️',
  quasar: '💫',
  ruins: '🏛️',
};

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
          notify.warning(`Требуется ${unlockCost} влияния для открытия этой галактики`);
        }
      } else {
        const galaxy = GALAXIES[galaxyId];
        notify.info(
          galaxy.unlockRequirement
            ? `Требуется исследование: ${technologyLabel(galaxy.unlockRequirement)}`
            : 'Требуется исследование: неизвестно',
        );
      }
    }
  };

  const getDangerColor = (level: string) => {
    switch (level) {
      case 'very_low': return '#6aeda1';
      case 'low': return '#a1e245';
      case 'medium': return '#f1fa8c';
      case 'high': return '#fca62f';
      case 'very_high': return '#ff8080';
      case 'extreme': return '#e74c3c';
      default: return '#7f849f';
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white"><GameIcon icon="🌌" /> Карта Галактик</h2>
        <div className="text-xs text-gray-400">
          Открыто: {unlockedGalaxies.length}/{galaxyEntries.length}
        </div>
      </div>

      {/* Current Galaxy Info */}
      <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg p-3 border border-blue-500/30">
        <div className="text-[10px] text-gray-400 mb-1">Текущая галактика</div>
        <div className="text-lg font-bold text-white">
          {GALAXIES[currentGalaxyId].name}
        </div>
        <div className="text-xs text-gray-300 mt-1">
          {GALAXIES[currentGalaxyId].description}
        </div>
      </div>

      {/* Galaxy Grid */}
      <div className="space-y-2">
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
                w-full p-3 rounded-lg border text-left transition-all
                ${isCurrent 
                  ? 'border-cyan-400 bg-cyan-900/30 shadow-elev-3 shadow-cyan-500/20' 
                  : isUnlocked
                  ? 'border-gray-600 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-800/70'
                  : canUnlock
                  ? 'border-gray-700 bg-gray-900/30 hover:border-gray-600'
                  : 'border-gray-800 bg-gray-900/20 opacity-50 cursor-not-allowed'
                }
              `}
            >
              <div className="flex items-start gap-3">
                {/* Icon/Status */}
                <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-2xl">
                  <IconText>{!isUnlocked ? '🔒' : isCurrent ? '✓' : '🌌'}</IconText>
                </div>

                {/* Main Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-bold text-white truncate">{galaxy.name}</h3>
                    {isCurrent && (
                      <span className="flex-shrink-0 bg-cyan-500 text-white text-[10px] px-1.5 py-0.5 rounded">
                        АКТИВНА
                      </span>
                    )}
                  </div>
                  
                  <p className="text-xs text-gray-400 mb-2 line-clamp-1">
                    <IconText>{galaxy.description}</IconText>
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    {/* Danger Level */}
                    <span 
                      className="px-1.5 py-0.5 rounded font-semibold"
                      style={{ 
                        backgroundColor: getDangerColor(galaxy.dangerLevel) + '20',
                        color: getDangerColor(galaxy.dangerLevel)
                      }}
                    >
                      <GameIcon icon="⚠️" /> {dangerLabel(galaxy.dangerLevel)}
                    </span>

                    {/* Platforms Count */}
                    {isUnlocked && platformCounts[galaxyId] > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-cyan-900/30 text-cyan-400">
                        <GameIcon icon="🛰️" /> {platformCounts[galaxyId]}
                      </span>
                    )}

                    {/* Resource Bonuses */}
                    {galaxy.resourceBonuses && Object.keys(galaxy.resourceBonuses).length > 0 && (
                      <>
                        {Object.entries(galaxy.resourceBonuses).slice(0, 2).map(([res, mult]) => (
                          <span key={res} className="px-1.5 py-0.5 rounded bg-green-900/30 text-green-400">
                            {resourceLabel(res)}: +{((mult - 1) * 100).toFixed(0)}%
                          </span>
                        ))}
                        {Object.keys(galaxy.resourceBonuses).length > 2 && (
                          <span className="text-gray-500">+{Object.keys(galaxy.resourceBonuses).length - 2}</span>
                        )}
                      </>
                    )}

                    {/* Unlock Requirement */}
                    {!isUnlocked && galaxy.unlockRequirement && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400">
                        <GameIcon icon="🔬" /> {technologyLabel(galaxy.unlockRequirement)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Arrow/Action Indicator */}
                {(isUnlocked || canUnlock) && (
                  <div className="flex-shrink-0 text-gray-400">
                    <GameIcon icon="→" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700">
        <div className="text-xs font-semibold text-white mb-1.5"><GameIcon icon="💡" /> Подсказка</div>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="text-cyan-400"><GameIcon icon="✓" /></span>
            <span className="text-gray-400">Активная</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span><GameIcon icon="🌌" /></span>
            <span className="text-gray-400">Открытая</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span><GameIcon icon="🔒" /></span>
            <span className="text-gray-400">Заблокирована</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-green-400"><GameIcon icon="⭐" /></span>
            <span className="text-gray-400">Есть бонусы</span>
          </div>
        </div>
      </div>

      {/* Procedural Galaxies Section */}
      {proceduralUnlocked && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white"><GameIcon icon="🌠" /> Процедурные Галактики</h3>
            <div className="text-[10px] text-gray-400">
              Открыто: {proceduralGalaxies.filter(g => g.discovered).length}/{proceduralGalaxies.length}
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-lg p-3 border border-purple-500/30">
            <div className="text-[10px] text-gray-300">
              <GameIcon icon="🌌" /> Бесконечные процедурно генерируемые миры с уникальными свойствами и наградами.
            </div>
          </div>

          {/* Generate New Galaxy Button */}
          {proceduralGalaxies.length === 0 || proceduralGalaxies[proceduralGalaxies.length - 1].discovered ? (
            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-600">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white font-semibold mb-0.5">
                    Сгенерировать #{8 + proceduralGalaxies.length}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Стоимость: {formatNumber(getDiscoveryCost(8 + proceduralGalaxies.length))} <GameIcon icon="💰" />
                  </div>
                </div>
                <button
                  onClick={generateProceduralGalaxy}
                  disabled={credits.lt(getDiscoveryCost(8 + proceduralGalaxies.length))}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 
                           disabled:cursor-not-allowed text-white text-xs rounded-lg transition-colors flex-shrink-0"
                >
                  Генерировать
                </button>
              </div>
            </div>
          ) : null}

          {/* Procedural Galaxies List */}
          {proceduralGalaxies.length > 0 && (
            <div className="space-y-2">
              {proceduralGalaxies.map((galaxy) => {
                const isDiscovered = galaxy.discovered;
                const featureColor = getSpecialFeatureColor(galaxy.generated.specialFeature);

                return (
                  <div
                    key={galaxy.galaxyNumber}
                    className={`
                      p-3 rounded-lg border transition-all
                      ${isDiscovered
                        ? 'border-purple-500 bg-purple-900/20'
                        : 'border-gray-700 bg-gray-800/30'
                      }
                    `}
                    style={isDiscovered ? {
                      borderColor: featureColor,
                    } : undefined}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-2xl">
                        <IconText>{!isDiscovered ? '🔒' : galaxy.completed ? '✓' : '🌠'}</IconText>
                      </div>

                      {/* Main Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-base font-bold text-white truncate">
                            #{galaxy.galaxyNumber} {localizeGeneratedName(galaxy.generated.name)}
                          </h4>
                          {galaxy.completed && (
                            <span className="flex-shrink-0 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded">
                              ЗАВЕРШЕНА
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[10px] mb-2">
                          {/* Special Feature */}
                          {galaxy.generated.specialFeature && (
                            <span 
                              className="px-1.5 py-0.5 rounded font-semibold"
                              style={{
                                backgroundColor: featureColor + '20',
                                color: featureColor,
                              }}
                            >
                              <IconText>{SPECIAL_FEATURE_ICON[galaxy.generated.specialFeature] ?? ''}</IconText>{' '}
                              {specialFeatureLabel(galaxy.generated.specialFeature)}
                            </span>
                          )}

                          {/* Difficulty */}
                          <span className="px-1.5 py-0.5 rounded bg-red-900/30 text-red-400">
                            <GameIcon icon="⚔️" /> ×{galaxy.generated.difficulty.toFixed(1)}
                          </span>

                          {/* Resource Modifiers (only if discovered) */}
                          {isDiscovered && Object.keys(galaxy.generated.resourceModifiers).length > 0 && (
                            <>
                              {Object.entries(galaxy.generated.resourceModifiers)
                                .slice(0, 2)
                                .map(([res, mult]) => (
                                  <span 
                                    key={res} 
                                    className={`px-1.5 py-0.5 rounded ${
                                      mult > 1 
                                        ? 'bg-green-900/30 text-green-400' 
                                        : 'bg-red-900/30 text-red-400'
                                    }`}
                                  >
                                    {resourceLabel(res)}: {mult > 1 ? '+' : ''}{((mult - 1) * 100).toFixed(0)}%
                                  </span>
                                ))}
                              {Object.keys(galaxy.generated.resourceModifiers).length > 2 && (
                                <span className="text-gray-500">+{Object.keys(galaxy.generated.resourceModifiers).length - 2}</span>
                              )}
                            </>
                          )}

                          {/* Rewards (only if discovered) */}
                          {isDiscovered && galaxy.rewards.uniqueBonus && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400">
                              <GameIcon icon="🎁" /> {localizeGalaxyBonus(galaxy.rewards.uniqueBonus)}
                            </span>
                          )}

                          {/* Artifact (only if discovered) */}
                          {isDiscovered && galaxy.rewards.artifactId && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-400">
                              <GameIcon icon="💎" /> Артефакт
                            </span>
                          )}
                        </div>

                        {/* Description (only if discovered) */}
                        {isDiscovered && galaxy.generated.specialFeature && (
                          <p className="text-[10px] text-gray-400 italic line-clamp-1">
                            {getSpecialFeatureDescription(galaxy.generated.specialFeature)}
                          </p>
                        )}
                      </div>

                      {/* Explore Button or Arrow */}
                      <div className="flex-shrink-0">
                        {!isDiscovered ? (
                          <button
                            onClick={() => exploreProceduralGalaxy(galaxy.galaxyNumber)}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 
                                     text-white text-xs rounded-lg transition-colors"
                          >
                            Исследовать
                          </button>
                        ) : (
                          <span className="text-gray-400"><GameIcon icon="→" /></span>
                        )}
                      </div>
                    </div>
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
