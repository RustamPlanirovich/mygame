/**
 * Панель гильдии
 */

import { useEffect, useState } from 'react';
import { useMarketStore } from '../../../features/marketStore';
import { formatVolume } from '../../../utils/marketApi';
import type { GuildBonus } from '../../../core/gameTypes.market';

const BONUS_INFO: Record<GuildBonus, { emoji: string; title: string; description: string }> = {
  trade_fee_reduction: {
    emoji: '💰',
    title: 'Снижение комиссии',
    description: 'Комиссия 1.5% вместо 2%',
  },
  priority_orders: {
    emoji: '⚡',
    title: 'Приоритетные ордера',
    description: 'Ваши ордера исполняются первыми',
  },
  bulk_discount: {
    emoji: '📦',
    title: 'Оптовая скидка',
    description: 'Скидка на большие объёмы',
  },
  extended_order_time: {
    emoji: '⏰',
    title: 'Продлённые ордера',
    description: 'Ордера действуют 48ч вместо 24ч',
  },
};

export function GuildPanel() {
  // Узкие селекторы вместо подписки на весь стор: панель гильдии не должна
  // перерисовываться от каждой загрузки книги ордеров или сейфа.
  const myGuild = useMarketStore((s) => s.myGuild);
  const guilds = useMarketStore((s) => s.guilds);
  const guildChat = useMarketStore((s) => s.guildChat);
  const fetchMyGuild = useMarketStore((s) => s.fetchMyGuild);
  const fetchGuilds = useMarketStore((s) => s.fetchGuilds);
  const fetchGuildChat = useMarketStore((s) => s.fetchGuildChat);
  const createGuild = useMarketStore((s) => s.createGuild);
  const joinGuild = useMarketStore((s) => s.joinGuild);
  const leaveGuild = useMarketStore((s) => s.leaveGuild);
  const depositToTreasury = useMarketStore((s) => s.depositToTreasury);
  const sendGuildMessage = useMarketStore((s) => s.sendGuildMessage);
  const isLoading = useMarketStore((s) => s.isLoading);

  const [view, setView] = useState<'my' | 'search' | 'create'>('my');
  const [searchQuery, setSearchQuery] = useState('');
  const [newGuildName, setNewGuildName] = useState('');
  const [newGuildTag, setNewGuildTag] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [chatMessage, setChatMessage] = useState('');

  useEffect(() => {
    fetchMyGuild();
    fetchGuilds();
  }, [fetchMyGuild, fetchGuilds]);

  useEffect(() => {
    if (myGuild) {
      fetchGuildChat();
      // Обновляем чат каждые 10 секунд
      const interval = setInterval(fetchGuildChat, 10000);
      return () => clearInterval(interval);
    }
  }, [myGuild, fetchGuildChat]);

  const handleSearch = () => {
    fetchGuilds(searchQuery);
  };

  const handleCreateGuild = async () => {
    if (!newGuildName || !newGuildTag) return;
    const success = await createGuild(newGuildName, newGuildTag);
    if (success) {
      setNewGuildName('');
      setNewGuildTag('');
      setView('my');
    }
  };

  const handleJoinGuild = async (guildId: string) => {
    const success = await joinGuild(guildId);
    if (success) {
      setView('my');
    }
  };

  const handleLeaveGuild = async () => {
    if (confirm('Вы уверены, что хотите покинуть гильдию?')) {
      await leaveGuild();
    }
  };

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) return;
    const success = await depositToTreasury(amount);
    if (success) {
      setDepositAmount('');
    }
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim()) return;
    const success = await sendGuildMessage(chatMessage);
    if (success) {
      setChatMessage('');
    }
  };

  // Если состоит в гильдии - показываем панель гильдии
  if (myGuild) {
    return (
      <div className="space-y-4">
        {/* Информация о гильдии */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <span>🏰</span>
                <span>{myGuild.name}</span>
                <span className="text-purple-400">[{myGuild.tag}]</span>
              </h3>
              <p className="text-sm text-gray-400">
                Уровень {myGuild.level} • Ваша роль: {myGuild.myRole === 'leader' ? '👑 Лидер' : myGuild.myRole === 'officer' ? '⚔️ Офицер' : '👤 Участник'}
              </p>
            </div>
            <button
              onClick={handleLeaveGuild}
              className="text-red-400 hover:text-red-300 text-sm px-3 py-1 bg-red-900/30 rounded"
            >
              Покинуть
            </button>
          </div>

          {/* Статистика */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-700 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-yellow-400">
                {formatVolume(myGuild.treasury)} 💳
              </div>
              <div className="text-xs text-gray-400">Казна</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-blue-400">
                {myGuild.experience}/{myGuild.experienceForNextLevel}
              </div>
              <div className="text-xs text-gray-400">Опыт</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-green-400">
                {formatVolume(myGuild.myContribution || '0')} 💳
              </div>
              <div className="text-xs text-gray-400">Мой вклад</div>
            </div>
          </div>

          {/* Бонусы */}
          <div className="mb-4">
            <div className="text-sm text-gray-400 mb-2">Бонусы гильдии:</div>
            <div className="flex flex-wrap gap-2">
              {myGuild.bonuses.map(bonus => (
                <div
                  key={bonus}
                  className="px-2 py-1 bg-purple-600/30 text-purple-300 rounded text-sm flex items-center gap-1"
                  title={BONUS_INFO[bonus]?.description}
                >
                  <span>{BONUS_INFO[bonus]?.emoji}</span>
                  <span>{BONUS_INFO[bonus]?.title}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Взнос в казну */}
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Сумма взноса"
              className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
            />
            <button
              onClick={handleDeposit}
              disabled={!depositAmount || isLoading}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 rounded-lg font-medium"
            >
              💰 Внести
            </button>
          </div>
        </div>

        {/* Чат гильдии */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="font-bold mb-3 flex items-center gap-2">
            <span>💬</span>
            <span>Чат гильдии</span>
          </h4>

          {/* Сообщения */}
          <div className="h-48 overflow-y-auto bg-gray-900 rounded-lg p-2 mb-2 space-y-2">
            {guildChat.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                Нет сообщений
              </div>
            )}
            {guildChat.map(msg => (
              <div key={msg.id} className="text-sm">
                <span className="text-purple-400 font-medium">{msg.playerName}:</span>
                <span className="text-gray-300 ml-2">{msg.message}</span>
              </div>
            ))}
          </div>

          {/* Ввод сообщения */}
          <div className="flex gap-2">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Написать сообщение..."
              maxLength={500}
              className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
            />
            <button
              onClick={handleSendMessage}
              disabled={!chatMessage.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded-lg"
            >
              📤
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Если не состоит в гильдии
  return (
    <div className="space-y-4">
      {/* Переключатель */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('search')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            view === 'search'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          🔍 Найти гильдию
        </button>
        <button
          onClick={() => setView('create')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            view === 'create'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          ➕ Создать гильдию
        </button>
      </div>

      {/* Поиск гильдий */}
      {view === 'search' && (
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Название или тег..."
              className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
            />
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
            >
              🔍
            </button>
          </div>

          {isLoading && (
            <div className="text-center text-gray-400 py-4">Загрузка...</div>
          )}

          {!isLoading && guilds.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              Гильдии не найдены
            </div>
          )}

          <div className="space-y-2">
            {guilds.map(guild => (
              <div
                key={guild.id}
                className="bg-gray-700 rounded-lg p-3 flex items-center justify-between"
              >
                <div>
                  <div className="font-bold">
                    {guild.name} <span className="text-purple-400">[{guild.tag}]</span>
                  </div>
                  <div className="text-sm text-gray-400">
                    Уровень {guild.level} • {guild.memberCount}/{guild.maxMembers} участников
                  </div>
                </div>
                <button
                  onClick={() => handleJoinGuild(guild.id)}
                  disabled={(guild.memberCount ?? 0) >= guild.maxMembers}
                  className="px-3 py-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 rounded text-sm font-medium"
                >
                  Вступить
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Создание гильдии */}
      {view === 'create' && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-bold mb-4">Создать гильдию</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Название (3-24 символа)
              </label>
              <input
                type="text"
                value={newGuildName}
                onChange={(e) => setNewGuildName(e.target.value)}
                maxLength={24}
                placeholder="Моя гильдия"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Тег (2-4 символа, только буквы и цифры)
              </label>
              <input
                type="text"
                value={newGuildTag}
                onChange={(e) => setNewGuildTag(e.target.value.toUpperCase())}
                maxLength={4}
                placeholder="TAG"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white uppercase"
              />
            </div>

            <div className="bg-gray-700 rounded-lg p-3 text-sm text-gray-400">
              💡 Создание гильдии даёт доступ к бонусам торговли. 
              С повышением уровня открываются новые бонусы и увеличивается лимит участников.
            </div>

            <button
              onClick={handleCreateGuild}
              disabled={
                isLoading || 
                newGuildName.length < 3 || 
                newGuildTag.length < 2 ||
                !/^[A-Za-z0-9]+$/.test(newGuildTag)
              }
              className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 rounded-lg font-bold"
            >
              🏰 Создать гильдию
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
