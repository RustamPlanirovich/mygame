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
import {
  COMPARATOR_LABEL,
  MATCH_LABEL,
  RULE_ACTIONS,
  RULE_GROUP_LABEL,
  RULE_METRICS,
  RULE_METRIC_GROUPS,
  availableActions,
  availableTemplates,
  describeRule,
  rulesControlling,
  rulesOf,
  validateRule,
  type BuildingRule,
  type RuleAction,
  type RuleActionType,
  type RuleComparator,
  type RuleMatch,
  type RuleMetric,
  type RuleTemplate,
  type RuleTemplateContext,
  type RuleTrigger,
} from '../../../core/systems/buildingRules';
import { RESOURCE_LABEL } from '../../../core/constants/labels';
import { isBuildingDisableable } from '../../../core/constants/buildingCategories';
import { TRADEABLE_RESOURCES } from '../../../core/constants/market';
import { resourceLabel } from '../../../core/i18n/label';
import { getBuildingIcon } from '../../../core/constants/buildingIcons';
import type { ResourceType } from '../../../core/gameTypes';
import { formatNumber, D } from '../../../core/math/format';
import { GameIcon, IconText } from '../../ui/icons';

interface BuildingSettingsPanelProps {
  tileKey: string;
  onClose: () => void;
}

type SettingsTabId = 'mode' | 'priority' | 'auto' | 'rules';

const SETTINGS_TABS: TabItem<SettingsTabId>[] = [
  { id: 'mode', label: '⚙️ Режим' },
  { id: 'priority', label: '📊 Приоритеты' },
  { id: 'auto', label: '🤖 Авто-продажа' },
  { id: 'rules', label: '📋 Правила' },
];

export function BuildingSettingsPanel({ tileKey, onClose }: BuildingSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('mode');

  const buildingId = useGameStore((s) => s.grid.tiles[tileKey]);
  const buildings = useGameStore((s) => s.buildings);
  const tileSettings = useGameStore((s) => s.grid.tileSettings?.[tileKey]);
  // Остановка живёт в grid.tileDisabled — там же, где её видит кнопка в инспекторе (bigplan 42).
  const disabled = useGameStore((s) => s.grid.tileDisabled?.[tileKey] ?? false);
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
    health: 100,
    inputPriorities: {},
    outputPriority: 3,
    storageLimits: [],
    autoSell: [],
    rules: [],
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

  /*
   * Какими ручными переключателями распоряжаются правила. Считается здесь и раздаётся
   * вкладкам: переключатель, который правило вернёт обратно через секунду, обязан сказать
   * об этом заранее — иначе он читается как сломанная кнопка.
   */
  const rules = rulesOf(settings);
  const powerRules = rulesControlling(rules, 'power');
  const modeRules = rulesControlling(rules, 'mode');

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
            style={{ backgroundColor: disabled ? '#7f849f' : currentMode.color }}
          />
          <span className="text-sm">
            {disabled ? (powerRules.length > 0 ? 'Остановлено правилом' : 'Отключено') : currentMode.name}
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
                backgroundColor: settings.health > 70 ? '#3ee07f' : settings.health > 30 ? '#ffb86c' : '#ff5555'
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
            disabled={disabled}
            powerRules={powerRules}
            modeRules={modeRules}
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
          <AutoSellTab
            settings={settings}
            tileKey={tileKey}
            producedResources={producedResources}
            rules={rules}
          />
        )}

        {activeTab === 'rules' && (
          <RulesTab
            settings={settings}
            tileKey={tileKey}
            canDisable={isBuildingDisableable(buildingId)}
            consumedResources={consumedResources}
            producedResources={producedResources}
          />
        )}
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// ТАБЫ
// ═══════════════════════════════════════════════════════════════

interface RuleControlNoteProps {
  rules: BuildingRule[];
  /** Чем распоряжаются правила, с большой буквы: «Остановкой», «Режимом», «Авто-продажей». */
  what: string;
  /** Что будет, если игрок всё равно нажмёт. */
  hint: string;
}

/**
 * Пометка «этим управляет правило» (bigplan 42).
 *
 * Ручное управление НЕ запирается: запертая кнопка не объясняет, почему она заперта, и
 * заставляет игрока идти искать причину. Правило всё равно сильнее — оно перещёлкнет обратно
 * на ближайшей проверке, — поэтому честнее сказать об этом прямо и назвать виновника.
 */
