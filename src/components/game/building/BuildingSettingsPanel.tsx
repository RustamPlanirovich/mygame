/**
 * Панель настроек здания (Фаза 5)
 * Детальные настройки: режим, приоритеты, лимиты, авто-продажа
 */

import { useState, useMemo } from 'react';
import { useGameStore } from '../../../features/gameStore';
import { EmptyState, Modal, Tabs, type TabItem } from '../../ui';
import {
  BUILDING_MODES,
  PRIORITY_LABELS,
  SETTINGS_PRESETS,
  applyPreset,
  type BuildingMode,
  type ResourcePriority,
  type TileBuildingSettings,
} from '../../../core/gameTypes.buildings';
import { RESOURCE_LABEL } from '../../../core/constants/labels';
import { getBuildingIcon } from '../../../core/constants/buildingIcons';
import type { ResourceType } from '../../../core/gameTypes';
import { formatNumber, D } from '../../../core/math/format';
import { GameIcon, IconText } from '../../ui/icons';

interface BuildingSettingsPanelProps {
  tileKey: string;
  onClose: () => void;
}

type SettingsTabId = 'mode' | 'priority' | 'auto' | 'conditions';

const SETTINGS_TABS: TabItem<SettingsTabId>[] = [
  { id: 'mode', label: '⚙️ Режим' },
  { id: 'priority', label: '📊 Приоритеты' },
  { id: 'auto', label: '🤖 Авто-продажа' },
  { id: 'conditions', label: '📋 Условия' },
];

