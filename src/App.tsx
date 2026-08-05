import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOptimizedGameLoop } from './hooks/useOptimizedGameLoop';
import { useGameStore } from './features/gameStore';
import { useUiStore } from './features/uiStore';
import { TopBar } from './components/game/TopBar';
import { FactoryGrid } from './components/game/FactoryGrid';
import { SidePanel } from './components/game/SidePanel';
import { QuickRail } from './components/game/QuickRail';
import { EventNotificationToast } from './components/game/EventNotificationToast';
import { NotificationToast } from './components/game/NotificationToast';
import { SignalOverlay } from './components/game/SignalOverlay';
import { ProductionChainOverlay } from './components/game/ProductionChainOverlay';
import { Minimap } from './components/game/Minimap';
import { HelpModal } from './components/game/HelpPanel';
import { AuthForm } from './components/auth/AuthForm';
import { SaveManager } from './components/game/SaveManager';
import { GameSlotsManager } from './components/game/GameSlotsManager';
import { ProfilePanel } from './components/game/ProfilePanel';
import { CheatPanel } from './components/game/CheatPanel';
import { MapSelector } from './components/game/MapSelector';
import { OfflineProfitModal, useOfflineTrading } from './components/game/finance/OfflineProfitModal';
import { useAdvisorStore } from './features/advisorStore';
import { useAutosave } from './hooks/useAutosave';
import { useGameHotkeys } from './hooks/useHotkeys';
import { useMarketTransactions } from './hooks/useMarketTransactions';
import { useDevice, useRecommendedSettings } from './hooks/useDevice';
import { cleanupLegacyLocalStorage } from './utils/cleanupLocalStorage';
import { isAuthenticated, getCurrentSession, getCurrentSlotId, loadSettingsFromServer } from './utils/settingsApi';
import type { GameSettings } from './core/gameTypes.settings';
import { AdminPanel, AnnouncementBanner } from './components/admin';
import { Modal, PanelBoundary } from './components/ui';
import type { AdminRole } from './utils/adminApi';

