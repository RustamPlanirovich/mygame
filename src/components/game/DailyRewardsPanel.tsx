import { useGameStore } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format';
import { Calendar, Gift, Flame, Clock, Package } from 'lucide-react';
import { formatRewardDescription, canClaimDailyReward, getTimeUntilNextContainer, formatTimeUntilNext } from '../../utils/dailyRewardsHelpers';

export function DailyRewardsPanel() {
  const dailyLogin = useGameStore(s => s.retention.dailyLogin);
  const timeBasedRewards = useGameStore(s => s.retention.timeBasedRewards);
  const claimDailyReward = useGameStore(s => s.claimDailyReward);
  const collectTimeBasedReward = useGameStore(s => s.collectTimeBasedReward);

  const now = Date.now();
  const timeUntilNext = getTimeUntilNextContainer(timeBasedRewards, now);

  return (
    <div className="p-4 space-y-4">
      {/* Header with streak */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-cyber-green" />
          <h3 className="text-lg font-semibold text-cyber-green">Ежедневные награды</h3>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Flame className="w-4 h-4 text-orange-400" />
          <span className="text-orange-400 font-semibold">
            Стрик: {dailyLogin.currentStreak} дней
          </span>
          {dailyLogin.longestStreak > 0 && (
            <span className="text-cyber-text-dim">
              (Рекорд: {dailyLogin.longestStreak})
            </span>
          )}
        </div>
      </div>

      {/* Daily Calendar */}
      <div className="cyber-panel">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Gift className="w-4 h-4" />
          Календарь на 7 дней
        </h4>
        <div className="grid grid-cols-7 gap-2">
          {dailyLogin.rewards.map((reward) => {
            const isCurrent = reward.day === dailyLogin.currentDay;
            const canClaim = canClaimDailyReward(dailyLogin, reward.day);
            
            return (
              <div
                key={reward.day}
                className={`
                  relative p-2 rounded-lg border-2 transition-all
                  ${isCurrent ? 'border-cyber-green bg-cyber-green/10 scale-105' : 'border-cyber-border'}
                  ${reward.claimed ? 'opacity-50 bg-cyber-bg-dark' : ''}
                  ${canClaim ? 'cursor-pointer hover:border-cyber-green' : ''}
                `}
                onClick={() => {
                  if (canClaim) {
                    claimDailyReward(reward.day);
                  }
                }}
              >
                {/* Day number */}
                <div className="text-center mb-1">
                  <div className="text-xs text-cyber-text-dim">День</div>
                  <div className="text-lg font-bold text-white">{reward.day}</div>
                </div>

                {/* Status */}
                {reward.claimed ? (
                  <div className="text-center text-green-400">
                    <svg className="w-6 h-6 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : isCurrent ? (
                  <div className="text-center">
                    <Gift className="w-6 h-6 mx-auto text-cyber-green animate-pulse" />
                  </div>
                ) : (
                  <div className="text-center text-cyber-text-dim">
                    <Package className="w-5 h-5 mx-auto" />
                  </div>
                )}

                {/* Reward hint */}
                <div className="text-xs text-center text-cyber-text-dim mt-1 truncate">
                  {reward.rewards.credits && `${formatNumber(reward.rewards.credits)}`}
                </div>

                {/* Current day indicator */}
                {isCurrent && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyber-green rounded-full animate-pulse" />
                )}
              </div>
            );
          })}
        </div>

        {/* Detailed reward for current day */}
        {dailyLogin.rewards.find(r => r.day === dailyLogin.currentDay) && (
          <div className="mt-4 p-3 bg-cyber-bg-dark rounded-lg border border-cyber-green/30">
            <div className="text-sm mb-2 font-semibold text-cyber-green">
              Награда за день {dailyLogin.currentDay}:
            </div>
            <div className="text-xs text-cyber-text-dim">
              {formatRewardDescription(dailyLogin.rewards.find(r => r.day === dailyLogin.currentDay)!.rewards)}
            </div>
            {canClaimDailyReward(dailyLogin, dailyLogin.currentDay) && (
              <button
                onClick={() => claimDailyReward(dailyLogin.currentDay)}
                className="w-full mt-2 py-2 rounded-lg bg-cyber-green hover:bg-cyber-green/90 text-white font-semibold transition-all"
              >
                Собрать награду
              </button>
            )}
          </div>
        )}
      </div>

      {/* Time-based rewards (containers) */}
      <div className="cyber-panel">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Контейнеры снабжения
          <span className="text-xs text-cyber-text-dim">(каждые 4 часа)</span>
        </h4>

        {/* Available containers */}
        {timeBasedRewards.containers.length > 0 ? (
          <div className="space-y-2">
            {timeBasedRewards.containers.map((container) => (
              <div
                key={container.id}
                className={`
                  p-3 rounded-lg border transition-all
                  ${container.collected 
                    ? 'border-cyber-border bg-cyber-bg-dark opacity-50' 
                    : 'border-cyber-green/30 bg-cyber-green/5'
                  }
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Package className={`w-5 h-5 ${container.collected ? 'text-gray-500' : 'text-cyber-green'}`} />
                    <span className="font-semibold text-sm">
                      {container.name}
                    </span>
                  </div>
                  {container.collected && (
                    <span className="text-xs text-green-400">✓ Собрано</span>
                  )}
                </div>

                {!container.collected && (
                  <>
                    <div className="text-xs text-cyber-text-dim mb-2">
                      {formatRewardDescription(container.rewards)}
                    </div>
                    <button
                      onClick={() => collectTimeBasedReward(container.id)}
                      className="w-full py-1.5 rounded bg-cyber-green hover:bg-cyber-green/90 text-white text-sm font-semibold transition-all"
                    >
                      Собрать
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-cyber-text-dim text-sm py-4">
            Контейнеры пока недоступны
          </div>
        )}

        {/* Time until next */}
        {timeBasedRewards.containers.length < timeBasedRewards.maxStoredContainers && (
          <div className="mt-3 p-2 bg-cyber-bg-dark rounded text-center">
            <div className="text-xs text-cyber-text-dim">
              Следующий контейнер через:
            </div>
            <div className="text-sm text-cyber-green font-semibold">
              {formatTimeUntilNext(timeUntilNext)}
            </div>
          </div>
        )}

        {timeBasedRewards.containers.length >= timeBasedRewards.maxStoredContainers && (
          <div className="mt-3 text-xs text-orange-400 text-center">
            ⚠️ Максимум контейнеров! Соберите их, чтобы получать новые.
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="cyber-panel">
        <h4 className="text-sm font-semibold mb-2">Статистика</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-cyber-text-dim">Всего входов:</span>
            <div className="text-white font-semibold">{dailyLogin.totalLogins}</div>
          </div>
          <div>
            <span className="text-cyber-text-dim">Рекорд стрика:</span>
            <div className="text-white font-semibold">{dailyLogin.longestStreak} дней</div>
          </div>
        </div>
      </div>
    </div>
  );
}
