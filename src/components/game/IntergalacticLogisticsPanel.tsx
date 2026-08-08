import React, { useMemo, useState } from 'react';
import type Decimal from 'break_eternity.js';
import { useGameStore } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format';
import type { ResourceType, GalaxyId, ResourceState } from '../../core/gameTypes';
import { RESOURCE_EMOJI } from '../../core/constants/labels';
import { resourceLabel } from '../../core/i18n/label';
import { aggregatePolicyEffects } from '../../core/production/policyEffects';
import { planCargo } from '../../core/logistics/cargoInput';
import { totalTransportFuel } from '../../core/systems/transportFuel';
import { D } from '../../utils/bigNumber';
import { notify } from '../../utils/notifications';
import { GameIcon, IconText } from '../ui/icons';

export const IntergalacticLogisticsPanel: React.FC = () => {
  const {
    intergalacticLogistics,
    galaxies,
    resources,
    currency,
    politics,
    sendCaravan,
    upgradeCaravanSystem,
  } = useGameStore();

  const [selectedFrom, setSelectedFrom] = useState<string>('main_base');
  const [selectedTo, setSelectedTo] = useState<string>('');
  const [cargoInput, setCargoInput] = useState<Record<string, string>>({});
  const [resourceQuery, setResourceQuery] = useState('');
  const [showEmpty, setShowEmpty] = useState(false);

  const availableDestinations = [
    { id: 'main_base', name: '🏠 Главная база', galaxyId: 'galaxy_1_nebula_beginning' as GalaxyId },
    ...galaxies.platforms.map(p => ({ id: p.id, name: `🛰️ ${p.name}`, galaxyId: p.galaxyId })),
  ].filter(d => d.id !== selectedFrom);

  const sourcePlatform = selectedFrom === 'main_base'
    ? null
    : galaxies.platforms.find(p => p.id === selectedFrom) ?? null;

  /*
   * Список груза берётся со склада ИСТОЧНИКА, а не главной базы. Раньше панель всегда
   * показывала запасы базы: при отправке с платформы ресурсы, которых на базе нет,
   * в список не попадали — отправить их было невозможно, а у остальных бралось чужое
   * ограничение по количеству.
   */
  const sourceResources: Partial<Record<ResourceType, ResourceState>> =
    sourcePlatform ? sourcePlatform.resources : resources;

  const sourceName = sourcePlatform ? sourcePlatform.name : 'Главная база';

  const fromGalaxyId: GalaxyId = sourcePlatform?.galaxyId ?? 'galaxy_1_nebula_beginning';
  const toGalaxyId: GalaxyId = selectedTo === 'main_base' || !selectedTo
    ? 'galaxy_1_nebula_beginning'
    : galaxies.platforms.find(p => p.id === selectedTo)?.galaxyId ?? 'galaxy_1_nebula_beginning';

  /** Что реально уедет: положительные количества, обрезанные по складу источника. */
  const cargoEntries = useMemo(
    () => planCargo(cargoInput, sourceResources),
    [cargoInput, sourceResources]
  );

  const totalCargo = useMemo(
    () => cargoEntries.reduce((sum, [, amount]) => sum.plus(amount), D(0)),
    [cargoEntries]
  );

  // Та же формула, что в sendCaravan (включая скидку политики trade_routes), иначе панель
  // блокировала бы отправку из-за топлива, которое стор на самом деле не спросит.
  const isIntergalactic = fromGalaxyId !== toGalaxyId;
  const fuelCost = useMemo(() => {
    const discount = isIntergalactic
      ? aggregatePolicyEffects(politics.activePolicies).specials.interTradeCost
      : 1;
    return totalCargo.mul(0.01).mul(isIntergalactic ? 3 : 1).mul(D(discount));
  }, [totalCargo, isIntergalactic, politics.activePolicies]);

  /*
   * Топливо перевозок — одно на караваны и авто-транспорт (bigplan.md, пункт 45): топливный
   * резерв (покупается за кредиты) плюс жидкое топливо и бензин со склада ГЛАВНОЙ БАЗЫ —
   * даже для рейсов между платформами. Раньше караван принимал только физическое топливо,
   * и на карте без нефти отправить его было нечем и купить не у кого.
   */
  const fuelSources = {
    reserve: galaxies.fuelReserve,
    liquidFuel: resources.liquid_fuel?.amount ?? D(0),
    gasoline: resources.gasoline?.amount ?? D(0),
  };
  const availableFuel = totalTransportFuel(fuelSources);

  const allSourceTypes = useMemo(
    () => Object.keys(sourceResources) as ResourceType[],
    [sourceResources]
  );
  const inStockCount = useMemo(
    () => allSourceTypes.filter(t => (sourceResources[t]?.amount ?? D(0)).gt(0)).length,
    [allSourceTypes, sourceResources]
  );

  const cargoRows = useMemo(() => {
    const query = resourceQuery.trim().toLowerCase();
    return allSourceTypes
      .map(resType => ({ resType, available: sourceResources[resType]?.amount ?? D(0) }))
      .filter(row => showEmpty || row.available.gt(0))
      .filter(row =>
        !query ||
        resourceLabel(row.resType).toLowerCase().includes(query) ||
        row.resType.includes(query)
      )
      .sort((a, b) => {
        // Сначала то, что есть на складе: пустые строки нужны только для справки.
        const aEmpty = a.available.gt(0) ? 0 : 1;
        const bEmpty = b.available.gt(0) ? 0 : 1;
        if (aEmpty !== bEmpty) return aEmpty - bEmpty;
        return resourceLabel(a.resType).localeCompare(resourceLabel(b.resType), 'ru');
      });
  }, [allSourceTypes, sourceResources, resourceQuery, showEmpty]);

  const handleSourceChange = (nextFrom: string) => {
    setSelectedFrom(nextFrom);
    // Количества относились к другому складу — переносить их на новый источник нельзя.
    setCargoInput({});
    if (nextFrom === selectedTo) setSelectedTo('');
  };

  const handleSendCaravan = () => {
    if (!selectedTo) {
      notify.warning('Выберите пункт назначения');
      return;
    }
    if (selectedFrom !== 'main_base' && !sourcePlatform) {
      notify.error('Платформа-источник не найдена');
      return;
    }
    if (cargoEntries.length === 0) {
      notify.warning('Добавьте ресурсы для отправки');
      return;
    }
    if (availableFuel.lt(fuelCost)) {
      notify.error(`Недостаточно топлива! Нужно: ${formatNumber(fuelCost)}, есть: ${formatNumber(availableFuel)}`);
      return;
    }

    // Количества уже обрезаны по складу источника в cargoEntries, поэтому проверка
    // «хватает ли ресурсов» здесь не нужна — отправить больше, чем есть, нельзя в принципе.
    const cargo: Partial<Record<ResourceType, Decimal>> = {};
    for (const [resType, amount] of cargoEntries) cargo[resType] = amount;

    const caravanCountBefore = intergalacticLogistics.caravans.length;
    sendCaravan(selectedFrom, selectedTo, cargo);

    // sendCaravan синхронный (zustand), поэтому результат видно сразу: караван либо добавился,
    // либо стор отказал по своей проверке.
    const currentState = useGameStore.getState();
    if (currentState.intergalacticLogistics.caravans.length > caravanCountBefore) {
      setCargoInput({});
      notify.success('Караван отправлен!');
    } else {
      notify.error('Не удалось отправить караван');
    }
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
      <h2 className="text-lg font-bold text-cyan-400"><GameIcon icon="🚛" /> Межгалакт. Логистика</h2>

      {/* Upgrades Section */}
      <div className="bg-gray-700 p-2 rounded">
        <h3 className="text-sm font-semibold mb-1.5 text-yellow-400"><GameIcon icon="⚡" /> Улучшения</h3>
        <div className="space-y-1">
          <div className="bg-gray-600 p-1.5 rounded flex items-center gap-2">
            <span className="text-lg flex-shrink-0"><GameIcon icon="🚀" /></span>
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
              <GameIcon icon="💰" /> {formatNumber(getUpgradeCost('speed'))}
            </button>
          </div>

          <div className="bg-gray-600 p-1.5 rounded flex items-center gap-2">
            <span className="text-lg flex-shrink-0"><GameIcon icon="📦" /></span>
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
              <GameIcon icon="💰" /> {formatNumber(getUpgradeCost('capacity'))}
            </button>
          </div>

          <div className="bg-gray-600 p-1.5 rounded flex items-center gap-2">
            <span className="text-lg flex-shrink-0"><GameIcon icon="🛡️" /></span>
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
              <GameIcon icon="💰" /> {formatNumber(getUpgradeCost('defense'))}
            </button>
          </div>
        </div>
      </div>

      {/* Send Caravan Section */}
      <div className="bg-gray-700 p-1.5 rounded">
        <h3 className="text-sm font-semibold mb-1 text-green-400"><GameIcon icon="📤" /> Отправить караван</h3>
        
        <div className="grid grid-cols-2 gap-1 mb-1">
          <div>
            <label className="text-[10px] text-gray-400">Откуда:</label>
            <select
              value={selectedFrom}
              onChange={(e) => handleSourceChange(e.target.value)}
              className="w-full bg-gray-600 text-white p-1 rounded text-[11px]"
            >
              <option value="main_base"><GameIcon icon="🏠" /> Главная база</option>
              {galaxies.platforms.map(p => (
                <option key={p.id} value={p.id}><GameIcon icon="🛰️" /> {p.name}</option>
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
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <label className="text-[10px] text-gray-400">
              Груз со склада «{sourceName}» ({inStockCount} из {allSourceTypes.length} с запасом):
            </label>
            {cargoEntries.length > 0 && (
              <button
                onClick={() => setCargoInput({})}
                className="text-[9px] text-gray-300 hover:text-white underline flex-shrink-0"
              >
                Очистить
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 mb-1">
            <input
              type="text"
              value={resourceQuery}
              onChange={(e) => setResourceQuery(e.target.value)}
              placeholder="Поиск ресурса"
              className="flex-1 min-w-0 bg-gray-600 text-white p-1 rounded text-[10px]"
            />
            <label className="flex items-center gap-1 text-[9px] text-gray-400 flex-shrink-0 cursor-pointer">
              <input
                type="checkbox"
                checked={showEmpty}
                onChange={(e) => setShowEmpty(e.target.checked)}
              />
              Показать пустые
            </label>
          </div>

          {cargoRows.length === 0 ? (
            <p className="text-[10px] text-gray-400">
              {resourceQuery.trim()
                ? 'По запросу ничего не найдено'
                : 'На складе источника нет ресурсов — включите «показать пустые», чтобы увидеть список'}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-1 max-h-56 overflow-y-auto pr-0.5">
              {cargoRows.map(({ resType, available }) => {
                const empty = available.lte(0);
                return (
                  <div
                    key={resType}
                    className={`flex items-center gap-1 bg-gray-600 p-1 rounded ${empty ? 'opacity-50' : ''}`}
                  >
                    <span className="text-xs flex-shrink-0 w-5 text-center">
                      <IconText>{RESOURCE_EMOJI[resType] || '📦'}</IconText>
                    </span>
                    <span className="text-[10px] text-gray-200 truncate flex-1" title={resourceLabel(resType)}>
                      {resourceLabel(resType)}
                    </span>
                    <span className="text-[9px] text-gray-400 flex-shrink-0">{formatNumber(available)}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={cargoInput[resType] ?? ''}
                      disabled={empty}
                      onChange={(e) =>
                        setCargoInput(prev => ({ ...prev, [resType]: e.target.value }))
                      }
                      className="w-16 flex-shrink-0 bg-gray-700 text-white p-0.5 rounded text-[10px] disabled:opacity-40"
                      placeholder="0"
                    />
                    <button
                      onClick={() => setCargoInput(prev => ({ ...prev, [resType]: available.toString() }))}
                      disabled={empty}
                      className="text-[9px] py-0.5 px-1 rounded flex-shrink-0 bg-gray-500 hover:bg-gray-400 disabled:opacity-40 disabled:hover:bg-gray-500"
                    >
                      Всё
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-[10px] text-gray-300 mb-1">
          В грузе: {cargoEntries.length} видов, {formatNumber(totalCargo)} ед. · топливо:{' '}
          <span className={availableFuel.lt(fuelCost) ? 'text-red-400' : 'text-green-400'}>
            {formatNumber(fuelCost)}
          </span>{' '}
          из {formatNumber(availableFuel)}
        </div>
        <div className="text-[9px] text-gray-400 mb-1">
          Резерв {formatNumber(fuelSources.reserve)} · {resourceLabel('liquid_fuel')}{' '}
          {formatNumber(fuelSources.liquidFuel)} · {resourceLabel('gasoline')}{' '}
          {formatNumber(fuelSources.gasoline)} — списывается в этом порядке
        </div>

        {/*
          Кнопка покупки прямо здесь. Игрок упирается в «нет топлива» именно на этом экране,
          а резерв продаётся в другой панели — раньше он оставался в тупике, не зная, что
          топливо вообще можно купить.
        */}
        {availableFuel.lt(fuelCost) && (
          <div className="text-[10px] bg-amber-900/25 border border-amber-700/40 rounded p-1.5 mb-1 text-amber-200">
            Не хватает топлива: {formatNumber(fuelCost.sub(availableFuel))}. Купите резерв за
            кредиты — он работает на любой карте, даже там, где нет нефти.
            <button
              onClick={() => {
                const need = Math.ceil(Number(fuelCost.sub(availableFuel).toString()));
                const amount = Math.max(10, need);
                if (currency.credits.lt(amount * 10)) {
                  notify.warning(`Недостаточно кредитов: нужно ${formatNumber(amount * 10)}`);
                  return;
                }
                useGameStore.getState().buyFuel(amount);
                notify.success(`Куплено ${formatNumber(amount)} ед. топлива`);
              }}
              className="ml-1 px-1.5 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white"
            >
              Купить
            </button>
          </div>
        )}

        <button
          onClick={handleSendCaravan}
          className="w-full bg-blue-600 hover:bg-blue-700 py-1.5 px-3 rounded font-semibold text-[11px]"
        >
          <GameIcon icon="🚀" /> Отправить караван
        </button>
      </div>

      {/* Active Caravans */}
      <div className="bg-gray-700 p-2 rounded">
        <h3 className="text-sm font-semibold mb-1.5 text-purple-400"><GameIcon icon="🚛" /> Активные караваны ({intergalacticLogistics.caravans.length})</h3>
        
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
                      {statusEmojis[caravan.status]} {caravan.fromId.slice(0, 8)} <GameIcon icon="→" /> {caravan.toId.slice(0, 8)}
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
                      <span className="text-red-400 ml-1"><GameIcon icon="⚠️" /> Под атакой!</span>
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
        <p className="font-semibold mb-0.5"><GameIcon icon="💡" /> Как работает:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Караваны перевозят ресурсы между базой и платформами</li>
          <li>Список груза — это склад выбранного источника: с платформы отправляется то, что лежит на ней</li>
          <li>Топливо одно на караваны и авто-транспорт: резерв (за кредиты) → жидкое топливо → бензин, всё с главной базы</li>
          <li>Груз сверх вместимости склада получателя пропадает при разгрузке — следите за свободным местом</li>
          <li>Есть риск атаки пиратами (зависит от опасности галактики)</li>
          <li>Улучшайте систему для более быстрой и безопасной доставки</li>
        </ul>
      </div>
    </div>
  );
};