function App() {
  const [user, setUser] = useState<{ id: number; email: string; role?: AdminRole } | null>(null);
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  // Очищаем устаревшие данные из localStorage при первом запуске
  useEffect(() => {
    cleanupLegacyLocalStorage();
  }, []);

  const loadGame = useGameStore(state => state.loadGame);
  const checkAndUpdateDailyLogin = useGameStore(state => state.checkAndUpdateDailyLogin);
  const buildings = useGameStore(state => state.buildings);
  /*
   * Settings are NOT a gameStore slice — `state.settings` does not exist, so this selector
   * always returned undefined and targetFPS silently fell back to the device default,
   * meaning the graphics setting in SettingsPanel had no effect on the game loop at all.
   * They live server-side behind loadSettingsFromServer() (the same source SettingsPanel,
   * ProfilePanel and AuthForm already use).
   */
  const [settings, setSettings] = useState<GameSettings | null>(null);
  
  // Определяем устройство
  const device = useDevice();
  const recommendedSettings = useRecommendedSettings();
  
  // Help modal state
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  // Save manager state
  const [showSaveManager, setShowSaveManager] = useState(false);
  
  // Game slots manager state
  const [showGameSlots, setShowGameSlots] = useState(false);
  
  // Profile modal state
  const [showProfile, setShowProfile] = useState(false);
  
  // Cheat panel state
  const [showCheatPanel, setShowCheatPanel] = useState(false);
  
  // Map selector state
  const [showMapSelector, setShowMapSelector] = useState(false);

  // Admin panel state (вход показывается только персоналу)
  const [showAdmin, setShowAdmin] = useState(false);
  const staffRole: AdminRole | null =
    user?.role === 'admin' || user?.role === 'moderator' ? user.role : null;

  /*
   * Стабильные обработчики закрытия окон.
   *
   * App перерисовывается на каждом тике игры (подписка на buildings), а инлайновая
   * стрелка `onClose={() => setShowX(false)}` — новая ссылка на каждый рендер. Modal
   * держит onClose в ref, так что это уже не ломает фокус, но новая ссылка всё равно
   * заставляет каждое окно перерисовываться вместе с App впустую. useCallback с пустыми
   * зависимостями (сеттеры useState стабильны) даёт одну ссылку на всё время жизни App.
   */
  const closeHelpModal = useCallback(() => setShowHelpModal(false), []);
  const closeSaveManager = useCallback(() => setShowSaveManager(false), []);
  const closeProfile = useCallback(() => setShowProfile(false), []);
  const closeGameSlots = useCallback(() => setShowGameSlots(false), []);
  const closeCheatPanel = useCallback(() => setShowCheatPanel(false), []);
  const closeMapSelector = useCallback(() => setShowMapSelector(false), []);
  const closeAdmin = useCallback(() => setShowAdmin(false), []);
  const openProfile = useCallback(() => setShowProfile(true), []);
  const openMapSelector = useCallback(() => setShowMapSelector(true), []);
  const openAdmin = useCallback(() => setShowAdmin(true), []);
  const openSaveManagerFromProfile = useCallback(() => {
    setShowProfile(false);
    setShowSaveManager(true);
  }, []);
  const openGameSlotsFromProfile = useCallback(() => {
    setShowProfile(false);
    setShowGameSlots(true);
  }, []);

  // Offline profit modal state
  const [showOfflineProfit, setShowOfflineProfit] = useState(true);
  const offlineProfit = useAdvisorStore(state => state.offlineProfit);
  
  // Отслеживаем slotId с реактивным обновлением
  const [currentSlotId, setCurrentSlotId] = useState<number | null>(getCurrentSlotId());
  
  // Обновляем slotId при изменении localStorage
  useEffect(() => {
    const updateSlotId = () => {
      const newSlotId = getCurrentSlotId();
      console.log('[App] SlotId updated:', newSlotId);
      setCurrentSlotId(newSlotId);
    };
    
    // Проверяем slotId сразу и через секунду (после загрузки)
    updateSlotId();
    const timeout = setTimeout(updateSlotId, 1000);
    
    // Слушаем изменения localStorage
    window.addEventListener('storage', updateSlotId);
    
    // Слушаем кастомное событие при смене слота
    window.addEventListener('slotChanged', updateSlotId);
    
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('storage', updateSlotId);
      window.removeEventListener('slotChanged', updateSlotId);
    };
  }, [user]); // Обновляем при смене пользователя
  
  // Offline trading hook - автоматически сохраняет состояние и считает прибыль
  useOfflineTrading(currentSlotId);
  
  // Get map-related state
  const maps = useGameStore(state => state.maps);
  const research = useGameStore(state => state.research);
  const ascension = useGameStore(state => state.ascension);
  const stats = useGameStore(state => state.stats);
  const selectMap = useGameStore(state => state.selectMap);
  const startMap = useGameStore(state => state.startMap);
  
  // Вычисляем общее время игры в часах (сохранённое + текущая сессия)
  const totalPlaytimeSeconds = (stats?.totalPlayTime ?? 0) + 
    (stats?.currentSessionStart ? Math.floor((Date.now() - stats.currentSessionStart) / 1000) : 0);
  const playtimeHours = totalPlaytimeSeconds / 3600;
  
  // Используем целевой FPS из настроек (по умолчанию 60 для desktop, 30 для mobile)
  const targetFPS = settings?.graphics?.targetFPS ?? recommendedSettings.targetFPS;

  // research.technologies is a Record<TechnologyId, boolean>; MapSelector wants a Set of the
  // ids that are actually true.
  const unlockedTechnologies = useMemo(
    () =>
      new Set(
        Object.entries(research?.technologies ?? {})
          .filter(([, isUnlocked]) => isUnlocked)
          .map(([id]) => id),
      ),
    [research?.technologies],
  );
  
  // Initialize optimized game loop with target FPS
  const { getFPS } = useOptimizedGameLoop(targetFPS);
  
  // FPS монитор (только в dev режиме)
  const [showFPS, setShowFPS] = useState(false);
  
  useEffect(() => {
    if (import.meta.env.DEV) {
      // В dev режиме показываем FPS по нажатию F3
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'F3') {
          setShowFPS(prev => !prev);
        }
        // Ctrl+K для открытия чит-панели
        if (e.ctrlKey && e.key === 'k') {
          e.preventDefault();
          setShowCheatPanel(prev => !prev);
        }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, []);
  
  // Хоткей F1 для открытия справки
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setShowHelpModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Autosave every 30 seconds
  useAutosave(30, true);
  
  // Обработка pending транзакций биржи
  useMarketTransactions();

  // Initialize hotkeys (только для desktop)
  if (device.isDesktop) {
    useGameHotkeys();
  }

  // Проверяем авторизацию при загрузке
  useEffect(() => {
    const checkAuth = async () => {
      if (isAuthenticated()) {
        try {
          const session = await getCurrentSession();
          if (session.ok && session.user) {
            // role приходит из /api/auth/session и решает, показывать ли вход в админку.
            setUser({
              id: session.user.id,
              email: session.user.email,
              role: session.user.role as AdminRole | undefined,
            });
          } else {
            // Токен недействителен, он уже был удален в getCurrentSession
            setUser(null);
          }
        } catch (e) {
          console.error('Ошибка проверки авторизации:', e);
          setUser(null);
        }
      }
      setIsAuthChecked(true);
    };
    
    checkAuth();
  }, []);

  // Load save on mount (только после успешной авторизации)
  useEffect(() => {
    if (user) {
      loadGame().then(() => {
        // Проверяем и обновляем daily login после загрузки
        checkAndUpdateDailyLogin();
        /*
         * Выбранная клетка лежит в сохранении, а на телефоне правая панель занимает весь
         * экран: без сброса игрок при входе видел инспектор клетки, на которой закончил
         * прошлую сессию, вместо своей фабрики. Ширину читаем здесь, а не через useDevice,
         * чтобы поворот экрана не перезапускал загрузку сохранения.
         */
        if (window.matchMedia('(max-width: 767px)').matches) {
          useGameStore.getState().selectTile(null);
          useUiStore.getState().close();
        }
      });
    }
  }, [user, loadGame, checkAndUpdateDailyLogin]);
  
  // Настройки графики/геймплея приходят с сервера; без этого targetFPS из SettingsPanel
  // никогда не доходил до игрового цикла.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    loadSettingsFromServer()
      .then((loaded) => {
        if (!cancelled) setSettings(loaded);
      })
      .catch((e) => console.warn('[App] не удалось загрузить настройки:', e));

    // SettingsPanel сохраняет настройки сам; событие позволяет подхватить их без перезагрузки.
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<GameSettings>).detail;
      if (detail) setSettings(detail);
    };
    window.addEventListener('settingsChanged', onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener('settingsChanged', onChanged);
    };
  }, [user]);

  // Применяем рекомендуемые настройки при первом запуске на мобильном
  useEffect(() => {
    if (device.isMobile && !settings) {
      // Здесь можно применить recommendedSettings
      console.log('Mobile device detected, recommended settings:', recommendedSettings);
    }
  }, [device.isMobile, settings, recommendedSettings]);

  // Показываем форму авторизации, если не проверили авторизацию или пользователь не залогинен
  if (!isAuthChecked) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-cyber-black">
        <div className="text-cyan-400">Загрузка...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-cyber-black text-cyber-text">
      {/* FPS Counter (F3 в dev режиме) */}
      {showFPS && (
        <div className="fixed bottom-2 left-1/2 z-50 -translate-x-1/2 rounded bg-black/80 px-2 py-1 font-mono text-xs text-green-400">
          FPS: {getFPS()}
        </div>
      )}

      {/* Одна строка ресурсов вместо четырёх ярусов панелей */}
      <TopBar
        onOpenProfile={openProfile}
        onOpenMaps={openMapSelector}
        onOpenAdmin={staffRole ? openAdmin : undefined}
        compact={device.isMobile}
      />

      {/*
        Карта занимает всё остальное место, а правая панель лежит НАД ней (как в
        Industry Idle). Раньше панель была колонкой во флексе: открытие/закрытие
        меняло ширину канваса, Pixi пересобирал сцену и камера прыгала.
      */}
      <main className="relative min-h-0 flex-1 overflow-hidden">
        <FactoryGrid />
        {!device.isMobile && <Minimap />}
        {!device.isMobile && <QuickRail />}
        <SidePanel />
      </main>

      {/* Event notification toasts */}
      <EventNotificationToast />
      
      {/* General notification toasts */}
      <NotificationToast />
      
      {/* Signal Interception Overlay */}
      <SignalOverlay />
      
      {/* Production Chain Overlay (HelMod-style) */}
      <ProductionChainOverlay buildings={buildings} />
      
      {/* Help Modal - открывается по F1 */}
      <HelpModal isOpen={showHelpModal} onClose={closeHelpModal} />
      
      {/* Save Manager */}
      <SaveManager isOpen={showSaveManager} onClose={closeSaveManager} />
      
      {/* Profile Modal */}
      <Modal
        open={showProfile}
        onClose={closeProfile}
        title="Профиль"
        size="lg"
      >
        <ProfilePanel
          onShowSaveManager={openSaveManagerFromProfile}
          onShowGameSlots={openGameSlotsFromProfile}
          onClose={closeProfile}
        />
      </Modal>
      
      {/* Game Slots Manager */}
      <GameSlotsManager 
        isOpen={showGameSlots} 
        onClose={closeGameSlots}
        onSlotSwitch={() => {
          // При переключении слота можно перезагрузить страницу для чистого состояния
          window.location.reload();
        }}
      />
      
      {/* Cheat Panel - только в dev режиме */}
      {import.meta.env.DEV && showCheatPanel && (
        <CheatPanel onClose={closeCheatPanel} />
      )}
      
      {/* Map Selector Modal */}
      {showMapSelector && (
        <MapSelector
          // ResearchState has `technologies: Record<TechnologyId, boolean>` — there is no
          // `unlocked` array, so this was `new Set(undefined)`: an EMPTY set. Every map gated
          // behind a technology was therefore permanently locked.
          unlockedTechnologies={unlockedTechnologies}
          // AscensionState has `ascensionCount`, not `level` — this was always 0, so maps
          // gated behind an ascension level never unlocked either.
          ascensionLevel={ascension?.ascensionCount ?? 0}
          playtimeHours={playtimeHours}
          currentMapId={maps?.currentMapId ?? undefined}
          onSelectMap={(mapId) => {
            selectMap(mapId as any);
            startMap(mapId as any);
            setShowMapSelector(false);
          }}
          onClose={closeMapSelector}
        />
      )}
      
      {/* Объявления администрации — для всех игроков */}
      <AnnouncementBanner />

      {/* Админ-панель — только для admin и moderator */}
      {staffRole && (
        <PanelBoundary label="Админка">
          <AdminPanel
            open={showAdmin}
            onClose={closeAdmin}
            role={staffRole}
            // currentUserId нужен панели, чтобы отличить собственный аккаунт:
            // «выйти со всех устройств» и смена пароля на себе гасят текущий вход.
            currentUserId={user.id}
            // Сессия умерла (в том числе если админ сам её погасил) — токен уже
            // стёрт из localStorage, показываем форму входа.
            onAuthLost={() => {
              setShowAdmin(false);
              setUser(null);
            }}
          />
        </PanelBoundary>
      )}

      {/* Offline Profit Modal */}
      {showOfflineProfit && offlineProfit?.hasOfflineProfit && (
        <OfflineProfitModal
          onClose={() => setShowOfflineProfit(false)}
          onCollect={() => setShowOfflineProfit(false)}
        />
      )}
    </div>
  );
}

export default App;