function RuleControlNote({ rules, what, hint }: RuleControlNoteProps) {
  if (rules.length === 0) return null;

  return (
    <div className="mt-2 rounded border border-cyber-blue/30 bg-cyber-blue/10 p-2 text-xs text-cyber-muted">
      <p className="text-cyber-text">
        <GameIcon icon="🤖" /> {what} управляет {rules.length > 1 ? 'правила' : 'правило'}: {rules.map(r => describeRule(r)).join('; ')}
      </p>
      <p className="mt-0.5">{hint}</p>
    </div>
  );
}

interface ModeTabProps {
  settings: TileBuildingSettings;
  /** Остановлено ли здание. Источник — grid.tileDisabled, тот же, что у кнопки в инспекторе. */
  disabled: boolean;
  /** Правила, распоряжающиеся остановкой. */
  powerRules: BuildingRule[];
  /** Правила, распоряжающиеся режимом работы. */
  modeRules: BuildingRule[];
  onModeChange: (mode: BuildingMode) => void;
  onEnabledChange: (enabled: boolean) => void;
}

function ModeTab({ settings, disabled, powerRules, modeRules, onModeChange, onEnabledChange }: ModeTabProps) {
  return (
    <div className="space-y-6">
      {/* Включение/выключение */}
      <div className="p-4 bg-cyber-darker rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-cyber-text">Статус здания</h3>
            <p className="text-sm text-cyber-muted">Включить или выключить работу здания</p>
          </div>
          <button
            onClick={() => onEnabledChange(disabled)}
            className={`w-14 h-7 rounded-full transition-colors relative ${
              disabled ? 'bg-cyber-darker border border-cyber-border' : 'bg-cyber-green'
            }`}
          >
            <span
              className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${
                disabled ? 'left-1' : 'left-8'
              }`}
            />
          </button>
        </div>
        <RuleControlNote
          rules={powerRules}
          what="Остановкой"
          hint="Переключатель сработает, но ближайшая проверка правил вернёт своё."
        />
      </div>

      {/* Выбор режима */}
      <div>
        <h3 className="font-medium text-cyber-text mb-3">Режим работы</h3>
        <RuleControlNote
          rules={modeRules}
          what="Режимом"
          hint="Выбранный вручную режим продержится до ближайшей проверки правил."
        />
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
                  ? 'border'
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
  /** Все правила клетки: по ним видно, чью авто-продажу дёргает автоматика. */
  rules: BuildingRule[];
}

function AutoSellTab({ settings, tileKey, producedResources, rules }: AutoSellTabProps) {
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
            // Правила именно по ЭТОМУ ресурсу: продажа стали не должна помечать тумблер руды.
            const sellRules = rulesControlling(rules, 'autoSell', resource);

            return (
              <div key={resource} className="p-4 bg-cyber-darker rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium">
                    {resourceLabel(resource)}
                  </span>
                  <button
                    onClick={() => {
                      updateAutoSell(tileKey, {
                        enabled: !isEnabled,
                        resource,
                        threshold,
                        keepAmount: config?.keepAmount ?? '0',
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

                <RuleControlNote
                  rules={sellRules}
                  what="Авто-продажей"
                  hint="Тумблер и порог переставит ближайшая проверка правил."
                />

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

// ═══════════════════════════════════════════════════════════════
// ПРАВИЛА АВТОМАТИЗАЦИИ (bigplan 42)
// ═══════════════════════════════════════════════════════════════

/*
 * Здесь была вкладка «Условия» — обманка: список складывался в сейв, но НИКТО его не читал,
 * а кнопка «+ Добавить условие» всегда вставляла один и тот же захардкоженный «энергия > 80%
 * → включить», менять в нём было нечего. Теперь это конструктор: блоки-условия из
 * `core/systems/buildingRules.ts` собираются в правило, а игровой цикл его исполняет.
 *
 * Вся логика — в чистом модуле; здесь только редактирование. Любое изменение сразу пишется
 * через `upsertBuildingRule`: черновика с кнопкой «Сохранить» нет намеренно, иначе закрытие
 * модалки теряло бы набранное правило.
 */

interface RulesTabProps {
  settings: TileBuildingSettings;
  tileKey: string;
  /** Умеет ли игра останавливать это здание: у неотключаемых нет и кнопки в инспекторе. */
  canDisable: boolean;
  consumedResources: ResourceType[];
  producedResources: ResourceType[];
}

function RulesTab({ settings, tileKey, canDisable, consumedResources, producedResources }: RulesTabProps) {
  const upsertBuildingRule = useGameStore((s) => s.upsertBuildingRule);
  const removeBuildingRule = useGameStore((s) => s.removeBuildingRule);

  const rules = useMemo(() => rulesOf(settings), [settings]);

  // Ресурсы здания идут первыми: правило почти всегда про то, что здание само делает.
  const ownResources = useMemo(() => {
    const seen = new Set<ResourceType>();
    const list: ResourceType[] = [];
    for (const r of [...producedResources, ...consumedResources]) {
      if (seen.has(r)) continue;
      seen.add(r);
      list.push(r);
    }
    return list;
  }, [producedResources, consumedResources]);

  const templates = useMemo(() => {
    const ctx: RuleTemplateContext = {
      produced: producedResources[0],
      consumed: consumedResources[0],
      tradeableProduced: producedResources.find(r => TRADEABLE_RESOURCES.includes(r)),
    };
    return { ctx, list: availableTemplates(ctx) };
  }, [producedResources, consumedResources]);

  const addEmptyRule = () => {
    const seed = String(Date.now());
    upsertBuildingRule(tileKey, {
      id: `rule_${seed}`,
      enabled: true,
      match: 'all',
      triggers: [
        {
          id: `rule_${seed}_t0`,
          metric: 'resource_fill',
          resource: ownResources[0],
          op: 'gt',
          value: RULE_METRICS.resource_fill.defaultValue,
        },
      ],
      action: canDisable ? { type: 'disable' } : { type: 'notify' },
    });
  };

  const applyTemplate = (template: RuleTemplate) => {
    const rule = template.build(templates.ctx, String(Date.now()));
    if (rule) upsertBuildingRule(tileKey, rule);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-cyber-muted">
        Правило срабатывает, <b>пока</b> его условия выполняются, и ничего не откатывает обратно —
        обратное действие задаётся вторым правилом. Проверка идёт раз в секунду, правила
        применяются сверху вниз: нижнее переписывает верхнее.
      </p>

      {/* Готовые сценарии */}
      {templates.list.length > 0 && (
        <div className="rounded-lg bg-cyber-darker p-3">
          <p className="mb-2 text-sm font-medium text-cyber-text">Готовые сценарии</p>
          <div className="flex flex-wrap gap-2">
            {templates.list.map(template => (
              <button
                key={template.id}
                onClick={() => applyTemplate(template)}
                className="btn btn-xs"
                title={template.description}
              >
                <GameIcon icon={template.emoji} /> {template.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {rules.length === 0 ? (
        <EmptyState
          title="Правил нет"
          hint="Здание работает так, как настроено на других вкладках."
          action={
            <button onClick={addEmptyRule} className="btn btn-info">
              + Своё правило
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {rules.map((rule, index) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              index={index}
              canDisable={canDisable}
              ownResources={ownResources}
              onChange={(next) => upsertBuildingRule(tileKey, next)}
              onRemove={() => removeBuildingRule(tileKey, rule.id)}
            />
          ))}
          <button
            onClick={addEmptyRule}
            className="w-full rounded border border-dashed border-cyber-border px-4 py-2 text-cyber-muted hover:border-cyber-blue hover:text-cyber-text"
          >
            + Своё правило
          </button>
        </div>
      )}
    </div>
  );
}

interface RuleCardProps {
  rule: BuildingRule;
  index: number;
  canDisable: boolean;
  ownResources: ResourceType[];
  onChange: (rule: BuildingRule) => void;
  onRemove: () => void;
}

function RuleCard({ rule, index, canDisable, ownResources, onChange, onRemove }: RuleCardProps) {
  const problems = validateRule(rule, canDisable);
  const actionMeta = RULE_ACTIONS[rule.action.type];

  const patchTrigger = (triggerId: string, patch: Partial<RuleTrigger>) => {
    onChange({
      ...rule,
      triggers: rule.triggers.map(t => (t.id === triggerId ? { ...t, ...patch } : t)),
    });
  };

  const addTrigger = () => {
    onChange({
      ...rule,
      triggers: [
        ...rule.triggers,
        {
          id: `${rule.id}_t${rule.triggers.length}_${Date.now()}`,
          metric: 'energy_coverage',
          op: 'lt',
          value: RULE_METRICS.energy_coverage.defaultValue,
        },
      ],
    });
  };

  const patchAction = (patch: Partial<RuleAction>) => {
    onChange({ ...rule, action: { ...rule.action, ...patch } });
  };

  return (
    <div
      className={`rounded-lg border p-3 ${
        rule.enabled ? 'border-cyber-border bg-cyber-darker' : 'border-cyber-border/50 bg-cyber-darker/40'
      }`}
    >
      {/* Заголовок */}
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={() => onChange({ ...rule, enabled: !rule.enabled })}
          className={`h-6 w-11 rounded-full transition-colors relative shrink-0 ${
            rule.enabled ? 'bg-cyber-green' : 'bg-cyber-darker border border-cyber-border'
          }`}
          title={rule.enabled ? 'Правило включено' : 'Правило выключено'}
        >
          <span
            className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${
              rule.enabled ? 'left-6' : 'left-1'
            }`}
          />
        </button>
        <span className="text-xs text-cyber-muted">#{index + 1}</span>
        <input
          type="text"
          value={rule.name ?? ''}
          onChange={(e) => onChange({ ...rule, name: e.target.value })}
          placeholder="Название правила"
          className="flex-1 rounded px-2 py-1 text-sm"
        />
        <button onClick={onRemove} className="text-red-400 hover:text-red-300" title="Удалить правило">
          <GameIcon icon="✕" />
        </button>
      </div>

      {/* Условия */}
      <div className="mb-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-medium text-cyber-text">Если</span>
          <select
            value={rule.match}
            onChange={(e) => onChange({ ...rule, match: e.target.value as RuleMatch })}
            className="rounded px-2 py-1 text-xs"
          >
            {(Object.keys(MATCH_LABEL) as RuleMatch[]).map(m => (
              <option key={m} value={m}>{MATCH_LABEL[m]}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          {rule.triggers.map(trigger => (
            <TriggerRow
              key={trigger.id}
              trigger={trigger}
              ownResources={ownResources}
              onChange={(patch) => patchTrigger(trigger.id, patch)}
              onRemove={
                rule.triggers.length > 1
                  ? () => onChange({ ...rule, triggers: rule.triggers.filter(t => t.id !== trigger.id) })
                  : undefined
              }
            />
          ))}
        </div>

        <button
          onClick={addTrigger}
          className="mt-2 rounded border border-dashed border-cyber-border px-3 py-1 text-xs text-cyber-muted hover:border-cyber-blue hover:text-cyber-text"
        >
          + Условие
        </button>
      </div>

      {/* Действие */}
      <div className="flex flex-wrap items-center gap-2 border-t border-cyber-border pt-3">
        <span className="text-sm font-medium text-cyber-text">То</span>
        <select
          value={rule.action.type}
          onChange={(e) => patchAction({ type: e.target.value as RuleActionType })}
          className="rounded px-2 py-1 text-xs"
          title={actionMeta?.hint}
        >
          {availableActions(canDisable).map(meta => (
            <option key={meta.id} value={meta.id}>{meta.label}</option>
          ))}
        </select>

        {actionMeta?.needsMode && (
          <select
            value={rule.action.mode ?? ''}
            onChange={(e) => patchAction({ mode: e.target.value as BuildingMode })}
            className="rounded px-2 py-1 text-xs"
          >
            <option value="">— режим —</option>
            {Object.values(BUILDING_MODES).map(mode => (
              <option key={mode.id} value={mode.id}>{mode.name}</option>
            ))}
          </select>
        )}

        {actionMeta?.needsResource && (
          <ResourceSelect
            value={rule.action.resource}
            ownResources={ownResources}
            tradeableOnly
            onChange={(resource) => patchAction({ resource })}
          />
        )}

        {actionMeta?.needsThreshold && (
          <label className="flex items-center gap-1 text-xs text-cyber-muted">
            при
            <input
              type="number"
              min={0}
              max={100}
              value={rule.action.threshold ?? 80}
              onChange={(e) => patchAction({ threshold: Number(e.target.value) })}
              className="w-16 rounded px-2 py-1 text-xs"
            />
            % склада
          </label>
        )}

        {rule.action.type === 'notify' && (
          <input
            type="text"
            value={rule.action.message ?? ''}
            onChange={(e) => patchAction({ message: e.target.value })}
            placeholder="Текст уведомления (по умолчанию — описание правила)"
            className="min-w-[12rem] flex-1 rounded px-2 py-1 text-xs"
          />
        )}
      </div>

      {/* Итог и проблемы */}
      <p className="mt-3 text-xs text-cyber-muted">{describeRule({ ...rule, name: undefined })}</p>

      {problems.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-yellow-400">
          {problems.map((problem, i) => (
            <li key={i}>
              <GameIcon icon="⚠️" /> {problem}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface TriggerRowProps {
  trigger: RuleTrigger;
  ownResources: ResourceType[];
  onChange: (patch: Partial<RuleTrigger>) => void;
  onRemove?: () => void;
}

function TriggerRow({ trigger, ownResources, onChange, onRemove }: TriggerRowProps) {
  const meta = RULE_METRICS[trigger.metric];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded bg-cyber-dark/60 p-2">
      <select
        value={trigger.metric}
        onChange={(e) => {
          const metric = e.target.value as RuleMetric;
          const nextMeta = RULE_METRICS[metric];
          /*
           * Значение подставляем осмысленное: порог предыдущей метрики (например, 80% склада)
           * в новой единице (кредиты, цена) означал бы совсем другое, и правило сработало бы
           * не так. Ресурс переносим ТОЛЬКО если он есть в новом наборе: у цены набор
           * ограничен биржей, и «руда» осталась бы выбранной в поле, где её нет в списке —
           * в селекте пусто, а правило молча не срабатывает.
           */
          const pool = resourcePool(nextMeta.tradeableOnly);
          const kept = trigger.resource && pool.includes(trigger.resource) ? trigger.resource : undefined;
          onChange({
            metric,
            value: nextMeta.defaultValue,
            resource: nextMeta.needsResource
              ? kept ?? ownResources.find(r => pool.includes(r))
              : undefined,
          });
        }}
        className="rounded px-2 py-1 text-xs"
        title={meta?.hint}
      >
        {RULE_METRIC_GROUPS.map(group => (
          <optgroup key={group.group} label={RULE_GROUP_LABEL[group.group]}>
            {group.metrics.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {meta?.needsResource && (
        <ResourceSelect
          value={trigger.resource}
          ownResources={ownResources}
          tradeableOnly={meta.tradeableOnly}
          onChange={(resource) => onChange({ resource })}
        />
      )}

      <select
        value={trigger.op}
        onChange={(e) => onChange({ op: e.target.value as RuleComparator })}
        className="rounded px-2 py-1 text-xs"
      >
        {(Object.keys(COMPARATOR_LABEL) as RuleComparator[]).map(op => (
          <option key={op} value={op}>{COMPARATOR_LABEL[op]}</option>
        ))}
      </select>

      <input
        type="number"
        value={Number.isFinite(trigger.value) ? trigger.value : ''}
        onChange={(e) => onChange({ value: Number(e.target.value) })}
        className="w-24 rounded px-2 py-1 text-xs"
      />
      <span className="text-xs text-cyber-muted">{meta?.unit}</span>

      <div className="flex-1" />

      {onRemove && (
        <button onClick={onRemove} className="text-red-400 hover:text-red-300" title="Убрать условие">
          <GameIcon icon="✕" />
        </button>
      )}
    </div>
  );
}

/** Из чего вообще можно выбирать: у цены набор ограничен тем, что торгуется на бирже. */
function resourcePool(tradeableOnly?: boolean): ResourceType[] {
  return tradeableOnly ? TRADEABLE_RESOURCES : (Object.keys(RESOURCE_LABEL) as ResourceType[]);
}

interface ResourceSelectProps {
  value: ResourceType | undefined;
  ownResources: ResourceType[];
  tradeableOnly?: boolean;
  onChange: (resource: ResourceType) => void;
}

/**
 * Выбор ресурса. Ресурсы здания вынесены в отдельную группу сверху: искать «руду» среди
 * полусотни позиций для шахты, которая ничего кроме руды не делает, — лишняя работа.
 */
function ResourceSelect({ value, ownResources, tradeableOnly, onChange }: ResourceSelectProps) {
  const pool = resourcePool(tradeableOnly);
  const own = ownResources.filter(r => pool.includes(r));
  const rest = pool.filter(r => !own.includes(r));

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value as ResourceType)}
      className="rounded px-2 py-1 text-xs"
    >
      <option value="">— ресурс —</option>
      {own.length > 0 && (
        <optgroup label="Ресурсы этого здания">
          {own.map(r => (
            <option key={r} value={r}>{resourceLabel(r)}</option>
          ))}
        </optgroup>
      )}
      <optgroup label={tradeableOnly ? 'Все торгуемые' : 'Все ресурсы'}>
        {rest.map(r => (
          <option key={r} value={r}>{resourceLabel(r)}</option>
        ))}
      </optgroup>
    </select>
  );
}
