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
    <div className="bg-gray-800 rounded-lg p-3">
      {/* Заголовок и переключатель сортировки — в столбик: в строку они не помещались */}
      <div className="mb-3 space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <span><GameIcon icon="🏆" /></span>
          <span>Лидерборд трейдеров</span>
        </h3>

        {/* Сортировка */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setSortBy('volume')}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              sortBy === 'volume'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            По объёму
          </button>
          <button
            onClick={() => setSortBy('trades')}
            className={`rounded px-2 py-1 text-xs transition-colors ${
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
        <div className="py-4 text-center text-xs text-gray-400">Загрузка...</div>
      )}

      {!isLoading && leaderboard.length === 0 && (
        <div className="py-4 text-center text-xs text-gray-400">
          Пока нет данных о трейдерах
        </div>
      )}

      {!isLoading && leaderboard.length > 0 && (
        <div className="space-y-2">
          {leaderboard.map((trader, index) => (
            <div
              key={trader.playerId}
              className={`rounded-lg bg-gray-700 p-2.5 ${
                index < 3 ? 'border border-yellow-500/30' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                {/* Ранг */}
                <div className="w-7 shrink-0 text-center text-lg">
                  <GameIcon icon={getRankEmoji(index)} />
                </div>

                {/* Информация о трейдере */}
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-xs font-bold">{trader.playerName}</span>
                    {trader.guildId && (
                      <span className="shrink-0 rounded bg-purple-600/30 px-1.5 py-0.5 text-3xs text-purple-300">
                        [{(trader as any).guildTag}]
                      </span>
                    )}
                  </div>

                  {/* Бейджи */}
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {trader.badges.map(badge => (
                      <span
                        key={badge}
                        title={BADGE_INFO[badge]?.title || badge}
                        className="text-xs"
                      >
                        <IconText>{BADGE_INFO[badge]?.emoji || '🏷️'}</IconText>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Статистика */}
                <div className="shrink-0 text-right tabular-nums">
                  <div className="whitespace-nowrap text-xs font-bold text-yellow-400">
                    {formatVolume(trader.totalVolume)} <GameIcon icon="💳" />
                  </div>
                  <div className="whitespace-nowrap text-2xs text-gray-400">
                    {trader.totalTrades} сделок
                  </div>
                  <div className="whitespace-nowrap text-3xs text-gray-500">
                    {getRatingStars(trader.rating)} ({trader.rating.toFixed(1)})
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {leaderboardTotal > leaderboard.length && (
        <div className="mt-3 text-center text-2xs text-gray-400">
          Показано {leaderboard.length} из {leaderboardTotal} трейдеров
        </div>
      )}
    </div>
  );
}
