/**
 * Conflict Resolver - Фаза 8
 * UI компонент для разрешения конфликтов синхронизации
 */

import React, { useState, useEffect } from 'react';
import { useSyncStore } from '../../../features/syncStore';
import type { SaveConflict, SaveConflictResolveOption } from '../../../core/gameTypes.sync';
import { compareSaves, formatTimestamp, formatPlayTime } from '../../../utils/conflictResolver';
import { pullSave } from '../../../utils/syncApi';
import { getGameSaveData } from '../../../utils/syncHelpers';

interface ConflictResolverProps {
  conflict: SaveConflict;
  onResolved?: () => void;
}

export const ConflictResolver: React.FC<ConflictResolverProps> = ({
  conflict,
  onResolved,
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<SaveConflictResolveOption | null>(null);
  const [comparison, setComparison] = useState<{
    localData: string;
    cloudData: string;
    newerSave: 'local' | 'cloud' | 'same';
    moreProgress: 'local' | 'cloud' | 'same';
    recommendation: SaveConflictResolveOption;
    recommendationReason: string;
  } | null>(null);

  const { resolveConflict: resolveConflictAction, dismissConflict } = useSyncStore();

  // Загружаем данные для сравнения
  useEffect(() => {
    const loadComparison = async () => {
      try {
        const localData = getGameSaveData();
        const cloudResult = await pullSave(conflict.cloudSave.slotId);
        
        if (cloudResult.data) {
          const comp = compareSaves(
            conflict.localSave,
            conflict.cloudSave,
            localData,
            cloudResult.data
          );
          
          setComparison({
            localData,
            cloudData: cloudResult.data,
            newerSave: comp.newerSave,
            moreProgress: comp.moreProgress,
            recommendation: comp.recommendation,
            recommendationReason: comp.recommendationReason,
          });
        }
      } catch (error) {
        console.error('Failed to load comparison:', error);
      }
    };

    loadComparison();
  }, [conflict]);

  const handleResolve = async (option: SaveConflictResolveOption) => {
    setLoading(true);
    setSelectedOption(option);

    try {
      let localData: string | undefined;
      
      if (option === 'use_local' || option === 'merge') {
        localData = getGameSaveData();
      }

      const success = await resolveConflictAction(conflict.id, option, localData);
      
      if (success) {
        onResolved?.();
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    } finally {
      setLoading(false);
    }
  };

  const options: { 
    id: SaveConflictResolveOption; 
    icon: string; 
    title: string; 
    description: string;
    color: string;
  }[] = [
    {
      id: 'use_local',
      icon: '💻',
      title: 'Использовать локальное',
      description: 'Сохранение с этого устройства перезапишет облачное',
      color: 'blue',
    },
    {
      id: 'use_cloud',
      icon: '☁️',
      title: 'Использовать облачное',
      description: 'Облачное сохранение перезапишет локальное',
      color: 'purple',
    },
    {
      id: 'merge',
      icon: '🔀',
      title: 'Объединить',
      description: 'Взять лучшее из обоих (макс. ресурсов, все технологии)',
      color: 'green',
    },
    {
      id: 'keep_both',
      icon: '📋',
      title: 'Сохранить оба',
      description: 'Создать отдельный слот для второго сохранения',
      color: 'yellow',
    },
  ];

  return (
    <div className="bg-orange-900/30 border border-orange-700 rounded-lg overflow-hidden">
      {/* Заголовок */}
      <div className="bg-orange-800/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚔️</span>
          <h3 className="text-orange-200 font-semibold">Конфликт синхронизации</h3>
        </div>
        <button
          onClick={() => dismissConflict(conflict.id)}
          className="text-orange-400 hover:text-orange-200 text-sm"
        >
          Позже
        </button>
      </div>

      {/* Сравнение сохранений */}
      <div className="p-4 grid grid-cols-2 gap-4">
        {/* Локальное */}
        <SaveCard
          title="💻 Локальное"
          save={conflict.localSave}
          highlight={comparison?.newerSave === 'local' || comparison?.moreProgress === 'local'}
          badges={[
            comparison?.newerSave === 'local' ? '🕐 Новее' : null,
            comparison?.moreProgress === 'local' ? '📈 Больше прогресса' : null,
          ].filter(Boolean) as string[]}
        />

        {/* Облачное */}
        <SaveCard
          title="☁️ Облачное"
          save={conflict.cloudSave}
          highlight={comparison?.newerSave === 'cloud' || comparison?.moreProgress === 'cloud'}
          badges={[
            comparison?.newerSave === 'cloud' ? '🕐 Новее' : null,
            comparison?.moreProgress === 'cloud' ? '📈 Больше прогресса' : null,
          ].filter(Boolean) as string[]}
        />
      </div>

      {/* Рекомендация */}
      {comparison && (
        <div className="mx-4 mb-4 p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
          <div className="text-blue-300 text-sm font-medium">
            💡 Рекомендация: {options.find(o => o.id === comparison.recommendation)?.title}
          </div>
          <div className="text-blue-400 text-xs mt-1">{comparison.recommendationReason}</div>
        </div>
      )}

      {/* Опции разрешения */}
      <div className="p-4 grid grid-cols-2 gap-3">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => handleResolve(option.id)}
            disabled={loading}
            className={`
              p-3 rounded-lg border transition-all text-left
              ${loading && selectedOption === option.id
                ? 'bg-gray-700 border-gray-600 opacity-70'
                : comparison?.recommendation === option.id
                  ? `bg-${option.color}-900/40 border-${option.color}-600 hover:bg-${option.color}-900/60`
                  : 'bg-gray-800 border-gray-700 hover:bg-gray-700'
              }
              ${loading ? 'cursor-wait' : 'cursor-pointer'}
            `}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{option.icon}</span>
              <span className="text-white font-medium text-sm">{option.title}</span>
              {comparison?.recommendation === option.id && (
                <span className="text-xs bg-blue-600 px-1.5 py-0.5 rounded text-white">
                  Рек.
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-1">{option.description}</div>
            {loading && selectedOption === option.id && (
              <div className="text-xs text-blue-400 mt-2 animate-pulse">Обработка...</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

interface SaveCardProps {
  title: string;
  save: {
    timestamp: number;
    deviceName?: string;
    era?: number;
    credits?: string;
    buildingsCount?: number;
    playTime?: number;
    size?: number;
  };
  highlight?: boolean;
  badges?: string[];
}

const SaveCard: React.FC<SaveCardProps> = ({ title, save, highlight, badges }) => {
  return (
    <div className={`
      p-3 rounded-lg border transition-all
      ${highlight 
        ? 'bg-green-900/30 border-green-700' 
        : 'bg-gray-800 border-gray-700'
      }
    `}>
      <div className="text-white font-medium mb-2">{title}</div>
      
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Время:</span>
          <span className="text-white">{formatTimestamp(save.timestamp)}</span>
        </div>
        
        {save.deviceName && (
          <div className="flex justify-between">
            <span className="text-gray-400">Устройство:</span>
            <span className="text-white truncate max-w-[120px]">{save.deviceName}</span>
          </div>
        )}
        
        {save.era && (
          <div className="flex justify-between">
            <span className="text-gray-400">Эра:</span>
            <span className="text-white">{save.era}</span>
          </div>
        )}
        
        {save.buildingsCount !== undefined && (
          <div className="flex justify-between">
            <span className="text-gray-400">Зданий:</span>
            <span className="text-white">{save.buildingsCount}</span>
          </div>
        )}
        
        {save.playTime !== undefined && (
          <div className="flex justify-between">
            <span className="text-gray-400">Время игры:</span>
            <span className="text-white">{formatPlayTime(save.playTime)}</span>
          </div>
        )}
      </div>

      {/* Бейджи */}
      {badges && badges.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {badges.map((badge, index) => (
            <span
              key={index}
              className="text-xs bg-green-700 text-green-100 px-2 py-0.5 rounded"
            >
              {badge}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConflictResolver;
