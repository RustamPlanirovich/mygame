import { useGameStore } from '../../features/gameStore';
import { Zap, AlertTriangle, Info, X, Check } from 'lucide-react';

export function RandomEventsPanel() {
  const { activeEvents, eventHistory, eventsEnabled } = useGameStore(s => s.randomEvents);
  const resolveEvent = useGameStore(s => s.resolveEvent);
  const dismissEvent = useGameStore(s => s.dismissEvent);
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

      {/* Активные события */}
      {activeEvents.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-yellow-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Активные события
          </h3>
          {activeEvents.map(event => (
            <div
              key={event.id}
              className="bg-gray-800 border border-yellow-600 rounded-lg p-3 relative"
            >
              {/* Иконка и заголовок */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{event.icon}</span>
                  <div>
                    <h4 className="font-bold text-yellow-200">{event.title}</h4>
                    <p className="text-xs text-gray-400">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => dismissEvent(event.id)}
                  className="text-gray-400 hover:text-white transition-colors"
                  title="Закрыть"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Описание */}
              <p className="text-sm text-gray-300 mb-3">{event.description}</p>

              {/* Эффекты */}
              {event.effects && (
                <div className="mb-3 space-y-1 text-xs">
                  {event.effects.resourceGain && (
                    <div className="text-green-400">
                      + Ресурсы: {Object.entries(event.effects.resourceGain)
                        .map(([type, amount]) => `${amount?.toFixed(0)} ${type}`)
                        .join(', ')}
                    </div>
                  )}
                  {event.effects.resourceLoss && (
                    <div className="text-red-400">
                      - Потеря: {Object.entries(event.effects.resourceLoss)
                        .map(([type, amount]) => `${amount?.toFixed(0)} ${type}`)
                        .join(', ')}
                    </div>
                  )}
                  {event.effects.researchPointsGain && (
                    <div className="text-blue-400">
                      + {event.effects.researchPointsGain.toFixed(0)} RP
                    </div>
                  )}
                  {event.effects.energyLoss && (
                    <div className="text-orange-400">
                      - {event.effects.energyLoss.toFixed(0)} Энергии
                    </div>
                  )}
                  {event.effects.productionMultiplier && (
                    <div className="text-purple-400">
                      ⚡ Производство: x{event.effects.productionMultiplier.multiplier.toFixed(1)} на{' '}
                      {(event.effects.productionMultiplier.duration / 1000).toFixed(0)}с
                    </div>
                  )}
                </div>
              )}

              {/* Кнопка разрешения */}
              {event.status === 'pending' && (
                <button
                  onClick={() => resolveEvent(event.id)}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Принять
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* История событий */}
      {eventHistory.length > 0 && (
        <div className="space-y-2 mt-4">
          <h3 className="text-lg font-semibold text-blue-300 flex items-center gap-2">
            <Info className="w-4 h-4" />
            История событий
          </h3>
          <div className="space-y-1">
            {eventHistory.slice(0, 10).map((event, idx) => (
              <div
                key={`${event.timestamp}-${idx}`}
                className="bg-gray-800 border border-gray-700 rounded p-2 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">{event.title}</span>
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
      {activeEvents.length === 0 && eventHistory.length === 0 && (
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
