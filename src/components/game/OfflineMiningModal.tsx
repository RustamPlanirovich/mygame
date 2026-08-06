/**
 * ОКНО ОФЛАЙН-ДОБЫЧИ — что база наработала, пока игрока не было в сети.
 *
 * Показывается один раз после загрузки сейва, если отчёт непустой (см. gameStore.loadGame
 * и core/systems/offlineProgress.ts). Начисление происходит по кнопке: игрок должен
 * увидеть, за что именно ему заплатили, иначе прибавка к складам выглядит как баг.
 *
 * Закрытие крестиком и по фону тоже начисляет. Отдельного «отказаться» нет намеренно:
 * потерять ночную добычу промахом мыши — худший исход из всех возможных здесь.
 */

import React from 'react';
import { useGameStore } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format';
import { resourceIcon, resourceLabel } from '../../core/i18n/label';
import { OFFLINE_MAX_SECONDS } from '../../core/systems/offlineProgress';
import { Alert, Modal } from '../ui';
import { GameIcon } from '../ui/icons';

/**
 * Длительность по-русски: «7 ч 20 мин». formatTime из core/math/format даёт «7h 20m» —
 * английские сокращения посреди русского интерфейса (см. правила подписей в CLAUDE.md).
 */
function formatOfflineDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (days > 0) return hours > 0 ? `${days} д ${hours} ч` : `${days} д`;
  if (hours > 0) return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`;
  if (minutes > 0) return `${minutes} мин`;
  return `${total} с`;
}

export const OfflineMiningModal: React.FC = () => {
  // Точечные подписки: окно не должно перерисовываться на каждый тик игры.
  const report = useGameStore((s) => s.offlineMining);
  const claim = useGameStore((s) => s.claimOfflineMining);

  if (!report) return null;

  const efficiencyPercent = Math.round(report.efficiency * 100);
  const trimmedByLimit = report.creditedSeconds < report.elapsedSeconds;

  return (
    <Modal
      open
      onClose={claim}
      size="sm"
      icon={<GameIcon icon="⛏️" />}
      title="С возвращением!"
      subtitle={`Вас не было ${formatOfflineDuration(report.elapsedSeconds)} — база продолжала добычу`}
      footer={
        <button type="button" data-autofocus onClick={claim} className="btn-primary w-full">
          Забрать
        </button>
      }
    >
      <div className="space-y-4 p-4">
        <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-center">
          <div className="stat-label">Эффективность офлайн-добычи</div>
          <div className="mt-1 font-mono text-3xl font-bold tabular-nums text-accent">
            {efficiencyPercent}%
          </div>
          <div className="mt-1 text-xs text-content-faint">
            зачтено{' '}
            <span className="font-mono tabular-nums">
              {formatOfflineDuration(report.creditedSeconds)}
            </span>{' '}
            работы
          </div>
        </div>

        <div>
          <div className="stat-label mb-2">Добыто:</div>
          {/* Список ограничен по высоте: на развитой базе производится под сотню ресурсов. */}
          <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
            {report.gains.map((gain) => (
              <div
                key={gain.resource}
                className="flex items-center justify-between rounded bg-surface-3 px-2 py-1 text-sm"
              >
                <span className="flex items-center gap-2 text-content-secondary">
                  <GameIcon icon={resourceIcon(gain.resource)} />
                  {resourceLabel(gain.resource)}
                </span>
                <span className="flex items-center gap-2">
                  {gain.capped && (
                    <span className="text-xs text-warning" title="Склад заполнен">
                      склад полон
                    </span>
                  )}
                  <span className="font-mono tabular-nums text-accent">
                    +{formatNumber(gain.amount)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/*
          Демон «Ночная смена». Показываем и удержанную аренду, и случай неполной оплаты:
          иначе игрок видел бы «эффективность 81%» вместо обещанных 95% и читал бы это как
          поломку, а не как «энергетика не вытянула смену».
        */}
        {report.nightShift && (
          <Alert tone={report.nightShift.paidShare >= 1 ? 'info' : 'warning'}>
            <span className="flex items-center gap-1">
              <GameIcon icon="💤" /> Ночная смена удержала{' '}
              <span className="font-mono tabular-nums">
                {formatNumber(report.nightShift.energyFee)}
              </span>
              <GameIcon icon="⚡" /> из ночной выработки.
            </span>
            {report.nightShift.paidShare < 1 && (
              <span>
                {' '}
                Оплатить смену целиком не хватило энергии — засчитано{' '}
                <span className="font-mono tabular-nums">
                  {Math.round(report.nightShift.paidShare * 100)}
                </span>
                % надбавки.
              </span>
            )}
          </Alert>
        )}

        {trimmedByLimit && (
          <Alert tone="warning">
            Офлайн засчитывается не больше{' '}
            <span className="font-mono tabular-nums">{Math.round(OFFLINE_MAX_SECONDS / 3600)}</span>{' '}
            ч подряд — остальное время отсутствия не оплачено.
          </Alert>
        )}

        {report.anyCapped && (
          <Alert tone="warning">
            Часть добычи не поместилась: склады переполнены. Постройте хранилища, чтобы не
            терять офлайн-выработку.
          </Alert>
        )}

        <Alert tone="info">
          Офлайн база работает на{' '}
          <span className="font-mono tabular-nums">{efficiencyPercent}</span>% от онлайна —
          играйте вживую, чтобы получать полную выработку.
        </Alert>
      </div>
    </Modal>
  );
};

export default OfflineMiningModal;
