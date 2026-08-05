import { useCallback, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import Decimal from 'break_eternity.js';
import { useGameStore } from '../../features/gameStore';
import { useFinanceStore } from '../../features/financeStore';
import { useUiStore, type PanelSectionId } from '../../features/uiStore';
import { GameIcon } from '../ui/icons';
import { ChevronLeft, X } from 'lucide-react';

import { BuildPanel } from './BuildPanel';
import { TileInspector } from './TileInspector';
import { CombatPanel } from './CombatPanel';
import { MarketPanel } from './MarketPanel';
import { ResearchPanel } from './ResearchPanel';
import { DemonsPanel } from './DemonsPanel';
import { PrestigePanel } from './PrestigePanel';
import { ArtifactsPanel } from './ArtifactsPanel';
import { DailyRewardsPanel } from './DailyRewardsPanel';
import { ProductionChainVisualizer } from './ProductionChainVisualizer';
import { ChatPanel } from './ChatPanel';
import { useChatStore } from '../../features/chatStore';
import { ExpeditionPanel } from './ExpeditionPanel';
import { PoliticsPanel } from './PoliticsPanel';
import { GalaxyMap } from './GalaxyMap';
import { PlatformsPanel } from './PlatformsPanel';
import { FleetPanel } from './FleetPanel';
import { IntergalacticLogisticsPanel } from './IntergalacticLogisticsPanel';
import { RandomEventsPanel } from './RandomEventsPanel';
import AchievementsPanel from './AchievementsPanel';
import { MegastructuresPanel } from './MegastructuresPanel';
import { QuestsPanel } from './QuestsPanel';
import { HelpPanel } from './HelpPanel';
import { AnalyticsPanel } from './analytics';
import { FinancePanel } from './finance';
import { CulturePanel } from './culture/CulturePanel';
import { EnergyBalancePanel } from './EnergyBalancePanel';
import { PollutionPanel } from './PollutionPanel';
import { SettingsPanel } from './SettingsPanel';

/*
 * Правая панель. Одна оболочка — заголовок с акцентной полосой, «назад» и крестик —
 * и один раздел внутри. Раньше оболочка и роутинг жили в SidePanelTabs вместе с
 * главным меню-списком в один столбец: до «Экспедиции» приходилось скроллить весь
 * список из 24 пунктов. Теперь меню — сетка из двух колонок по группам, а сама
 * панель лежит НАД картой (карта больше не сжимается при открытии, камера не прыгает).
 */

interface Section {
  id: PanelSectionId;
  label: string;
  icon: string;
  /** Разделы с пропсами рендерятся отдельно в renderSection(). */
  Component?: React.ComponentType;
}

interface SectionGroup {
  title: string;
  items: Section[];
}

const GROUPS: SectionGroup[] = [
  {
    title: 'Фабрика',
    items: [
      { id: 'build', label: 'Строительство', icon: 'crane', Component: BuildPanel },
      { id: 'inspector', label: 'Инспектор', icon: 'eye', Component: TileInspector },
      { id: 'power', label: 'Энергия и экология', icon: 'bolt' },
      { id: 'chains', label: 'Цепочки', icon: 'network', Component: ProductionChainVisualizer },
      { id: 'analytics', label: 'Аналитика', icon: 'chartBars', Component: AnalyticsPanel },
    ],
  },
  {
    title: 'Экономика',
    items: [
      { id: 'market', label: 'Рынок', icon: 'market', Component: MarketPanel },
      { id: 'finance', label: 'Финансы', icon: 'bank' },
      { id: 'logistics', label: 'Логистика', icon: 'truck', Component: IntergalacticLogisticsPanel },
    ],
  },
  {
    title: 'Развитие',
    items: [
      { id: 'research', label: 'Исследования', icon: 'research', Component: ResearchPanel },
      { id: 'culture', label: 'Культура', icon: 'statue', Component: CulturePanel },
      { id: 'politics', label: 'Политика', icon: 'crown', Component: PoliticsPanel },
      { id: 'megastructures', label: 'Мегаструктуры', icon: 'megastructure', Component: MegastructuresPanel },
      { id: 'prestige', label: 'Престиж', icon: 'starburst', Component: PrestigePanel },
      { id: 'artifacts', label: 'Артефакты', icon: 'gem', Component: ArtifactsPanel },
    ],
  },
  {
    title: 'Космос и бой',
    items: [
      { id: 'galaxies', label: 'Галактики', icon: 'galaxy', Component: GalaxyMap },
      { id: 'platforms', label: 'Платформы', icon: 'platform', Component: PlatformsPanel },
      { id: 'fleet', label: 'Флот', icon: 'rocket', Component: FleetPanel },
      { id: 'expedition', label: 'Экспедиция', icon: 'telescope', Component: ExpeditionPanel },
      { id: 'combat', label: 'Бой', icon: 'swords', Component: CombatPanel },
      { id: 'demons', label: 'Демоны', icon: 'demon', Component: DemonsPanel },
    ],
  },
  {
    title: 'Задания и прочее',
    items: [
      { id: 'chat', label: 'Чат', icon: 'chat' },
      { id: 'quests', label: 'Квесты', icon: 'quest' },
      { id: 'achievements', label: 'Достижения', icon: 'trophy', Component: AchievementsPanel },
      { id: 'events', label: 'События', icon: 'siren', Component: RandomEventsPanel },
      { id: 'rewards', label: 'Награды', icon: 'gift', Component: DailyRewardsPanel },
      { id: 'settings', label: 'Настройки', icon: 'gear', Component: SettingsPanel },
      { id: 'help', label: 'Справка', icon: 'question', Component: HelpPanel },
    ],
  },
];

const SECTIONS: Section[] = GROUPS.flatMap((g) => g.items);

/** Энергия и экология: два коротких блока, ради которых раньше жертвовали высотой карты. */
function PowerSection() {
  return (
    <div className="space-y-2 p-3">
      <EnergyBalancePanel />
      <PollutionPanel />
    </div>
  );
}

export function SidePanel({ streamOnline = true }: { streamOnline?: boolean }) {
  const section = useUiStore((s) => s.section);
  const openSection = useUiStore((s) => s.open);
  const close = useUiStore((s) => s.close);

  const selectTile = useGameStore((s) => s.selectTile);
  const selectBuild = useGameStore((s) => s.selectBuild);

  const grid = useGameStore(
    useShallow((s) => {
      const platformId = s.galaxies.activePlatformId;
      const active =
        (platformId ? s.galaxies.platforms.find((p) => p.id === platformId)?.grid : null) ?? s.grid;
      return {
        selected: active.selected,
        tiles: active.tiles,
        width: active.width,
        height: active.height,
        onPlatform: Boolean(platformId),
      };
    }),
  );

  const activeEventsCount = useGameStore(
    (s) => s.randomEvents.activeEvents.filter((e) => e.status === 'pending').length,
  );
  const recentAchievements = useGameStore(
    (s) => s.achievements.recentlyUnlocked.filter((a) => Date.now() - a.unlockedAt < 10000).length,
  );
  const claimableQuests = useGameStore(
    (s) => s.quests.activeQuests.filter((q) => q.isCompleted && q.isActive).length,
  );
  const chatUnread = useChatStore((s) => s.unread);

  const quests = useGameStore((s) => s.quests.activeQuests);
  const claimQuestReward = useGameStore((s) => s.claimQuestReward);
  const creditsBalance = useGameStore((s) => s.currency.credits);
  const addCredits = useGameStore((s) => s.addCredits);
  const spendCredits = useGameStore((s) => s.spendCredits);

  const handleFinanceTransfer = useCallback(
    (amount: Decimal, direction: 'toBank' | 'fromBank') => {
      if (direction === 'toBank') {
        spendCredits(amount);
        useFinanceStore.getState().depositToBank(amount);
      } else if (useFinanceStore.getState().withdrawFromBank(amount)) {
        addCredits(amount);
      }
    },
    [spendCredits, addCredits],
  );

  const selectedKey = grid.selected ? `${grid.selected.x},${grid.selected.y}` : null;
  const buildingOnTile = selectedKey ? grid.tiles[selectedKey] : null;
  const isBaseTile =
    !grid.onPlatform &&
    grid.selected !== null &&
    grid.selected.x === Math.floor(grid.width / 2) &&
    grid.selected.y === Math.floor(grid.height / 2);

  /*
   * Клик по карте сам решает, что показать: занятая клетка — инспектор, пустая —
   * строительство именно для этой клетки (с её модификаторами). Раздел читаем через
   * getState(), а не из замыкания: иначе крестик закрывал панель, эффект видел старое
   * значение section и открывал её обратно.
   */
  useEffect(() => {
    const current = useUiStore.getState().section;
    if (selectedKey) {
      openSection(buildingOnTile || isBaseTile ? 'inspector' : 'build');
    } else if (current === 'inspector') {
      openSection('menu');
    }
  }, [selectedKey, buildingOnTile, isBaseTile, openSection]);

  /*
   * Escape: сначала снимает режим строительства, потом закрывает панель. Модальные окна
   * (профиль, карты, админка) ловят Escape сами, поэтому пока открыто окно — не мешаем:
   * иначе один Escape закрывал бы и окно, и панель под ним.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('.modal-shell')) return;
      const state = useGameStore.getState();
      if (state.grid.selectedBuildId) {
        state.selectBuild(null);
        return;
      }
      if (useUiStore.getState().section !== null) {
        useUiStore.getState().close();
        state.selectTile(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const badges = useMemo<Partial<Record<PanelSectionId, number>>>(
    () => ({
      events: activeEventsCount,
      achievements: recentAchievements,
      quests: claimableQuests,
      // Новые сообщения чата, пришедшие пока панель закрыта (пункты 12, 13):
      // иначе чат в меню разделов ничем не отличается от пустого.
      chat: chatUnread,
    }),
    [activeEventsCount, recentAchievements, claimableQuests, chatUnread],
  );

  const handleClose = () => {
    close();
    selectTile(null);
    selectBuild(null);
  };

  if (section === null) return null;

  const active = SECTIONS.find((s) => s.id === section);
  const title =
    section === 'menu'
      ? 'Управление'
      : section === 'inspector' && grid.selected
        ? `Инспектор — (${grid.selected.x}, ${grid.selected.y})`
        : (active?.label ?? 'Управление');

  const renderSection = () => {
    if (section === 'menu') {
      return (
        <div className="p-2">
          {GROUPS.map((group) => (
            <div key={group.title} className="mb-3">
              <div className="px-1 pb-1 text-3xs font-semibold uppercase tracking-wider text-content-faint">
                {group.title}
              </div>
              <div className="grid grid-cols-2 gap-1">
                {group.items.map((item) => {
                  const badge = badges[item.id] ?? 0;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openSection(item.id)}
                      className="relative flex items-center gap-2 rounded-md border px-2 py-2 text-left transition-colors hover:bg-white/[0.06]"
                      style={{ borderColor: 'var(--edge)', background: 'var(--surface-3)' }}
                    >
                      <GameIcon icon={item.icon} size={15} className="shrink-0 text-info" />
                      <span className="truncate text-xs text-content-secondary">{item.label}</span>
                      {badge > 0 && (
                        <span className="absolute right-1 top-1 rounded-full px-1 text-3xs font-bold text-ink-950" style={{ background: 'var(--warning)' }}>
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (section === 'power') return <PowerSection />;
    if (section === 'finance') {
      return <FinancePanel creditsBalance={creditsBalance} onTransfer={handleFinanceTransfer} />;
    }
    if (section === 'quests') {
      return <QuestsPanel quests={quests} onClaimReward={claimQuestReward} />;
    }
    if (section === 'chat') {
      // streamOnline приходит из App: чат должен честно сказать, что связи нет,
      // иначе молчащий канал не отличить от отсутствия сообщений.
      return <ChatPanel streamOnline={streamOnline} />;
    }

    const Component = active?.Component;
    return Component ? <Component /> : null;
  };

  return (
    <aside
      className="absolute bottom-0 right-0 top-0 z-30 flex w-full flex-col border-l shadow-elev-4 sm:w-[400px] xl:w-[420px]"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--edge-strong)' }}
    >
      {/* ——— акцентная шапка: где я, как назад, как закрыть ——— */}
      <div
        className="flex h-9 shrink-0 items-center gap-1 px-1"
        style={{
          background: 'linear-gradient(180deg, #8be9fd 0%, #3dc5de 100%)',
          color: 'var(--ink-950)',
        }}
      >
        {section !== 'menu' && (
          <button
            type="button"
            onClick={() => openSection('menu')}
            title="Все разделы"
            className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-black/10"
          >
            <ChevronLeft size={17} />
          </button>
        )}
        <span className="flex-1 truncate px-1 text-center text-sm font-bold">{title}</span>
        <button
          type="button"
          onClick={handleClose}
          title="Закрыть панель (карта на весь экран)"
          className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-black/10"
        >
          <X size={17} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">{renderSection()}</div>
    </aside>
  );
}