export function BuildingSettingsPanel({ tileKey, onClose }: BuildingSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('mode');

  const buildingId = useGameStore((s) => s.grid.tiles[tileKey]);
  const buildings = useGameStore((s) => s.buildings);
  const tileSettings = useGameStore((s) => s.grid.tileSettings?.[tileKey]);
  const credits = useGameStore((s) => s.currency.credits);
  
  const setBuildingMode = useGameStore((s) => s.setBuildingMode);
  const setBuildingEnabled = useGameStore((s) => s.setBuildingEnabled);
  const setOutputPriority = useGameStore((s) => s.setOutputPriority);
  const setInputPriority = useGameStore((s) => s.setInputPriority);
  const repairBuilding = useGameStore((s) => s.repairBuilding);
  const updateTileSettings = useGameStore((s) => s.updateTileSettings);

  const building = useMemo(() => 
    buildings.find(b => b.id === buildingId),
    [buildings, buildingId]
  );

  if (!buildingId || !building) {
    return (
      <Modal open onClose={onClose} title="Настройки здания" size="sm">
        <div className="p-4">
          <EmptyState title="Здание не найдено" />
        </div>
      </Modal>
    );
  }

  // Создаём дефолтные настройки если их нет
  const settings: TileBuildingSettings = tileSettings ?? {
    tileKey,
    buildingId,
    mode: 'normal',
    enabled: true,
    health: 100,
    inputPriorities: {},
    outputPriority: 3,
    storageLimits: [],
    autoSell: [],
    conditions: [],
    stats: {
      totalProduced: '0',
      totalConsumed: '0',
      uptime: 100,
      efficiency: 100,
      lastActiveAt: Date.now(),
      createdAt: Date.now(),
    },
  };

  const currentMode = BUILDING_MODES[settings.mode];
  const repairCost = D((100 - settings.health) * 10);
  const canRepair = credits.gte(repairCost) && settings.health < 100;

  // Получаем ресурсы, которые потребляет/производит здание
  const consumedResources = Object.keys(building.consumption ?? {}) as ResourceType[];
  const producedResources = Object.keys(building.production ?? {}) as ResourceType[];

  const BuildingIcon = getBuildingIcon(buildingId);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={building.name}
      subtitle={`Настройки • ${tileKey}`}
      icon={<BuildingIcon size={24} />}
      footer={
        <>
          <p className="mb-2 text-sm text-cyber-muted">Быстрые пресеты:</p>
          <div className="flex flex-wrap gap-2">
            {Object.values(SETTINGS_PRESETS).map(preset => (
              <button
                key={preset.id}
                onClick={() => {
                  // Применяем пресет полностью через applyPreset
                  const newSettings = applyPreset(settings, preset.id, producedResources);
                  updateTileSettings(tileKey, newSettings);
                }}
                className="btn btn-xs"
                title={preset.description}
              >
                <GameIcon icon={preset.emoji} /> {preset.name}
              </button>
            ))}
          </div>
        </>
      }
    >
      {/* Статус */}
      <div className="flex items-center gap-4 border-b border-cyber-border bg-cyber-darker p-4">
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: settings.enabled ? currentMode.color : '#6b7280' }}
          />
          <span className="text-sm">
            {settings.enabled ? currentMode.name : 'Отключено'}
          </span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <span className="text-sm text-cyber-muted">Здоровье:</span>
          {/*
            `.meter` из дизайн-системы, но заливка красится вручную: здесь непрерывная
            шкала (зелёный/жёлтый/красный по порогам 70/30), а `Meter` знает только
            фиксированные семантические тона.
          */}
          <div className="meter w-24">
            <div
              className="meter-fill"
              style={{
                width: `${settings.health}%`,
                backgroundColor: settings.health > 70 ? '#22c55e' : settings.health > 30 ? '#f59e0b' : '#ef4444'
              }}
            />
          </div>
          <span className="text-sm">{settings.health}%</span>
        </div>

        {settings.health < 100 && (
          <button
            onClick={() => repairBuilding(tileKey)}
            disabled={!canRepair}
            className="btn btn-info btn-xs"
          >
            <GameIcon icon="🔧" /> Ремонт ({formatNumber(repairCost)} ₡)
          </button>
        )}
      </div>

      {/* Табы */}
      <div className="p-2">
        <Tabs items={SETTINGS_TABS} value={activeTab} onChange={setActiveTab} />
      </div>

      {/* Контент табов */}
      <div className="p-4">
        {activeTab === 'mode' && (
          <ModeTab
            settings={settings}
            onModeChange={(mode) => setBuildingMode(tileKey, mode)}
            onEnabledChange={(enabled) => setBuildingEnabled(tileKey, enabled)}
          />
        )}

        {activeTab === 'priority' && (
          <PriorityTab
            settings={settings}
            consumedResources={consumedResources}
            producedResources={producedResources}
            onInputPriorityChange={(res, priority) => setInputPriority(tileKey, res, priority)}
            onOutputPriorityChange={(priority) => setOutputPriority(tileKey, priority)}
          />
        )}

        {activeTab === 'auto' && (
          <AutoSellTab settings={settings} tileKey={tileKey} producedResources={producedResources} />
        )}

        {activeTab === 'conditions' && (
          <ConditionsTab settings={settings} tileKey={tileKey} />
        )}
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// ТАБЫ
// ═══════════════════════════════════════════════════════════════

interface ModeTabProps {
  settings: TileBuildingSettings;
  onModeChange: (mode: BuildingMode) => void;
  onEnabledChange: (enabled: boolean) => void;
}

