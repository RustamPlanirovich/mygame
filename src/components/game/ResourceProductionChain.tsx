import { useMemo, useCallback } from 'react';
import { ChevronRight, Factory, CheckCircle2, XCircle, TrendingUp, Pin, PinOff, Loader2 } from 'lucide-react';
import type { Building, ResourceType } from '../../core/gameTypes';
import { RESOURCE_LABEL } from '../../core/constants/labels';
import { getResourceProductionChain, flattenProductionChain } from '../../utils/productionChainHelpers';
import { getBuildingIcon } from '../../core/constants/buildingIcons';
import { formatNumber } from '../../core/math/format';
import { usePinnedProductionChains, useDebouncedChain } from '../../hooks/usePinnedProductionChains';
import Decimal from 'break_eternity.js';

interface ResourceProductionChainProps {
  resource: ResourceType;
  buildings: Building[];
  /** Использовать debounce для отложенной загрузки (для поиска) */
  useDebounce?: boolean;
  /** Задержка debounce в мс */
  debounceDelay?: number;
}

/**
 * Компонент отображения производственной цепочки для ресурса
 * Показывает какие здания и материалы нужны для производства (оптимизированная версия)
 */
export function ResourceProductionChain({ 
  resource, 
  buildings, 
  useDebounce = false,
  debounceDelay = 300,
}: ResourceProductionChainProps) {
  // Хук для закреплённых цепочек
  const { isPinned, togglePin } = usePinnedProductionChains(buildings);
  const pinned = isPinned(resource);

  // Используем debounce если запрошено (для поиска)
  const debouncedResult = useDebouncedChain(
    useDebounce ? resource : null,
    buildings,
    debounceDelay
  );

  // Синхронная мемоизация цепочки для обычного режима
  const syncChain = useMemo(() => 
    useDebounce ? null : getResourceProductionChain(resource, buildings),
    [resource, buildings, useDebounce]
  );

  const syncFlatChain = useMemo(() => 
    flattenProductionChain(syncChain),
    [syncChain]
  );

  // Выбираем источник данных в зависимости от режима
  const chain = useDebounce ? debouncedResult.chain : syncChain;
  const flatChain = useDebounce ? debouncedResult.flatChain : syncFlatChain;
  const isLoading = useDebounce ? debouncedResult.isLoading : false;

  // Подсчет статистики производства - мемоизировано
  const stats = useMemo(() => {
    const producing = flatChain.filter(i => i.isProducing).length;
    const total = flatChain.length;
    const missing = flatChain.filter(i => !i.isProducing && i.buildings.length > 0);
    
    // Подсчет общего производства
    let totalProduction = new Decimal(0);
    
    for (const item of flatChain) {
      if (item.isProducing) {
        for (const buildingId of item.buildings) {
          const building = buildings.find(b => b.id === buildingId);
          if (building?.production?.[item.resource]) {
            totalProduction = totalProduction.add(
              building.production[item.resource]!.mul(building.count)
            );
          }
        }
      }
    }
    
    return { producing, total, missing, totalProduction };
  }, [flatChain, buildings]);

  // Обработчик закрепления
  const handleTogglePin = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    togglePin(resource);
  }, [togglePin, resource]);

  // Показываем лоадер при загрузке
  if (isLoading) {
    return (
      <div className="mt-2 p-3 bg-cyber-black/50 border border-cyber-gray/30 rounded text-[10px] flex items-center justify-center gap-2">
        <Loader2 size={14} className="animate-spin text-cyber-blue" />
        <span className="text-cyber-text-dim">Загрузка цепочки...</span>
      </div>
    );
  }

  if (!chain || flatChain.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 p-2 bg-cyber-black/50 border border-cyber-gray/30 rounded text-[10px]">
      {/* Заголовок с общей статистикой */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-cyber-gray/20">
        <div className="flex items-center gap-1 text-cyber-text-dim">
          <Factory size={12} />
          <span className="font-medium">Цепочка производства</span>
        </div>
        <div className="flex items-center gap-2 text-[9px]">
          {/* Кнопка закрепления */}
          <button
            type="button"
            onClick={handleTogglePin}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
              pinned 
                ? 'bg-cyber-green/20 text-cyber-green border border-cyber-green/30' 
                : 'bg-cyber-gray/20 text-cyber-text-dim hover:bg-cyber-blue/20 hover:text-cyber-blue'
            }`}
            title={pinned ? 'Открепить с экрана' : 'Закрепить на экране (как HelMod)'}
          >
            {pinned ? <PinOff size={10} /> : <Pin size={10} />}
            <span>{pinned ? 'Закреплено' : 'Закрепить'}</span>
          </button>
          
          <div className="flex items-center gap-0.5">
            <CheckCircle2 size={10} className="text-green-500" />
            <span className="text-green-400">{stats.producing}/{stats.total}</span>
          </div>
          {stats.totalProduction.gt(0) && (
            <div className="flex items-center gap-0.5 text-cyber-blue">
              <TrendingUp size={10} />
              <span>{formatNumber(stats.totalProduction)}/с</span>
            </div>
          )}
        </div>
      </div>

      {/* Плоский список с отступами */}
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
        {flatChain.map((item, idx) => {
          // Подсчет производства для этого ресурса
          let itemProduction = new Decimal(0);
          for (const buildingId of item.buildings) {
            const building = buildings.find(b => b.id === buildingId);
            if (building?.production?.[item.resource]) {
              itemProduction = itemProduction.add(
                building.production[item.resource]!.mul(building.count)
              );
            }
          }
          
          return (
            <div 
              key={`${item.resource}-${idx}`}
              className="group hover:bg-cyber-gray/10 rounded px-1 py-0.5 transition-colors"
              style={{ paddingLeft: `${item.level * 8}px` }}
            >
              <div className="flex items-start gap-1.5">
                {/* Индикатор уровня */}
                {item.level > 0 && (
                  <ChevronRight size={9} className="text-cyber-gray/50 flex-shrink-0 mt-0.5" />
                )}

                {/* Статус производства */}
                {item.isProducing ? (
                  <CheckCircle2 size={11} className="text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle size={11} className="text-red-500 flex-shrink-0 mt-0.5" />
                )}

                {/* Название ресурса с производством */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span 
                      className={`font-medium text-[10px] ${
                        item.isProducing ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {RESOURCE_LABEL[item.resource] || item.resource}
                    </span>
                    {itemProduction.gt(0) && (
                      <span className="text-[9px] text-cyber-blue">
                        +{formatNumber(itemProduction)}/с
                      </span>
                    )}
                  </div>

                  {/* Здания-производители */}
                  {item.buildings.length > 0 ? (
                    <div className="flex items-center gap-1 flex-wrap mt-0.5">
                      <span className="text-cyber-text-dim text-[9px]">→</span>
                      {item.buildings.map((buildingId, bIdx) => {
                        const b = buildings.find(b => b.id === buildingId);
                        if (!b) return null;
                        
                        const Icon = getBuildingIcon(buildingId);
                        const isBuilt = b.count > 0;
                        
                        // Производство этого здания
                        let buildingProd = new Decimal(0);
                        if (b.production?.[item.resource]) {
                          buildingProd = b.production[item.resource]!.mul(b.count);
                        }
                        
                        return (
                          <div 
                            key={`${buildingId}-${bIdx}`}
                            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] ${
                              isBuilt 
                                ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                            title={`${b.name}${isBuilt ? ` (${b.count} шт, +${formatNumber(buildingProd)}/с)` : ' (не построено)'}`}
                          >
                            <Icon size={9} />
                            <span>{b.name}</span>
                            {isBuilt && (
                              <span className="opacity-70">×{b.count}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-cyber-text-dim text-[9px] italic">
                      базовый ресурс (добывается)
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Рекомендации по недостающим зданиям */}
      {stats.missing.length > 0 && (
        <div className="mt-2 pt-2 border-t border-cyber-gray/20">
          <div className="text-[9px] text-orange-400 font-medium mb-1">⚠️ Нужно построить:</div>
          <div className="space-y-0.5">
            {stats.missing.map((item, idx) => {
              const missingBuildings = item.buildings.filter(bid => {
                const b = buildings.find(b => b.id === bid);
                return b && b.count === 0;
              });
              
              if (missingBuildings.length === 0) return null;
              
              return (
                <div key={idx} className="flex items-center gap-1 text-[9px]">
                  <span className="text-cyber-text-dim">•</span>
                  <span className="text-red-400">{RESOURCE_LABEL[item.resource]}</span>
                  <span className="text-cyber-text-dim">→</span>
                  <span className="text-orange-300">
                    {missingBuildings.map(bid => buildings.find(b => b.id === bid)?.name).join(', ')}
                  </span>
                </div>
              );
            }).filter(Boolean)}
          </div>
        </div>
      )}

      {/* Итоговая статистика */}
      {stats.producing === stats.total && stats.total > 1 && (
        <div className="mt-2 pt-2 border-t border-cyber-gray/20 text-center">
          <div className="text-[9px] text-green-400 flex items-center justify-center gap-1">
            <CheckCircle2 size={10} />
            <span>✨ Производственная цепочка полностью функционирует!</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Компактная версия для отображения в списке
 */
export function ResourceProductionChainCompact({ resource, buildings }: ResourceProductionChainProps) {
  const chain = useMemo(() => 
    getResourceProductionChain(resource, buildings),
    [resource, buildings]
  );

  const flatChain = useMemo(() => 
    flattenProductionChain(chain),
    [chain]
  );

  if (!chain || flatChain.length === 0) {
    return null;
  }

  const producingCount = flatChain.filter(i => i.isProducing).length;
  const totalCount = flatChain.length;
  const allProducing = producingCount === totalCount;

  return (
    <div className="flex items-center gap-1.5 text-[9px] mt-1">
      {allProducing ? (
        <CheckCircle2 size={10} className="text-green-500" />
      ) : (
        <XCircle size={10} className="text-orange-400" />
      )}
      <span className={allProducing ? 'text-green-400' : 'text-orange-400'}>
        Цепочка: {producingCount}/{totalCount}
      </span>
      <button
        type="button"
        className="text-cyber-blue hover:text-cyber-green underline text-[8px]"
        onClick={(e) => {
          e.stopPropagation();
          // TODO: Показать полную цепочку в модальном окне или раскрыть детали
        }}
      >
        подробнее
      </button>
    </div>
  );
}
