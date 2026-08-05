/**
 * Обслуживание: три служебные операции. Каждая требует подтверждения и
 * показывает результат («истекло ордеров: 12»). Все три — только для админа.
 */

import { useState } from 'react';
import { AlertTriangle, Clock, Sparkles, Trash2, Wrench } from 'lucide-react';
import { Alert, Panel } from '../ui';
import { useAdminActions, useAdminStore, type MaintenanceKind } from '../../features/adminStore';
import type { AdminRole } from '../../utils/adminApi';

interface Task {
  kind: MaintenanceKind;
  title: string;
  description: string;
  confirm: string;
  icon: typeof Clock;
  destructive: boolean;
}

const TASKS: readonly Task[] = [
  {
    kind: 'expire-orders',
    title: 'Истечь просроченные ордера',
    description:
      'Переводит открытые ордера биржи, у которых прошёл срок действия, в статус «expired».',
    confirm: 'Пометить все просроченные открытые ордера как истёкшие?',
    icon: Clock,
    destructive: false,
  },
  {
    kind: 'cleanup-sessions',
    title: 'Убрать истёкшие сессии',
    description:
      'Удаляет из базы строки сессий с истёкшим сроком. Действующие сессии игроков не затрагиваются.',
    confirm: 'Удалить все истёкшие сессии из базы?',
    icon: Trash2,
    destructive: true,
  },
  {
    kind: 'oracle-refresh',
    title: 'Обновить AI-оракул',
    description:
      'Пересчитывает прогнозы, дивиденды и рекомендации. Без ключа DeepSeek используются локальные значения.',
    confirm: 'Запустить обновление данных оракула? Это может занять несколько секунд.',
    icon: Sparkles,
    destructive: false,
  },
];

export function AdminMaintenance({ viewerRole }: { viewerRole: AdminRole }) {
  const meta = useAdminStore((s) => s.maintenanceMeta);
  const results = useAdminStore((s) => s.maintenanceResults);
  const actions = useAdminActions();

  const [pendingConfirm, setPendingConfirm] = useState<MaintenanceKind | null>(null);

  if (viewerRole !== 'admin') {
    return (
      <Alert tone="info" title="Недоступно для модератора">
        Служебные операции выполняет только администратор.
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <Alert tone="warning" title="Служебные операции">
        Действия применяются ко всей базе сразу и записываются в журнал.
      </Alert>

      {meta.error && (
        <Alert tone="danger" title="Операция не выполнена">
          {meta.error}
        </Alert>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {TASKS.map((task) => {
          const Icon = task.icon;
          const result = results[task.kind];
          const confirming = pendingConfirm === task.kind;
          return (
            <Panel key={task.kind} title={task.title} icon={<Icon size={14} />}>
              <div className="flex h-full flex-col justify-between gap-3">
                <p className="text-xs leading-relaxed text-content-muted">{task.description}</p>

                {result && (
                  <Alert tone="accent" title="Результат">
                    {result}
                  </Alert>
                )}

                {confirming ? (
                  <div className="space-y-2 rounded-md border border-warning/40 bg-warning/10 p-2">
                    <p className="flex items-start gap-1.5 text-xs text-content-secondary">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
                      {task.confirm}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={task.destructive ? 'btn-danger btn-xs' : 'btn-primary btn-xs'}
                        disabled={meta.loading}
                        onClick={() =>
                          void actions.runMaintenance(task.kind).then(() => setPendingConfirm(null))
                        }
                      >
                        {meta.loading ? 'Выполняем…' : 'Выполнить'}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn-xs"
                        onClick={() => setPendingConfirm(null)}
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-block"
                    disabled={meta.loading}
                    onClick={() => setPendingConfirm(task.kind)}
                  >
                    <Wrench size={14} aria-hidden="true" />
                    Запустить
                  </button>
                )}
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