function ModeTab({ settings, onModeChange, onEnabledChange }: ModeTabProps) {
  return (
    <div className="space-y-6">
      {/* Включение/выключение */}
      <div className="flex items-center justify-between p-4 bg-cyber-darker rounded-lg">
        <div>
          <h3 className="font-medium text-cyber-text">Статус здания</h3>
          <p className="text-sm text-cyber-muted">Включить или выключить работу здания</p>
        </div>
        <button
          onClick={() => onEnabledChange(!settings.enabled)}
          className={`w-14 h-7 rounded-full transition-colors relative ${
            settings.enabled ? 'bg-cyber-green' : 'bg-cyber-darker border border-cyber-border'
          }`}
        >
          <span 
            className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${
              settings.enabled ? 'left-8' : 'left-1'
            }`}
          />
        </button>
      </div>

      {/* Выбор режима */}
      <div>
        <h3 className="font-medium text-cyber-text mb-3">Режим работы</h3>
        <div className="grid grid-cols-1 gap-2">
          {Object.values(BUILDING_MODES).map(mode => (
            <button
              key={mode.id}
              onClick={() => onModeChange(mode.id)}
              className={`flex items-center gap-4 p-4 rounded-lg border transition-all text-left ${
                settings.mode === mode.id
                  ? 'border-cyber-blue bg-cyber-blue/10'
                  : 'border-cyber-border hover:border-cyber-blue/50'
              }`}
            >
              <span 
                className="text-2xl w-10 h-10 flex items-center justify-center rounded"
                style={{ backgroundColor: mode.color + '20' }}
              >
                <GameIcon icon={mode.emoji} />
              </span>
              <div className="flex-1">
                <p className="font-medium text-cyber-text">{mode.name}</p>
                <p className="text-sm text-cyber-muted"><IconText>{mode.description}</IconText></p>
              </div>
              <div className="text-right text-sm">
                <p>Производство: <span className={mode.productionMultiplier > 1 ? 'text-green-400' : mode.productionMultiplier < 1 ? 'text-yellow-400' : ''}>{Math.round(mode.productionMultiplier * 100)}%</span></p>
                <p>Потребление: <span className={mode.consumptionMultiplier < 1 ? 'text-green-400' : mode.consumptionMultiplier > 1 ? 'text-red-400' : ''}>{Math.round(mode.consumptionMultiplier * 100)}%</span></p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface PriorityTabProps {
  settings: TileBuildingSettings;
  consumedResources: ResourceType[];
  producedResources: ResourceType[];
  onInputPriorityChange: (resource: ResourceType, priority: ResourcePriority) => void;
  onOutputPriorityChange: (priority: ResourcePriority) => void;
}

function PriorityTab({ 
  settings, 
  consumedResources, 
  producedResources,
  onInputPriorityChange, 
  onOutputPriorityChange 
}: PriorityTabProps) {
  const priorities: ResourcePriority[] = [1, 2, 3, 4, 5];

  return (
    <div className="space-y-6">
      {/* Приоритет выхода */}
      <div>
        <h3 className="font-medium text-cyber-text mb-2">Приоритет производства</h3>
        <p className="text-sm text-cyber-muted mb-3">
          Здания с высоким приоритетом получают ресурсы первыми
        </p>
        <div className="flex gap-2">
          {priorities.map(p => (
            <button
              key={p}
              onClick={() => onOutputPriorityChange(p)}
              className={`flex-1 py-3 rounded-lg border transition-all ${
                settings.outputPriority === p
                  ? 'border-2'
                  : 'border-cyber-border hover:border-cyber-blue/50'
              }`}
              style={{ 
                borderColor: settings.outputPriority === p ? PRIORITY_LABELS[p].color : undefined,
                backgroundColor: settings.outputPriority === p ? PRIORITY_LABELS[p].color + '20' : undefined
              }}
            >
              <p className="text-lg font-bold">{p}</p>
              <p className="text-xs text-cyber-muted">{PRIORITY_LABELS[p].name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Приоритеты входов */}
      {consumedResources.length > 0 && (
        <div>
          <h3 className="font-medium text-cyber-text mb-2">Приоритеты потребления</h3>
          <p className="text-sm text-cyber-muted mb-3">
            При нехватке ресурсов, высокий приоритет получает первым
          </p>
          <div className="space-y-2">
            {consumedResources.map(resource => {
              const currentPriority = settings.inputPriorities[resource] ?? 3;
              return (
                <div key={resource} className="flex items-center gap-4 p-3 bg-cyber-darker rounded-lg">
                  <span className="text-sm font-medium w-32">
                    {RESOURCE_LABEL[resource] ?? resource}
                  </span>
                  <div className="flex gap-1 flex-1">
                    {priorities.map(p => (
                      <button
                        key={p}
                        onClick={() => onInputPriorityChange(resource, p)}
                        className={`flex-1 py-2 rounded transition-all text-sm ${
                          currentPriority === p
                            ? 'font-bold'
                            : 'text-cyber-muted hover:text-cyber-text'
                        }`}
                        style={{ 
                          backgroundColor: currentPriority === p ? PRIORITY_LABELS[p].color + '30' : undefined,
                          color: currentPriority === p ? PRIORITY_LABELS[p].color : undefined
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {consumedResources.length === 0 && producedResources.length === 0 && (
        <EmptyState title="Это здание не потребляет ресурсы" />
      )}
    </div>
  );
}

interface AutoSellTabProps {
  settings: TileBuildingSettings;
  tileKey: string;
  producedResources: ResourceType[];
}

function AutoSellTab({ settings, tileKey, producedResources }: AutoSellTabProps) {
  const updateAutoSell = useGameStore((s) => s.updateAutoSell);

  return (
    <div className="space-y-4">
      <p className="text-sm text-cyber-muted">
        Автоматически продавать ресурсы когда хранилище заполнено выше порога
      </p>

      {producedResources.length === 0 ? (
        <EmptyState title="Это здание не производит ресурсы" />
      ) : (
        <div className="space-y-3">
          {producedResources.map(resource => {
            const config = settings.autoSell.find(c => c.resource === resource);
            const isEnabled = config?.enabled ?? false;
            const threshold = config?.threshold ?? 80;

            return (
              <div key={resource} className="p-4 bg-cyber-darker rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium">
                    {RESOURCE_LABEL[resource] ?? resource}
                  </span>
                  <button
                    onClick={() => {
                      updateAutoSell(tileKey, {
                        enabled: !isEnabled,
                        resource,
                        threshold,
                        keepAmount: '0',
                      });
                    }}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      isEnabled ? 'bg-cyber-green' : 'bg-cyber-darker border border-cyber-border'
                    }`}
                  >
                    <span 
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                        isEnabled ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {isEnabled && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-cyber-muted w-24">Порог:</span>
                      <input
                        type="range"
                        min="10"
                        max="95"
                        step="5"
                        value={threshold}
                        onChange={(e) => {
                          updateAutoSell(tileKey, {
                            ...config!,
                            threshold: Number(e.target.value),
                          });
                        }}
                        className="flex-1"
                      />
                      <span className="text-sm w-12 text-right">{threshold}%</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ConditionsTabProps {
  settings: TileBuildingSettings;
  tileKey: string;
}

function ConditionsTab({ settings, tileKey }: ConditionsTabProps) {
  const addBuildingCondition = useGameStore((s) => s.addBuildingCondition);
  const removeBuildingCondition = useGameStore((s) => s.removeBuildingCondition);

  return (
    <div className="space-y-4">
      <p className="text-sm text-cyber-muted">
        Автоматически включать/выключать здание или менять режим при определённых условиях
      </p>

      {settings.conditions.length === 0 ? (
        <EmptyState
          title="Нет активных условий"
          action={
            <button
              onClick={() => {
                addBuildingCondition(tileKey, {
                  id: `cond_${Date.now()}`,
                  type: 'resource_above',
                  resource: 'energy',
                  value: 80,
                  action: 'enable',
                  enabled: true,
                });
              }}
              className="btn btn-info"
            >
              + Добавить условие
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {settings.conditions.map(condition => (
            <div key={condition.id} className="flex items-center gap-3 p-3 bg-cyber-darker rounded-lg">
              <span className="flex-1 text-sm">
                {condition.type === 'resource_above' && `Когда ${condition.resource} > ${condition.value}%`}
                {condition.type === 'resource_below' && `Когда ${condition.resource} < ${condition.value}%`}
                {condition.type === 'energy_available' && `Когда энергии > ${condition.value}%`}
                <GameIcon icon="→" /> {condition.action === 'enable' ? 'Включить' : condition.action === 'disable' ? 'Выключить' : `Режим: ${condition.targetMode}`}
              </span>
              <button
                onClick={() => removeBuildingCondition(tileKey, condition.id)}
                className="text-red-400 hover:text-red-300"
              >
                <GameIcon icon="✕" />
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              addBuildingCondition(tileKey, {
                id: `cond_${Date.now()}`,
                type: 'resource_above',
                resource: 'energy',
                value: 80,
                action: 'enable',
                enabled: true,
              });
            }}
            className="w-full px-4 py-2 border border-dashed border-cyber-border rounded hover:border-cyber-blue text-cyber-muted hover:text-cyber-text"
          >
            + Добавить условие
          </button>
        </div>
      )}
    </div>
  );
}
