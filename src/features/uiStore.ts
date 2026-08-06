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
  | 'plans'
  | 'chat'
  | 'expedition'
  | 'power'
  | 'settings'
  | 'menu';

/**
 * Вкладки раздела «Рынок». Живут здесь, а не в useState внутри MarketPanel, по той же
 * причине, что и сам раздел: открыть биржу должен уметь кто угодно — в частности плашка
 * «кто-то покупает ваш материал» (см. features/marketNavigation.ts).
 */
export type MarketTabId = 'spot' | 'contracts' | 'trading' | 'global';

interface UiState {
  /** `null` — панель закрыта, карта занимает весь экран. */
  section: PanelSectionId | null;
  open: (section: PanelSectionId) => void;
  close: () => void;
  /** Повторный клик по тому же разделу закрывает панель. */
  toggle: (section: PanelSectionId) => void;

  /** Какая вкладка открыта внутри раздела «Рынок». */
  marketTab: MarketTabId;
  setMarketTab: (tab: MarketTabId) => void;

  /*
   * МАССОВОЕ ВЫДЕЛЕНИЕ КЛЕТОК (bigplan.md, пункты 10 и 28).
   *
   * Живёт в UI-сторе, а не в gameStore: выделение не влияет на симуляцию и не должно попадать
   * в сейв — при загрузке игрок начинает с пустым выделением. Плюс gameStore пересобирается
   * тиком 20 раз в секунду, и держать там UI-состояние значит платить за это без причины.
   *
   * Ключи в формате "x,y" — тот же формат, что у grid.tiles.
   */
  selectedTiles: string[];
  /** Идёт ли протяжка рамки; сама рамка рисуется в FactoryGrid. */
  isBoxSelecting: boolean;
  /** Полностью заменить выделение (результат протяжки рамки). */
  setSelectedTiles: (keys: string[]) => void;
  /** Добавить/убрать одну клетку (Shift+клик). */
  toggleSelectedTile: (key: string) => void;
  /** Дополнить выделение (Shift+рамка). */
  addSelectedTiles: (keys: string[]) => void;
  clearSelectedTiles: () => void;
  setBoxSelecting: (active: boolean) => void;
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

  marketTab: 'spot',
  setMarketTab: (marketTab) => set((state) => (state.marketTab === marketTab ? state : { marketTab })),

  selectedTiles: [],
  isBoxSelecting: false,

  setSelectedTiles: (keys) =>
    set((state) => {
      // Пустое выделение поверх пустого — не повод создавать новый массив и будить подписчиков.
      if (keys.length === 0 && state.selectedTiles.length === 0) return state;
      return { selectedTiles: dedupe(keys) };
    }),

  toggleSelectedTile: (key) =>
    set((state) => ({
      selectedTiles: state.selectedTiles.includes(key)
        ? state.selectedTiles.filter((k) => k !== key)
        : [...state.selectedTiles, key],
    })),

  addSelectedTiles: (keys) =>
    set((state) => {
      if (keys.length === 0) return state;
      return { selectedTiles: dedupe([...state.selectedTiles, ...keys]) };
    }),

  clearSelectedTiles: () =>
    set((state) => (state.selectedTiles.length === 0 ? state : { selectedTiles: [] })),

  setBoxSelecting: (active) =>
    set((state) => (state.isBoxSelecting === active ? state : { isBoxSelecting: active })),
}));

function dedupe(keys: string[]): string[] {
  return keys.length > 1 ? Array.from(new Set(keys)) : keys;
}
