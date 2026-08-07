/*
 * ПОЧЕМУ ЗДЕСЬ instances: 1 (проверено 07.08.2026)
 *
 * Уже безопасно для кластера, править ничего не нужно:
 *   - market-sim: stepMarketSim берёт pg_try_advisory_lock, проигравший процесс не тикает,
 *     а читает состояние read-only (market-sim/persistence.js: withAdvisoryLock);
 *   - зачистка биржи: runMarketMaintenance начинается с pg_advisory_xact_lock, начисления
 *     идут claim-паттерном UPDATE ... WHERE status='pending' RETURNING;
 *   - AI-оракул: с 07.08.2026 обёрнут в тот же advisory-лок (AI_ORACLE_LOCK_KEY), поэтому
 *     второй процесс не пойдёт платно в DeepSeek и не перезапишет ai_oracle_data.
 *
 * ЧТО ЕЩЁ ДЕРЖИТ instances: 1 — только SSE-хаб (server/realtime.js):
 *   - clients — это Set в памяти процесса, поэтому чат, тосты об ордерах и события гильдии
 *     дойдут лишь до тех игроков, кто попал на тот же воркер. Fanout лечится общей шиной
 *     (Postgres LISTEN/NOTIFY — pg уже в зависимостях), и правится это ровно в одном файле:
 *     все 11 мест вызова ходят через broadcast/broadcastToGuild/sendToUser.
 *
 * ВЫДАЧА РЕСУРСОВ КЛАСТЕР БОЛЬШЕ НЕ ДЕРЖИТ (сделано 07.08.2026):
 *   раньше realtimeHub.hasUser() решал, применять ли выдачу онлайн-игроку, и в кластере
 *   чужой воркер отвечал «не в сети». Хуже того, выдача с force терялась и на ОДНОМ процессе:
 *   admin.js патчил game_save и поднимал revision, автосейв игрока получал 409 SAVE_OUTDATED,
 *   а обработчик конфликта по правилу «активная вкладка выигрывает» ПОВТОРЯЛ свою запись
 *   поверх патча — начисление стёрто, админка показывает «выдано».
 *   Теперь игроку с активной сессией начисление кладётся в очередь (таблица player_grants),
 *   и применяет его сам клиент; предикат — sessions в БД, одинаковый для всех воркеров.
 *   hasUser() остался только в ответе админки как справка «дошло ли событие сейчас».
 *
 * Sticky sessions при этом не понадобятся: SSE — это один долгий HTTP-запрос, и неважно,
 * какой воркер его держит, если шина общая. Nginx трогать не нужно.
 */
module.exports = {
  apps: [
    {
      name: 'mygame',
      cwd: __dirname,
      script: 'server/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '750M',
      time: true,
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
