import React, { useState } from 'react';
import { useGameStore } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format';
import type { ResourceType, GalaxyId } from '../../core/gameTypes';
import { RESOURCE_EMOJI } from '../../core/constants/labels';

export const IntergalacticLogisticsPanel: React.FC = () => {
  const {
    intergalacticLogistics,
    galaxies,
    resources,
    currency,
    sendCaravan,
    upgradeCaravanSystem,
  } = useGameStore();

  const [selectedFrom, setSelectedFrom] = useState<string>('main_base');
  const [selectedTo, setSelectedTo] = useState<string>('');
  const [cargoResources, setCargoResources] = useState<Partial<Record<ResourceType, number>>>({});

  const availableDestinations = [
    { id: 'main_base', name: '🏠 Главная база', galaxyId: 'galaxy_1_nebula_beginning' as GalaxyId },
    ...galaxies.platforms.map(p => ({ id: p.id, name: `🛰️ ${p.name}`, galaxyId: p.galaxyId })),
  ].filter(d => d.id !== selectedFrom);

  const handleSendCaravan = () => {
    if (!selectedTo) {
      alert('Выберите пункт назначения');
      return;
    }

    const cargo: Partial<Record<ResourceType, import('break_eternity.js').default>> = {};
    let hasAnyCargo = false;
    
    Object.entries(cargoResources).forEach(([res, amount]) => {
      if (amount && amount > 0) {
        const D = (window as any).Decimal;
        cargo[res as ResourceType] = D(amount);
        hasAnyCargo = true;
      }
    });

    if (!hasAnyCargo) {
      alert('Добавьте ресурсы для отправки');
      return;
    }

    sendCaravan(selectedFrom, selectedTo, cargo);
    setCargoResources({});
    alert('Караван отправлен!');
  };

  const handleUpgrade = (upgradeType: 'speed' | 'capacity' | 'defense') => {
    upgradeCaravanSystem(upgradeType);
  };

  const getUpgradeCost = (upgradeType: 'speed' | 'capacity' | 'defense') => {
    const baseCost = { speed: 1000, capacity: 800, defense: 1200 };
    const currentLevel = intergalacticLogistics.upgrades[upgradeType];
    return baseCost[upgradeType] * Math.pow(1.5, currentLevel);
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-gray-800 text-white rounded-lg max-h-[70vh] overflow-y-auto">
      <h2 className="text-2xl font-bold text-cyan-400">🚛 Межгалактическая Логистика</h2>

      {/* Upgrades Section */}
      <div className="bg-gray-700 p-3 rounded">
        <h3 className="text-lg font-semibold mb-2 text-yellow-400">⚡ Улучшения системы</h3>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gray-600 p-2 rounded">
            <div className="text-sm text-gray-300">🚀 Скорость</div>
            <div className="text-lg font-bold">Уровень {intergalacticLogistics.upgrades.speed}</div>
            <div className="text-xs text-gray-400 mb-1">-20% время доставки</div>
            <button
              onClick={() => handleUpgrade('speed')}
              className={`w-full text-xs py-1 px-2 rounded ${
                currency.credits.gte(getUpgradeCost('speed'))
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-500 cursor-not-allowed'
              }`}
              disabled={currency.credits.lt(getUpgradeCost('speed'))}
            >
              💰 {formatNumber(getUpgradeCost('speed'))}
            </button>
          </div>

          <div className="bg-gray-600 p-2 rounded">
            <div className="text-sm text-gray-300">📦 Вместимость</div>
            <div className="text-lg font-bold">Уровень {intergalacticLogistics.upgrades.capacity}</div>
            <div className="text-xs text-gray-400 mb-1">+20% грузоподъемность</div>
            <button
              onClick={() => handleUpgrade('capacity')}
              className={`w-full text-xs py-1 px-2 rounded ${
                currency.credits.gte(getUpgradeCost('capacity'))
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-500 cursor-not-allowed'
              }`}
              disabled={currency.credits.lt(getUpgradeCost('capacity'))}
            >
              💰 {formatNumber(getUpgradeCost('capacity'))}
            </button>
          </div>

          <div className="bg-gray-600 p-2 rounded">
            <div className="text-sm text-gray-300">🛡️ Защита</div>
            <div className="text-lg font-bold">Уровень {intergalacticLogistics.upgrades.defense}</div>
            <div className="text-xs text-gray-400 mb-1">+50% к защите</div>
            <button
              onClick={() => handleUpgrade('defense')}
              className={`w-full text-xs py-1 px-2 rounded ${
                currency.credits.gte(getUpgradeCost('defense'))
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-500 cursor-not-allowed'
              }`}
              disabled={currency.credits.lt(getUpgradeCost('defense'))}
            >
              💰 {formatNumber(getUpgradeCost('defense'))}
            </button>
          </div>
        </div>
      </div>

      {/* Send Caravan Section */}
      <div className="bg-gray-700 p-3 rounded">
        <h3 className="text-lg font-semibold mb-2 text-green-400">📤 Отправить караван</h3>
        
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-xs text-gray-400">Откуда:</label>
            <select
              value={selectedFrom}
              onChange={(e) => setSelectedFrom(e.target.value)}
              className="w-full bg-gray-600 text-white p-2 rounded text-sm"
            >
              <option value="main_base">🏠 Главная база</option>
              {galaxies.platforms.map(p => (
                <option key={p.id} value={p.id}>🛰️ {p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400">Куда:</label>
            <select
              value={selectedTo}
              onChange={(e) => setSelectedTo(e.target.value)}
              className="w-full bg-gray-600 text-white p-2 rounded text-sm"
            >
              <option value="">-- Выберите --</option>
              {availableDestinations.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-3">
          <label className="text-xs text-gray-400 mb-1 block">Груз (введите количество):</label>
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
            {Object.entries(resources)
              .filter(([_, res]) => res.amount.gt(0))
              .map(([resType, res]) => (
                <div key={resType} className="flex items-center gap-2 bg-gray-600 p-2 rounded text-sm">
                  <span>{RESOURCE_EMOJI[resType as ResourceType] || '📦'}</span>
                  <input
                    type="number"
                    min="0"
                    max={res.amount.toNumber()}
                    value={cargoResources[resType as ResourceType] || 0}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setCargoResources(prev => ({
                        ...prev,
                        [resType]: Math.min(val, res.amount.toNumber()),
                      }));
                    }}
                    className="w-20 bg-gray-700 text-white p-1 rounded text-xs"
                    placeholder="0"
                  />
                  <span className="text-xs text-gray-400">/ {formatNumber(res.amount)}</span>
                </div>
              ))}
          </div>
        </div>

        <button
          onClick={handleSendCaravan}
          className="w-full bg-blue-600 hover:bg-blue-700 py-2 px-4 rounded font-semibold"
        >
          🚀 Отправить караван
        </button>
      </div>

      {/* Active Caravans */}
      <div className="bg-gray-700 p-3 rounded">
        <h3 className="text-lg font-semibold mb-2 text-purple-400">🚛 Активные караваны ({intergalacticLogistics.caravans.length})</h3>
        
        {intergalacticLogistics.caravans.length === 0 ? (
          <p className="text-gray-400 text-sm">Нет активных караванов</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {intergalacticLogistics.caravans.map((caravan) => {
              const statusColors = {
                idle: 'bg-gray-600',
                traveling: 'bg-blue-600',
                under_attack: 'bg-red-600',
                delivered: 'bg-green-600',
                destroyed: 'bg-red-800',
              };

              const statusEmojis = {
                idle: '⏸️',
                traveling: '🚛',
                under_attack: '⚔️',
                delivered: '✅',
                destroyed: '💥',
              };

              return (
                <div key={caravan.id} className="bg-gray-600 p-2 rounded text-sm">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold">
                      {statusEmojis[caravan.status]} {caravan.fromId.slice(0, 8)} → {caravan.toId.slice(0, 8)}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${statusColors[caravan.status]}`}>
                      {caravan.status}
                    </span>
                  </div>
                  
                  <div className="w-full bg-gray-700 rounded-full h-2 mb-1">
                    <div
                      className="bg-cyan-500 h-2 rounded-full transition-all"
                      style={{ width: `${caravan.progress * 100}%` }}
                    />
                  </div>
                  
                  <div className="text-xs text-gray-300">
                    Прогресс: {Math.round(caravan.progress * 100)}%
                    {caravan.status === 'under_attack' && (
                      <span className="text-red-400 ml-2">⚠️ Под атакой!</span>
                    )}
                  </div>
                  
                  <div className="text-xs text-gray-400 mt-1">
                    Груз: {Object.entries(caravan.cargo).map(([res, amt]) => 
                      `${RESOURCE_EMOJI[res as ResourceType]} ${formatNumber(amt)}`
                    ).join(', ')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="text-xs text-gray-400 bg-gray-700 p-2 rounded">
        <p><strong>💡 Как работает:</strong></p>
        <ul className="list-disc list-inside mt-1 space-y-1">
          <li>Караваны перевозят ресурсы между базой и платформами</li>
          <li>Требуется топливо (жидкое топливо или бензин)</li>
          <li>Есть риск атаки пиратами (зависит от опасности галактики)</li>
          <li>Улучшайте систему для более быстрой и безопасной доставки</li>
        </ul>
      </div>
    </div>
  );
};
