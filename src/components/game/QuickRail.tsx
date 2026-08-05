import { useUiStore, type PanelSectionId } from '../../features/uiStore';
import { useGameStore } from '../../features/gameStore';
import { GameIcon } from '../ui/icons';

/*
 * Быстрая панель на левом краю карты. Раньше любой раздел открывался в два-три клика
 * (меню → длинный список → пункт), причём список ещё и скроллился. Восемь самых частых
 * разделов теперь в один клик, и они не конфликтуют с правой панелью — она справа.
 */
const RAIL: Array<{ id: PanelSectionId; icon: string; label: string }> = [
  { id: 'menu', icon: 'grid_view', label: 'Все разделы' },
  { id: 'build', icon: 'crane', label: 'Строительство' },
  { id: 'inspector', icon: 'eye', label: 'Инспектор клетки' },
  { id: 'power', icon: 'bolt', label: 'Энергия и экология' },
  { id: 'market', icon: 'market', label: 'Рынок' },
  { id: 'research', icon: 'research', label: 'Исследования' },
  { id: 'analytics', icon: 'chartBars', label: 'Аналитика' },
  { id: 'quests', icon: 'quest', label: 'Квесты' },
  { id: 'combat', icon: 'swords', label: 'Бой' },
];

export function QuickRail() {
  const section = useUiStore((s) => s.section);
  const toggle = useUiStore((s) => s.toggle);

  const enemies = useGameStore((s) => s.combat.enemies.length);
  const claimableQuests = useGameStore(
    (s) => s.quests.activeQuests.filter((q) => q.isCompleted && q.isActive).length,
  );

  // События и достижения показывают свои счётчики в меню разделов — здесь только то,
  // на что игрок должен реагировать сразу.
  const badgeFor = (id: PanelSectionId) => {
    if (id === 'quests') return claimableQuests;
    if (id === 'combat') return enemies;
    return 0;
  };

  return (
    <div
      className="absolute left-2 top-2 z-20 flex flex-col overflow-hidden rounded-md border"
      style={{ background: 'var(--surface-2)', borderColor: 'var(--edge)' }}
    >
      {RAIL.map((item) => {
        const active = section === item.id;
        const badge = badgeFor(item.id);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => toggle(item.id)}
            title={item.label}
            aria-label={item.label}
            className="relative flex h-9 w-9 items-center justify-center transition-colors hover:bg-white/[0.08]"
            style={{
              background: active ? 'rgb(94 216 242 / 0.16)' : 'transparent',
              color: active ? 'var(--info)' : 'var(--text-muted)',
            }}
          >
            <GameIcon icon={item.icon} size={17} mono />
            {badge > 0 && (
              <span
                className="absolute right-0.5 top-0.5 min-w-3 rounded-full px-0.5 text-3xs font-bold leading-3 text-ink-950"
                style={{ background: 'var(--danger)' }}
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
