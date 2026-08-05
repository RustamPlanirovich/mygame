
import { useGameStore } from '../../features/gameStore';
import { MEGASTRUCTURES, canBuildMegastructure } from '../../core/constants/megastructures';
import { GAME_ENDINGS, checkEndingRequirements } from '../../core/constants/megastructures';
import type { MegastructureId, EndingId } from '../../core/gameTypes';
import { formatNumber } from '../../core/math/format';
import Decimal from 'break_eternity.js';
import { GameIcon, IconText } from '../ui/icons';

export function MegastructuresPanel() {
  const { 
    megastructures, 
    currency, 
    resources, 
    research,
    startMegastructure,
    toggleMegastructure,
    galaxies,
  } = useGameStore();

  const renderMegastructure = (id: MegastructureId) => {
    const megastructure = MEGASTRUCTURES[id];
    const builtInfo = megastructures.built[id];
    const inProgress = megastructures.constructionQueue.find(c => c.megastructureId === id);
    
    const check = canBuildMegastructure(id, {
      credits: currency.credits,
      researchPoints: currency.researchPoints,
      influence: currency.influence,
      resources,
      technologies: research.technologies,
      megastructures,
    });

    const isBuilt = !!builtInfo;
    const isActive = builtInfo?.active || false;

    return (
      <div 
        key={id}
        className={`border rounded-lg p-2 ${
          isBuilt 
            ? 'border-green-500/50 bg-green-900/20' 
            : inProgress 
            ? 'border-yellow-500/50 bg-yellow-900/20'
            : check.canBuild
            ? 'border-blue-500/50 bg-blue-900/20'
            : 'border-gray-600 bg-gray-800/50 opacity-60'
        }`}
      >
        <div className="flex justify-between items-start mb-1.5">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white flex items-center gap-1">
              <span className="text-base"><GameIcon icon={megastructure.icon} /></span>
              <span className="truncate">{megastructure.name}</span>
            </h3>
            <p className="text-[10px] text-gray-300 mt-0.5"><IconText>{megastructure.description}</IconText></p>
          </div>
          {isBuilt && (
            <button
              onClick={() => toggleMegastructure(id, !isActive)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ml-2 ${
                isActive 
                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                  : 'bg-gray-600 hover:bg-gray-700 text-gray-300'
              }`}
            >
              <IconText>{isActive ? '✓ Активна' : '○ Неактивна'}</IconText>
            </button>
          )}
        </div>

        {/* Прогресс строительства */}
        {inProgress && (
          <div className="mt-2">
            <div className="flex justify-between text-[10px] text-yellow-300 mb-0.5">
              <span>Строительство...</span>
              <span>{inProgress.progress.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1.5">
              <div 
                className="bg-gradient-to-r from-yellow-500 to-yellow-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${inProgress.progress}%` }}
              />
            </div>
            <p className="text-[9px] text-gray-400 mt-0.5">
              Осталось: {((megastructure.buildTime * (100 - inProgress.progress) / 100) / 60).toFixed(1)} мин
            </p>
          </div>
        )}

        {/* Эффекты */}
        <div className="mt-2 space-y-0.5">
          <p className="text-[10px] font-semibold text-gray-300 uppercase">Эффекты:</p>
          {megastructure.effects.energyProduction && (
            <p className="text-[10px] text-green-400">
              <GameIcon icon="⚡" /> +{formatNumber(megastructure.effects.energyProduction)} энергии/сек
            </p>
          )}
          {megastructure.effects.productionBonus && (
            <p className="text-[10px] text-blue-400">
              <GameIcon icon="📦" /> +{((megastructure.effects.productionBonus - 1) * 100).toFixed(0)}% к производству
            </p>
          )}
          {megastructure.effects.researchBonus && (
            <p className="text-[10px] text-purple-400">
              <GameIcon icon="🔬" /> +{((megastructure.effects.researchBonus - 1) * 100).toFixed(0)}% к исследованиям
            </p>
          )}
          {megastructure.effects.influenceBonus && (
            <p className="text-[10px] text-yellow-400">
              <GameIcon icon="👑" /> +{megastructure.effects.influenceBonus} влияния/сек
            </p>
          )}
          {megastructure.effects.platformCapacity && (
            <p className="text-[10px] text-cyan-400">
              <GameIcon icon="🏭" /> +{megastructure.effects.platformCapacity} слотов платформ
            </p>
          )}
          {megastructure.effects.special && (
            <p className="text-[10px] text-orange-400 italic">
              <GameIcon icon="✨" /> {megastructure.effects.special}
            </p>
          )}
        </div>

        {/* Стоимость */}
        {!isBuilt && !inProgress && (
          <div className="mt-2 pt-2 border-t border-gray-600">
            <p className="text-[10px] font-semibold text-gray-300 uppercase mb-1">Требования:</p>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <div className={currency.credits.gte(megastructure.buildCost.credits) ? 'text-green-400' : 'text-red-400'}>
                <GameIcon icon="💰" /> {formatNumber(megastructure.buildCost.credits)} кредитов RP
              </div>
              <div className={currency.researchPoints.gte(megastructure.buildCost.researchPoints) ? 'text-green-400' : 'text-red-400'}>
                <GameIcon icon="🔬" /> {formatNumber(megastructure.buildCost.researchPoints)} RP
              </div>
              <div className={currency.influence.gte(megastructure.buildCost.influence) ? 'text-green-400' : 'text-red-400'}>
                <GameIcon icon="👑" /> {formatNumber(megastructure.buildCost.influence)} влияния
              </div>
              {Object.entries(megastructure.buildCost.resources).map(([resType, amount]) => {
                const available = resources[resType as keyof typeof resources]?.amount || new Decimal(0);
                const sufficient = available.gte(amount as Decimal);
                return (
                  <div key={resType} className={sufficient ? 'text-green-400' : 'text-red-400'}>
                    {formatNumber(amount as Decimal)} {resType}
                  </div>
                );
              })}
            </div>
            
            {!research.technologies[megastructure.requiredTechnology] && (
              <p className="text-[10px] text-red-400 mt-1">
                <GameIcon icon="🔒" /> Требуется технология: {megastructure.requiredTechnology}
              </p>
            )}

            {check.canBuild ? (
              <button
                onClick={() => startMegastructure(id)}
                className="w-full mt-2 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-lg transition-all text-[11px]"
              >
                <GameIcon icon="🚀" /> Начать строительство
              </button>
            ) : (
              <button
                disabled
                className="w-full mt-2 px-3 py-1.5 bg-gray-700 text-gray-500 font-bold rounded-lg cursor-not-allowed text-[11px]"
              >
                Недостаточно ресурсов
              </button>
            )}
          </div>
        )}

        {isBuilt && (
          <div className="mt-2 pt-2 border-t border-green-600">
            <p className="text-[10px] text-green-400 font-semibold">
              <GameIcon icon="✓" /> Построена {new Date(builtInfo.completedAt).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderEndingProgress = (id: EndingId) => {
    const ending = GAME_ENDINGS[id];
    const progress = checkEndingRequirements(id, {
      galaxies: [], // Simplified
      platforms: galaxies.platforms,
      ships: useGameStore.getState().fleet.ships,
      megastructures,
      contracts: 0, // TODO: track completed contracts
      technologies: research.technologies,
      activePolicies: useGameStore.getState().politics.activePolicies,
    });

    return (
      <div 
        key={id}
        className={`border rounded-lg p-2 ${
          progress.met 
            ? 'border-yellow-500/50 bg-yellow-900/20' 
            : 'border-gray-600 bg-gray-800/50'
        }`}
      >
        <h3 className="text-sm font-bold text-white mb-1">{ending.name}</h3>
        <p className="text-[10px] text-gray-300 mb-2"><IconText>{ending.description}</IconText></p>
        
        <div className="mb-2">
          <div className="flex justify-between text-[10px] text-gray-300 mb-0.5">
            <span>Прогресс</span>
            <span>{progress.progress.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1.5">
            <div 
              className={`h-1.5 rounded-full transition-all duration-300 ${
                progress.met 
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500' 
                  : 'bg-gradient-to-r from-blue-500 to-purple-500'
              }`}
              style={{ width: `${progress.progress}%` }}
            />
          </div>
        </div>

        {progress.missingRequirements.length > 0 && (
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold text-gray-300 uppercase">Требования:</p>
            {progress.missingRequirements.map((req, idx) => (
              <p key={idx} className="text-[10px] text-red-400">• {req}</p>
            ))}
          </div>
        )}

        {progress.met && (
          <button
            onClick={() => useGameStore.getState().achieveEnding(id)}
            className="w-full mt-2 px-3 py-1.5 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white font-bold rounded-lg transition-all animate-pulse text-[11px]"
          >
            <GameIcon icon="🎉" /> ДОСТИЧЬ КОНЦОВКИ
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="p-3 space-y-3">
      <div>
        <h2 className="text-lg font-bold text-white mb-1"><GameIcon icon="🏗️" /> Мегаструктуры</h2>
        <p className="text-[10px] text-gray-400">
          Величайшие сооружения галактики. Каждая мегаструктура дает уникальные бонусы и приближает вас к концовке игры.
        </p>
      </div>

      {/* Мегаструктуры */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {(Object.keys(MEGASTRUCTURES) as MegastructureId[]).map(renderMegastructure)}
      </div>

      {/* Разделитель */}
      <div className="border-t border-gray-700 my-3" />

      {/* Концовки */}
      <div>
        <h2 className="text-lg font-bold text-white mb-1"><GameIcon icon="🎯" /> Концовки Игры</h2>
        <p className="text-[10px] text-gray-400 mb-2">
          Достигните одной из концовок, чтобы завершить игру и получить награды для престижа.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {(Object.keys(GAME_ENDINGS) as EndingId[]).map(renderEndingProgress)}
        </div>
      </div>
    </div>
  );
}
