import { create } from 'zustand';

/**
 * Состояние оболочки интерфейса (какой раздел открыт в правой панели).
 *
 * Раньше это был локальный useState внутри SidePanelTabs, поэтому открыть раздел
 * можно было только из самой панели: ни верхняя строка, ни быстрая панель слева,
 * ни карта не могли ничего показать. Держим состояние в отдельном сторе, чтобы
 * панель осталась единственным местом рендера, но открывать её мог любой элемент.
 */
export type PanelSectionId =
  | 'build'
  | 'inspector'
  | 'quests'
  | 'combat'
  | 'market'
  | 'finance'
  | 'analytics'
  | 'research'
  | 'culture'
  | 'politics'
  | 'galaxies'
  | 'platforms'
  | 'fleet'
  | 'logistics'
  | 'events'
  | 'achievements'
  | 'megastructures'
  | 'help'
  | 'demons'
  | 'prestige'
  | 'artifacts'
  | 'rewards'
  | 'chains'
  | 'expedition'
  | 'power'
  | 'settings'
  | 'menu';

interface UiState {
  /** `null` — панель закрыта, карта занимает весь экран. */
  section: PanelSectionId | null;
  open: (section: PanelSectionId) => void;
  close: () => void;
  /** Повторный клик по тому же разделу закрывает панель. */
  toggle: (section: PanelSectionId) => void;
}

/*
 * На телефоне панель разворачивается на весь экран, поэтому стартуем с закрытой:
 * первым делом игрок должен увидеть карту. На десктопе панель занимает 400px справа
 * и меню разделов при входе полезно.
 */
const initialSection: PanelSectionId | null =
  typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? null : 'menu';

export const useUiStore = create<UiState>((set) => ({
  section: initialSection,
  open: (section) => set({ section }),
  close: () => set({ section: null }),
  toggle: (section) =>
    set((state) => ({ section: state.section === section ? null : section })),
}));
