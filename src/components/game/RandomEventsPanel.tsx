import { useGameStore } from '../../features/gameStore';
import { Zap, Info, History } from 'lucide-react';

// Иконки для типов событий
const EVENT_ICONS: Record<string, string> = {
  meteor_shower: '☄️',
  scientific_breakthrough: '🔬',
  pirate_raid: '🏴‍☠️',
  cosmic_anomaly: '🌌',
  chain_reaction: '💥',
  synergy_discovery: '✨',
  power_surge: '⚡',
  power_outage: '🔌',
  resource_cache: '📦',
  solar_flare: '🌟',
};

export function RandomEventsPanel() {
  const { eventHistory, eventsEnabled } = useGameStore(s => s.randomEvents);
  const toggleRandomEvents = useGameStore(s => s.toggleRandomEvents);

  return (
    <div className="flex flex-col gap-3 p-4 max-h-[600px] overflow-y-auto">
      {/* Заголовок и toggle */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-700">
        <h2 className="text-xl font-bold text-cyan-300 flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Случайные события
        </h2>
        <button
          onClick={toggleRandomEvents}
          className={`px-3 py-1 rounded text-sm font-bold transition-colors ${
            eventsEnabled
              ? 'bg-green-700 hover:bg-green-600 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
          }`}
        >
          {eventsEnabled ? 'Включено' : 'Выключено'}
        </button>
      </div>

      {/* Информация о системе */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-300">
            <p className="mb-1">
              События происходят автоматически каждые <span className="text-cyan-300">5-15 минут</span>.
            </p>
            <p className="text-xs text-gray-400">
              Эффекты применяются мгновенно. Позитивные события дают бонусы, 
              негативные — отнимают ресурсы. Вы увидите уведомление о каждом событии.
            </p>
          </div>
        </div>
      </div>

      {/* История событий */}
      {eventHistory.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-blue-300 flex items-center gap-2">
            <History className="w-4 h-4" />
            История событий
          </h3>
          <div className="space-y-1">
            {eventHistory.slice(0, 20).map((event, idx) => (
              <div
                key={`${event.timestamp}-${idx}`}
                className="bg-gray-800 border border-gray-700 rounded p-2 text-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{EVENT_ICONS[event.type] || '❓'}</span>
                    <span className="text-gray-300">{event.title}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Пустое состояние */}
      {eventHistory.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Zap className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Случайных событий пока не было</p>
          <p className="text-xs mt-1">
            События происходят каждые 5-15 минут
          </p>
        </div>
      )}
    </div>
  );
}
