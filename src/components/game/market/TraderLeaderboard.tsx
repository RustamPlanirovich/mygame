/**
 * Лидерборд трейдеров
 */

import { useEffect, useState } from 'react';
import { useMarketStore } from '../../../features/marketStore';
import { formatVolume } from '../../../utils/marketApi';
import type { TraderBadge } from '../../../core/gameTypes.market';
import { GameIcon, IconText } from '../../ui/icons';

const BADGE_INFO: Record<TraderBadge, { emoji: string; title: string }> = {
  newcomer: { emoji: '🌱', title: 'Новичок' },
  active_trader: { emoji: '📈', title: 'Активный трейдер' },
  whale: { emoji: '🐋', title: 'Кит' },
  reliable: { emoji: '✅', title: 'Надёжный' },
  guild_master: { emoji: '👑', title: 'Глава гильдии' },
  market_maker: { emoji: '💎', title: 'Маркет-мейкер' },
};

export function TraderLeaderboard() {
  // Узкие селекторы вместо подписки на весь стор.
  const leaderboard = useMarketStore((s) => s.leaderboard);
  const leaderboardTotal = useMarketStore((s) => s.leaderboardTotal);
  const fetchLeaderboard = useMarketStore((s) => s.fetchLeaderboard);
  const isLoading = useMarketStore((s) => s.isLoading);

  const [sortBy, setSortBy] = useState<'volume' | 'trades'>('volume');

  useEffect(() => {
    fetchLeaderboard(sortBy);
  }, [fetchLeaderboard, sortBy]);

  const getRankEmoji = (index: number) => {
    switch (index) {
      case 0: return '🥇';
      case 1: return '🥈';
      case 2: return '🥉';
      default: return `#${index + 1}`;
    }
  };

  const getRatingStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;
    return '⭐'.repeat(fullStars) + (hasHalf ? '½' : '');
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <span><GameIcon icon="🏆" /></span>
          <span>Лидерборд трейдеров</span>
        </h3>

        {/* Сортировка */}
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('volume')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              sortBy === 'volume'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            По объёму
          </button>
          <button
            onClick={() => setSortBy('trades')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              sortBy === 'trades'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            По сделкам
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="text-center text-gray-400 py-8">Загрузка...</div>
      )}

      {!isLoading && leaderboard.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          Пока нет данных о трейдерах
        </div>
      )}

      {!isLoading && leaderboard.length > 0 && (
        <div className="space-y-3">
          {leaderboard.map((trader, index) => (
            <div 
              key={trader.playerId}
              className={`bg-gray-700 rounded-lg p-3 ${
                index < 3 ? 'border border-yellow-500/30' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Ранг */}
                <div className="text-2xl w-12 text-center">
                  <GameIcon icon={getRankEmoji(index)} />
                </div>

                {/* Информация о трейдере */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{trader.playerName}</span>
                    {trader.guildId && (
                      <span className="text-xs px-2 py-0.5 bg-purple-600/30 text-purple-300 rounded">
                        [{(trader as any).guildTag}]
                      </span>
                    )}
                  </div>
                  
                  {/* Бейджи */}
                  <div className="flex gap-1 mt-1">
                    {trader.badges.map(badge => (
                      <span 
                        key={badge}
                        title={BADGE_INFO[badge]?.title || badge}
                        className="text-sm"
                      >
                        <IconText>{BADGE_INFO[badge]?.emoji || '🏷️'}</IconText>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Статистика */}
                <div className="text-right">
                  <div className="text-yellow-400 font-bold">
                    {formatVolume(trader.totalVolume)} <GameIcon icon="💳" />
                  </div>
                  <div className="text-sm text-gray-400">
                    {trader.totalTrades} сделок
                  </div>
                  <div className="text-xs text-gray-500">
                    {getRatingStars(trader.rating)} ({trader.rating.toFixed(1)})
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {leaderboardTotal > leaderboard.length && (
        <div className="text-center text-gray-400 mt-4 text-sm">
          Показано {leaderboard.length} из {leaderboardTotal} трейдеров
        </div>
      )}
    </div>
  );
}
