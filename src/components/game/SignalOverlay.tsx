/**
 * SignalOverlay Component
 * 
 * Отображает активные сигналы на карте (Golden Cookie style)
 * и активные бусты в углу экрана
 */

import { useEffect, useState } from 'react';
import { useGameStore } from '../../features/gameStore';
import { 
  getSignalIcon, 
  getSignalColor,
  getBoostTypeName,
  formatBoostTimeRemaining,
  getSignalRewardDescription 
} from '../../utils/signalHelpers';
import { Sparkles } from 'lucide-react';
import { GameIcon } from '../ui/icons';

export const SignalOverlay = () => {
  const signalInterception = useGameStore(state => state.signalInterception);
  const claimSignal = useGameStore(state => state.claimSignal);
  const { activeSignal, activeBoosts } = signalInterception;

  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Обновляем таймер каждую секунду
  useEffect(() => {
    if (!activeSignal || activeSignal.claimed) {
      setTimeRemaining(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, activeSignal.expiresAt - now);
      setTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100); // Обновляем каждые 100мс для плавности

    return () => clearInterval(interval);
  }, [activeSignal]);

  const handleSignalClick = () => {
    if (activeSignal && !activeSignal.claimed) {
      claimSignal(activeSignal.id);
    }
  };

  if (!activeSignal || activeSignal.claimed) {
    // Показываем только активные бусты
    return activeBoosts.length > 0 ? (
      <div className="fixed top-20 right-4 z-30 space-y-2">
        {activeBoosts.map((boost) => (
          <BoostIndicator key={boost.id} boost={boost} />
        ))}
      </div>
    ) : null;
  }

  const progress = (timeRemaining / activeSignal.duration) * 100;
  const icon = getSignalIcon(activeSignal.type);
  const color = getSignalColor(activeSignal.type);
  const seconds = Math.ceil(timeRemaining / 1000);

  return (
    <>
      {/* Активный сигнал на карте */}
      <div
        className="fixed z-50 cursor-pointer transform -translate-x-1/2 -translate-y-1/2 animate-pulse"
        style={{
          left: `${activeSignal.position.x * 100}%`,
          top: `${activeSignal.position.y * 100}%`,
        }}
        onClick={handleSignalClick}
      >
        {/* Пульсирующий круг */}
        <div 
          className="absolute inset-0 rounded-full animate-ping opacity-75"
          style={{ 
            backgroundColor: color,
            width: '80px',
            height: '80px',
            left: '-40px',
            top: '-40px'
          }}
        />
        
        {/* Основной сигнал */}
        <div
          className="relative w-20 h-20 rounded-full flex flex-col items-center justify-center shadow-2xl border-4 transition-transform hover:scale-110"
          style={{ 
            backgroundColor: color,
            borderColor: 'rgba(255,255,255,0.5)',
          }}
        >
          {/* Иконка */}
          <div className="text-4xl mb-1">{icon}</div>
          
          {/* Таймер */}
          <div className="text-xs font-bold text-white bg-black/40 px-2 py-0.5 rounded-full">
            {seconds}с
          </div>
        </div>

        {/* Прогресс-бар внизу */}
        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-white transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Подсказка */}
        <div 
          className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-black/90 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap shadow-xl border border-gray-600 pointer-events-none"
        >
          <div className="font-bold mb-1">{getBoostTypeName(activeSignal.type)}</div>
          <div className="text-xs text-gray-300">
            {getSignalRewardDescription(activeSignal.reward)}
          </div>
        </div>
      </div>

      {/* Активные бусты в углу */}
      {activeBoosts.length > 0 && (
        <div className="fixed top-20 right-4 z-30 space-y-2">
          {activeBoosts.map((boost) => (
            <BoostIndicator key={boost.id} boost={boost} />
          ))}
        </div>
      )}
    </>
  );
};

// Индикатор активного буста
const BoostIndicator = ({ boost }: { boost: import('../../core/gameTypes').ActiveBoost }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const updateTimer = () => {
      setTimeLeft(formatBoostTimeRemaining(boost));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [boost]);

  const progress = ((boost.expiresAt - Date.now()) / (boost.expiresAt - boost.startedAt)) * 100;

  return (
    <div className="bg-cyber-bg-dark border-2 border-cyber-green rounded-lg p-3 shadow-xl min-w-[200px] backdrop-blur-sm animate-slide-in-right">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-cyber-green" />
          <span className="text-sm font-bold text-cyber-text">{boost.type}</span>
        </div>
        <span className="text-xs text-cyber-green font-mono">{timeLeft}</span>
      </div>
      
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl font-bold text-cyber-green">x{boost.multiplier}</span>
        <span className="text-xs text-cyber-text-dim">производство</span>
      </div>

      {/* Прогресс-бар */}
      <div className="w-full h-1.5 bg-cyber-bg-darker rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-cyber-green to-cyber-accent transition-all duration-1000 ease-linear"
          style={{ width: `${Math.max(0, progress)}%` }}
        />
      </div>
    </div>
  );
};

// Индикатор статистики сигналов (опционально, для настроек)
export const SignalStats = () => {
  const signalInterception = useGameStore(state => state.signalInterception);
  const toggleSignals = useGameStore(state => state.toggleSignals);
  const { totalSignalsCaught, totalSignalsMissed, signalsEnabled } = signalInterception;

  const totalSignals = totalSignalsCaught + totalSignalsMissed;
  const catchRate = totalSignals > 0 
    ? Math.round((totalSignalsCaught / totalSignals) * 100) 
    : 0;

  return (
    <div className="p-4 bg-cyber-bg-dark rounded-lg border border-cyber-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-cyber-text flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-cyber-accent" />
          Статистика Сигналов
        </h3>
        <button
          onClick={() => toggleSignals(!signalsEnabled)}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            signalsEnabled
              ? 'bg-cyber-green/20 text-cyber-green hover:bg-cyber-green/30'
              : 'bg-gray-600/20 text-gray-400 hover:bg-gray-600/30'
          }`}
        >
          {signalsEnabled ? 'Включено' : 'Выключено'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-cyber-bg-darker p-3 rounded">
          <div className="text-2xl font-bold text-cyber-green">{totalSignalsCaught}</div>
          <div className="text-xs text-cyber-text-dim">Перехвачено</div>
        </div>

        <div className="bg-cyber-bg-darker p-3 rounded">
          <div className="text-2xl font-bold text-red-400">{totalSignalsMissed}</div>
          <div className="text-xs text-cyber-text-dim">Пропущено</div>
        </div>

        <div className="col-span-2 bg-cyber-bg-darker p-3 rounded">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-cyber-text-dim">Процент перехвата</span>
            <span className="text-lg font-bold text-cyber-accent">{catchRate}%</span>
          </div>
          <div className="w-full h-2 bg-cyber-bg rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyber-green to-cyber-accent transition-all"
              style={{ width: `${catchRate}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 p-3 bg-cyber-accent/10 rounded border border-cyber-accent/30">
        <p className="text-xs text-cyber-text-dim leading-relaxed">
          <GameIcon icon="💡" /> <span className="text-cyber-text font-medium">Подсказка:</span> Сигналы появляются каждые 2-5 минут. 
          У вас есть 15 секунд, чтобы кликнуть на сигнал и получить награду!
        </p>
      </div>
    </div>
  );
};
