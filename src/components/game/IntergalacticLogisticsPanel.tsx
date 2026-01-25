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
    <div className="flex flex-col gap-2 p-2.5 bg-gray-800 text-white rounded-lg max-h-[85vh] overflow-y-auto">
      <h2 className="text-lg font-bold text-cyan-400">🚛 Межгалакт. Логистика</h2>

      {/* Upgrades Section */}
      <div className="bg-gray-700 p-2 rounded">
        <h3 className="text-sm font-semibold mb-1.5 text-yellow-400">⚡ Улучшения</h3>
        <div className="space-y-1">
          <div className="bg-gray-600 p-1.5 rounded flex items-center gap-2">
            <span className="text-lg flex-shrink-0">🚀</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 justify-between">
                <span className="text-[11px] text-gray-300 truncate">Скорость</span>
                <span className="text-xs font-bold text-white flex-shrink-0">Уровень {intergalacticLogistics.upgrades.speed}</span>
              </div>
              <div className="text-[10px] text-gray-400">-20% время доставки</div>
            </div>
            <button
              onClick={() => handleUpgrade('speed')}
              className={`text-[10px] py-1 px-2 rounded flex-shrink-0 ${
                currency.credits.gte(getUpgradeCost('speed'))
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-500 cursor-not-allowed'
              }`}
              disabled={currency.credits.lt(getUpgradeCost('speed'))}
            >
              💰 {formatNumber(getUpgradeCost('speed'))}
            </button>
          </div>

          <div className="bg-gray-600 p-1.5 rounded flex items-center gap-2">
            <span className="text-lg flex-shrink-0">📦</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 justify-between">
                <span className="text-[11px] text-gray-300 truncate">Вместимость</span>
                <span className="text-xs font-bold text-white flex-shrink-0">Уровень {intergalacticLogistics.upgrades.capacity}</span>
              </div>
              <div className="text-[10px] text-gray-400">+20% грузоподъемность</div>
            </div>
            <button
              onClick={() => handleUpgrade('capacity')}
              className={`text-[10px] py-1 px-2 rounded flex-shrink-0 ${
                currency.credits.gte(getUpgradeCost('capacity'))
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-500 cursor-not-allowed'
              }`}
              disabled={currency.credits.lt(getUpgradeCost('capacity'))}
            >
              💰 {formatNumber(getUpgradeCost('capacity'))}
            </button>
          </div>

          <div className="bg-gray-600 p-1.5 rounded flex items-center gap-2">
            <span className="text-lg flex-shrink-0">🛡️</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 justify-between">
                <span className="text-[11px] text-gray-300 truncate">Защита</span>
                <span className="text-xs font-bold text-white flex-shrink-0">Уровень {intergalacticLogistics.upgrades.defense}</span>
              </div>
              <div className="text-[10px] text-gray-400">+50% к защите</div>
            </div>
            <button
              onClick={() => handleUpgrade('defense')}
              className={`text-[10px] py-1 px-2 rounded flex-shrink-0 ${
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
      <div className="bg-gray-700 p-1.5 rounded">
        <h3 className="text-sm font-semibold mb-1 text-green-400">📤 Отправить караван</h3>
        
        <div className="grid grid-cols-2 gap-1 mb-1">
          <div>
            <label className="text-[10px] text-gray-400">Откуда:</label>
            <select
              value={selectedFrom}
              onChange={(e) => setSelectedFrom(e.target.value)}
              className="w-full bg-gray-600 text-white p-1 rounded text-[11px]"
            >
              <option value="main_base">🏠 Главная база</option>
              {galaxies.platforms.map(p => (
                <option key={p.id} value={p.id}>🛰️ {p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-gray-400">Куда:</label>
            <select
              value={selectedTo}
              onChange={(e) => setSelectedTo(e.target.value)}
              className="w-full bg-gray-600 text-white p-1 rounded text-[11px]"
            >
              <option value="">-- Выберите --</option>
              {availableDestinations.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-1">
          <label className="text-[10px] text-gray-400 mb-0.5 block">Груз (введите количество):</label>
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(resources)
              .filter(([_, res]) => res.amount.gt(0))
              .map(([resType, res]) => (
                <div key={resType} className="flex items-center gap-1 bg-gray-600 p-1 rounded">
                  <span className="text-xs flex-shrink-0">{RESOURCE_EMOJI[resType as ResourceType] || '📦'}</span>
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
                    className="w-12 bg-gray-700 text-white p-0.5 rounded text-[10px]"
                    placeholder="0"
                  />
                  <span className="text-[9px] text-gray-400 truncate flex-1">/{formatNumber(res.amount)}</span>
                </div>
              ))}
          </div>
        </div>

        <button
          onClick={handleSendCaravan}
          className="w-full bg-blue-600 hover:bg-blue-700 py-1.5 px-3 rounded font-semibold text-[11px]"
        >
          🚀 Отправить караван
        </button>
      </div>

      {/* Active Caravans */}
      <div className="bg-gray-700 p-2 rounded">
        <h3 className="text-sm font-semibold mb-1.5 text-purple-400">🚛 Активные караваны ({intergalacticLogistics.caravans.length})</h3>
        
        {intergalacticLogistics.caravans.length === 0 ? (
          <p className="text-gray-400 text-[11px]">Нет активных караванов</p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
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
                <div key={caravan.id} className="bg-gray-600 p-1.5 rounded">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-[11px] truncate">
                      {statusEmojis[caravan.status]} {caravan.fromId.slice(0, 8)} → {caravan.toId.slice(0, 8)}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] flex-shrink-0 ${statusColors[caravan.status]}`}>
                      {caravan.status}
                    </span>
                  </div>
                  
                  <div className="w-full bg-gray-700 rounded-full h-1.5 mb-1">
                    <div
                      className="bg-cyan-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${caravan.progress * 100}%` }}
                    />
                  </div>
                  
                  <div className="text-[10px] text-gray-300">
                    Прогресс: {Math.round(caravan.progress * 100)}%
                    {caravan.status === 'under_attack' && (
                      <span className="text-red-400 ml-1">⚠️ Под атакой!</span>
                    )}
                  </div>
                  
                  <div className="text-[10px] text-gray-400 mt-0.5 truncate">
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

      <div className="text-[10px] text-gray-400 bg-gray-700 p-1.5 rounded">
        <p className="font-semibold mb-0.5">💡 Как работает:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Караваны перевозят ресурсы между базой и платформами</li>
          <li>Требуется топливо (жидкое топливо или бензин)</li>
          <li>Есть риск атаки пиратами (зависит от опасности галактики)</li>
          <li>Улучшайте систему для более быстрой и безопасной доставки</li>
        </ul>
      </div>
    </div>
  );
};
