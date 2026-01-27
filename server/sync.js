/**
 * Sync Server - Фаза 8
 * Серверная логика для синхронизации сохранений между устройствами
 */

import { pool } from './db.js';
import crypto from 'crypto';

/**
 * Инициализация таблиц синхронизации
 */
export async function initSyncTables() {
  // Таблица устройств
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_devices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_id VARCHAR(100) NOT NULL,
      device_name VARCHAR(200) NOT NULL,
      platform VARCHAR(20) NOT NULL,
      browser VARCHAR(50),
      os VARCHAR(50),
      last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, device_id)
    )
  `);

  // Таблица облачных сохранений
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cloud_saves (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      slot_id INTEGER NOT NULL REFERENCES game_slots(id) ON DELETE CASCADE,
      device_id VARCHAR(100) NOT NULL,
      device_name VARCHAR(200),
      version VARCHAR(20) NOT NULL,
      checksum VARCHAR(64) NOT NULL,
      compressed BOOLEAN DEFAULT true,
      size_bytes INTEGER NOT NULL,
      data TEXT NOT NULL,
      era INTEGER,
      credits VARCHAR(100),
      buildings_count INTEGER,
      play_time INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, slot_id)
    )
  `);

  // Таблица бэкапов
  await pool.query(`
    CREATE TABLE IF NOT EXISTS save_backups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      slot_id INTEGER NOT NULL REFERENCES game_slots(id) ON DELETE CASCADE,
      save_id UUID REFERENCES cloud_saves(id) ON DELETE SET NULL,
      name VARCHAR(200),
      reason VARCHAR(20) NOT NULL,
      checksum VARCHAR(64) NOT NULL,
      compressed BOOLEAN DEFAULT true,
      size_bytes INTEGER NOT NULL,
      data TEXT NOT NULL,
      era INTEGER,
      play_time INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);

  // Таблица конфликтов
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sync_conflicts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      slot_id INTEGER NOT NULL REFERENCES game_slots(id) ON DELETE CASCADE,
      local_device_id VARCHAR(100) NOT NULL,
      local_device_name VARCHAR(200),
      local_timestamp TIMESTAMPTZ NOT NULL,
      local_checksum VARCHAR(64) NOT NULL,
      cloud_timestamp TIMESTAMPTZ NOT NULL,
      cloud_checksum VARCHAR(64) NOT NULL,
      resolved BOOLEAN DEFAULT false,
      resolved_at TIMESTAMPTZ,
      resolution VARCHAR(20),
      resolved_by VARCHAR(20),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Таблица истории
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sync_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      slot_id INTEGER REFERENCES game_slots(id) ON DELETE SET NULL,
      device_id VARCHAR(100) NOT NULL,
      operation VARCHAR(20) NOT NULL,
      status VARCHAR(20) NOT NULL,
      duration_ms INTEGER,
      size_bytes INTEGER,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Индексы
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cloud_saves_user_id ON cloud_saves(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cloud_saves_slot_id ON cloud_saves(slot_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_save_backups_user_id ON save_backups(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sync_conflicts_user_id ON sync_conflicts(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sync_history_user_id ON sync_history(user_id)`);

  console.log('[Sync] Tables initialized');
}

/**
 * Создать роуты синхронизации
 */
export function createSyncRoutes(app, authMiddleware) {
  // ========== SYNC SAVE ==========

  // Синхронизировать сохранение
  app.post('/api/sync/save', authMiddleware, async (req, res) => {
    const startTime = Date.now();
    const userId = req.userId;
    
    try {
      const {
        slotId,
        deviceId,
        deviceName,
        localTimestamp,
        checksum,
        data,
        compressed,
        version,
        forcePush
      } = req.body;

      if (!slotId || !deviceId || !data || !checksum) {
        return res.status(400).json({ 
          ok: false, 
          status: 'no_change',
          error: 'Missing required fields' 
        });
      }

      // Проверяем, существует ли слот и принадлежит ли он пользователю
      const slotResult = await pool.query(
        'SELECT id FROM game_slots WHERE id = $1 AND user_id = $2',
        [slotId, userId]
      );

      if (slotResult.rowCount === 0) {
        return res.status(404).json({ 
          ok: false, 
          status: 'no_change',
          error: 'Slot not found' 
        });
      }

      // Проверяем, есть ли уже сохранение в облаке
      const cloudSaveResult = await pool.query(
        'SELECT id, checksum, updated_at, device_id FROM cloud_saves WHERE user_id = $1 AND slot_id = $2',
        [userId, slotId]
      );

      const sizeBytes = Buffer.byteLength(data, 'utf8');

      // Извлекаем метаданные из сохранения для превью
      let era = null;
      let credits = null;
      let buildingsCount = null;
      let playTime = null;

      try {
        // Если данные не сжаты, парсим их
        if (!compressed) {
          const parsed = JSON.parse(data);
          era = parsed.currentEra || null;
          credits = parsed.currencies?.credits || null;
          buildingsCount = parsed.buildings?.length || null;
          playTime = parsed.playTime || null;
        }
      } catch (e) {
        // Игнорируем ошибки парсинга
      }

      if (cloudSaveResult.rowCount === 0) {
        // Нет облачного сохранения - создаём новое
        await pool.query(`
          INSERT INTO cloud_saves 
          (user_id, slot_id, device_id, device_name, version, checksum, compressed, size_bytes, data, era, credits, buildings_count, play_time)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [userId, slotId, deviceId, deviceName, version, checksum, compressed, sizeBytes, data, era, credits, buildingsCount, playTime]);

        // Записываем в историю
        await logSyncHistory(userId, slotId, deviceId, 'push', 'success', Date.now() - startTime, sizeBytes);

        return res.json({
          ok: true,
          status: 'synced',
          serverTimestamp: Date.now(),
          serverChecksum: checksum,
        });
      }

      const cloudSave = cloudSaveResult.rows[0];

      // Проверяем, совпадают ли чексуммы
      if (cloudSave.checksum === checksum) {
        // Ничего не изменилось
        return res.json({
          ok: true,
          status: 'no_change',
          serverTimestamp: new Date(cloudSave.updated_at).getTime(),
          serverChecksum: cloudSave.checksum,
        });
      }

      // Чексуммы разные - возможен конфликт
      const cloudTimestamp = new Date(cloudSave.updated_at).getTime();

      // Если forcePush или облачное сохранение старше локального - перезаписываем
      if (forcePush || cloudTimestamp < localTimestamp) {
        await pool.query(`
          UPDATE cloud_saves 
          SET device_id = $3, device_name = $4, version = $5, checksum = $6, 
              compressed = $7, size_bytes = $8, data = $9, era = $10, 
              credits = $11, buildings_count = $12, play_time = $13, updated_at = NOW()
          WHERE user_id = $1 AND slot_id = $2
        `, [userId, slotId, deviceId, deviceName, version, checksum, compressed, sizeBytes, data, era, credits, buildingsCount, playTime]);

        await logSyncHistory(userId, slotId, deviceId, 'push', 'success', Date.now() - startTime, sizeBytes);

        return res.json({
          ok: true,
          status: 'synced',
          serverTimestamp: Date.now(),
          serverChecksum: checksum,
        });
      }

      // Облачное сохранение новее - конфликт
      // Создаём запись о конфликте
      const conflictResult = await pool.query(`
        INSERT INTO sync_conflicts 
        (user_id, slot_id, local_device_id, local_device_name, local_timestamp, local_checksum, cloud_timestamp, cloud_checksum)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [userId, slotId, deviceId, deviceName, new Date(localTimestamp), checksum, cloudSave.updated_at, cloudSave.checksum]);

      await logSyncHistory(userId, slotId, deviceId, 'conflict', 'conflict', Date.now() - startTime, sizeBytes);

      // Возвращаем информацию о конфликте
      return res.json({
        ok: true,
        status: 'conflict',
        conflict: {
          id: conflictResult.rows[0].id,
          localSave: {
            id: 'local',
            slotId,
            name: 'Local Save',
            timestamp: localTimestamp,
            deviceId,
            deviceName: deviceName || 'Unknown',
            version,
            checksum,
            compressed,
            size: sizeBytes,
          },
          cloudSave: {
            id: cloudSave.id,
            slotId,
            name: 'Cloud Save',
            timestamp: cloudTimestamp,
            deviceId: cloudSave.device_id,
            deviceName: cloudSave.device_name || 'Unknown',
            version: cloudSave.version,
            checksum: cloudSave.checksum,
            compressed: cloudSave.compressed,
            size: cloudSave.size_bytes,
          },
          detectedAt: Date.now(),
          resolved: false,
          resolveOptions: ['use_local', 'use_cloud', 'merge', 'keep_both'],
        },
      });
    } catch (e) {
      console.error('[Sync] Error:', e);
      await logSyncHistory(userId, req.body?.slotId, req.body?.deviceId, 'push', 'failed', Date.now() - startTime, 0, e.message);
      res.status(500).json({ ok: false, status: 'no_change', error: String(e?.message ?? e) });
    }
  });

  // Получить сохранение с сервера
  app.get('/api/sync/save/:slotId', authMiddleware, async (req, res) => {
    const userId = req.userId;
    const slotId = parseInt(req.params.slotId);

    try {
      const result = await pool.query(
        'SELECT * FROM cloud_saves WHERE user_id = $1 AND slot_id = $2',
        [userId, slotId]
      );

      if (result.rowCount === 0) {
        return res.json({ ok: true }); // Нет сохранения
      }

      const save = result.rows[0];

      res.json({
        ok: true,
        save: {
          id: save.id,
          slotId: save.slot_id,
          name: 'Cloud Save',
          timestamp: new Date(save.updated_at).getTime(),
          deviceId: save.device_id,
          deviceName: save.device_name,
          version: save.version,
          checksum: save.checksum,
          compressed: save.compressed,
          size: save.size_bytes,
          era: save.era,
          credits: save.credits,
          buildingsCount: save.buildings_count,
          playTime: save.play_time,
        },
        data: save.data,
        compressed: save.compressed,
        checksum: save.checksum,
      });
    } catch (e) {
      console.error('[Sync] Error getting save:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  // Получить список облачных сохранений
  app.get('/api/sync/saves', authMiddleware, async (req, res) => {
    const userId = req.userId;

    try {
      const result = await pool.query(`
        SELECT cs.*, gs.name as slot_name 
        FROM cloud_saves cs
        JOIN game_slots gs ON cs.slot_id = gs.id
        WHERE cs.user_id = $1
        ORDER BY cs.updated_at DESC
      `, [userId]);

      const saves = result.rows.map(row => ({
        id: row.id,
        slotId: row.slot_id,
        name: row.slot_name || 'Cloud Save',
        timestamp: new Date(row.updated_at).getTime(),
        deviceId: row.device_id,
        deviceName: row.device_name,
        version: row.version,
        checksum: row.checksum,
        compressed: row.compressed,
        size: row.size_bytes,
        era: row.era,
        credits: row.credits,
        buildingsCount: row.buildings_count,
        playTime: row.play_time,
      }));

      res.json({ ok: true, saves });
    } catch (e) {
      console.error('[Sync] Error listing saves:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  // Удалить облачное сохранение
  app.delete('/api/sync/save/:saveId', authMiddleware, async (req, res) => {
    const userId = req.userId;
    const saveId = req.params.saveId;

    try {
      await pool.query(
        'DELETE FROM cloud_saves WHERE id = $1 AND user_id = $2',
        [saveId, userId]
      );

      res.json({ ok: true });
    } catch (e) {
      console.error('[Sync] Error deleting save:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  // ========== BACKUPS ==========

  // Создать бэкап
  app.post('/api/sync/backups', authMiddleware, async (req, res) => {
    const userId = req.userId;

    try {
      const { slotId, reason, name } = req.body;

      if (!slotId || !reason) {
        return res.status(400).json({ ok: false, error: 'Missing required fields' });
      }

      // Получаем текущее облачное сохранение
      const saveResult = await pool.query(
        'SELECT * FROM cloud_saves WHERE user_id = $1 AND slot_id = $2',
        [userId, slotId]
      );

      if (saveResult.rowCount === 0) {
        return res.status(404).json({ ok: false, error: 'No cloud save found' });
      }

      const save = saveResult.rows[0];

      // Вычисляем дату истечения (30 дней)
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Создаём бэкап
      const backupResult = await pool.query(`
        INSERT INTO save_backups 
        (user_id, slot_id, save_id, name, reason, checksum, compressed, size_bytes, data, era, play_time, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, created_at
      `, [userId, slotId, save.id, name || `Backup - ${reason}`, reason, save.checksum, save.compressed, save.size_bytes, save.data, save.era, save.play_time, expiresAt]);

      const backup = backupResult.rows[0];

      res.json({
        ok: true,
        backup: {
          id: backup.id,
          saveId: save.id,
          slotId,
          name: name || `Backup - ${reason}`,
          createdAt: new Date(backup.created_at).getTime(),
          reason,
          expiresAt: expiresAt.getTime(),
          size: save.size_bytes,
          checksum: save.checksum,
        },
      });
    } catch (e) {
      console.error('[Sync] Error creating backup:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  // Получить список бэкапов
  app.get('/api/sync/backups', authMiddleware, async (req, res) => {
    const userId = req.userId;
    const slotId = req.query.slotId ? parseInt(req.query.slotId) : null;

    try {
      let query = 'SELECT * FROM save_backups WHERE user_id = $1 AND expires_at > NOW()';
      const params = [userId];

      if (slotId) {
        query += ' AND slot_id = $2';
        params.push(slotId);
      }

      query += ' ORDER BY created_at DESC';

      const result = await pool.query(query, params);

      const backups = result.rows.map(row => ({
        id: row.id,
        saveId: row.save_id,
        slotId: row.slot_id,
        name: row.name,
        createdAt: new Date(row.created_at).getTime(),
        reason: row.reason,
        expiresAt: new Date(row.expires_at).getTime(),
        size: row.size_bytes,
        checksum: row.checksum,
      }));

      res.json({ ok: true, backups });
    } catch (e) {
      console.error('[Sync] Error listing backups:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  // Восстановить из бэкапа
  app.post('/api/sync/backups/restore', authMiddleware, async (req, res) => {
    const userId = req.userId;

    try {
      const { backupId, targetSlotId } = req.body;

      if (!backupId) {
        return res.status(400).json({ ok: false, error: 'Missing backupId' });
      }

      // Получаем бэкап
      const backupResult = await pool.query(
        'SELECT * FROM save_backups WHERE id = $1 AND user_id = $2',
        [backupId, userId]
      );

      if (backupResult.rowCount === 0) {
        return res.status(404).json({ ok: false, error: 'Backup not found' });
      }

      const backup = backupResult.rows[0];
      const slotId = targetSlotId || backup.slot_id;

      // Проверяем слот
      const slotResult = await pool.query(
        'SELECT id FROM game_slots WHERE id = $1 AND user_id = $2',
        [slotId, userId]
      );

      if (slotResult.rowCount === 0) {
        return res.status(404).json({ ok: false, error: 'Target slot not found' });
      }

      res.json({
        ok: true,
        data: backup.data,
        compressed: backup.compressed,
        checksum: backup.checksum,
      });
    } catch (e) {
      console.error('[Sync] Error restoring backup:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  // Удалить бэкап
  app.delete('/api/sync/backups/:backupId', authMiddleware, async (req, res) => {
    const userId = req.userId;
    const backupId = req.params.backupId;

    try {
      await pool.query(
        'DELETE FROM save_backups WHERE id = $1 AND user_id = $2',
        [backupId, userId]
      );

      res.json({ ok: true });
    } catch (e) {
      console.error('[Sync] Error deleting backup:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  // ========== DEVICES ==========

  // Зарегистрировать устройство
  app.post('/api/sync/devices', authMiddleware, async (req, res) => {
    const userId = req.userId;

    try {
      const { id, name, platform, browser, os } = req.body;

      if (!id || !name || !platform) {
        return res.status(400).json({ ok: false, error: 'Missing required fields' });
      }

      // Upsert устройства
      await pool.query(`
        INSERT INTO user_devices (user_id, device_id, device_name, platform, browser, os, last_seen)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (user_id, device_id) 
        DO UPDATE SET device_name = $3, platform = $4, browser = $5, os = $6, last_seen = NOW()
      `, [userId, id, name, platform, browser, os]);

      res.json({
        ok: true,
        device: { id, name, platform, browser, os, lastSeen: Date.now() },
      });
    } catch (e) {
      console.error('[Sync] Error registering device:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  // Получить список устройств
  app.get('/api/sync/devices', authMiddleware, async (req, res) => {
    const userId = req.userId;

    try {
      const result = await pool.query(
        'SELECT * FROM user_devices WHERE user_id = $1 ORDER BY last_seen DESC',
        [userId]
      );

      const devices = result.rows.map(row => ({
        id: row.device_id,
        name: row.device_name,
        platform: row.platform,
        browser: row.browser,
        os: row.os,
        lastSeen: new Date(row.last_seen).getTime(),
      }));

      res.json({ ok: true, devices });
    } catch (e) {
      console.error('[Sync] Error listing devices:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  // ========== CONFLICTS ==========

  // Разрешить конфликт
  app.post('/api/sync/conflicts/resolve', authMiddleware, async (req, res) => {
    const userId = req.userId;

    try {
      const { conflictId, option, data } = req.body;

      if (!conflictId || !option) {
        return res.status(400).json({ ok: false, error: 'Missing required fields' });
      }

      // Получаем конфликт
      const conflictResult = await pool.query(
        'SELECT * FROM sync_conflicts WHERE id = $1 AND user_id = $2 AND resolved = false',
        [conflictId, userId]
      );

      if (conflictResult.rowCount === 0) {
        return res.status(404).json({ ok: false, error: 'Conflict not found or already resolved' });
      }

      const conflict = conflictResult.rows[0];

      // В зависимости от выбора обновляем облачное сохранение
      if (option === 'use_local' && data) {
        const sizeBytes = Buffer.byteLength(data, 'utf8');
        const checksum = crypto.createHash('sha256').update(data).digest('hex');

        await pool.query(`
          UPDATE cloud_saves 
          SET data = $3, checksum = $4, size_bytes = $5, updated_at = NOW()
          WHERE user_id = $1 AND slot_id = $2
        `, [userId, conflict.slot_id, data, checksum, sizeBytes]);
      } else if (option === 'merge' && data) {
        const sizeBytes = Buffer.byteLength(data, 'utf8');
        const checksum = crypto.createHash('sha256').update(data).digest('hex');

        await pool.query(`
          UPDATE cloud_saves 
          SET data = $3, checksum = $4, size_bytes = $5, updated_at = NOW()
          WHERE user_id = $1 AND slot_id = $2
        `, [userId, conflict.slot_id, data, checksum, sizeBytes]);
      }
      // use_cloud - ничего не делаем, облачное сохранение уже актуально
      // keep_both - создаём новый слот (TODO)

      // Помечаем конфликт как разрешённый
      await pool.query(`
        UPDATE sync_conflicts 
        SET resolved = true, resolved_at = NOW(), resolution = $3, resolved_by = 'user'
        WHERE id = $1 AND user_id = $2
      `, [conflictId, userId, option]);

      res.json({ ok: true });
    } catch (e) {
      console.error('[Sync] Error resolving conflict:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  // ========== STATUS ==========

  // Получить статус синхронизации
  app.get('/api/sync/status', authMiddleware, async (req, res) => {
    const userId = req.userId;

    try {
      // Последняя синхронизация
      const lastSyncResult = await pool.query(`
        SELECT created_at FROM sync_history 
        WHERE user_id = $1 AND status = 'success' 
        ORDER BY created_at DESC LIMIT 1
      `, [userId]);

      // Неразрешённые конфликты
      const conflictsResult = await pool.query(
        'SELECT COUNT(*) as count FROM sync_conflicts WHERE user_id = $1 AND resolved = false',
        [userId]
      );

      res.json({
        ok: true,
        lastSync: lastSyncResult.rowCount > 0 
          ? new Date(lastSyncResult.rows[0].created_at).getTime() 
          : null,
        hasConflicts: parseInt(conflictsResult.rows[0].count) > 0,
      });
    } catch (e) {
      console.error('[Sync] Error getting status:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  console.log('[Sync] Routes registered');
}

/**
 * Записать в историю синхронизации
 */
async function logSyncHistory(userId, slotId, deviceId, operation, status, durationMs, sizeBytes, errorMessage = null) {
  try {
    await pool.query(`
      INSERT INTO sync_history (user_id, slot_id, device_id, operation, status, duration_ms, size_bytes, error_message)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [userId, slotId, deviceId, operation, status, durationMs, sizeBytes, errorMessage]);
  } catch (e) {
    console.error('[Sync] Error logging history:', e);
  }
}

/**
 * Очистка истёкших бэкапов (вызывать периодически)
 */
export async function cleanupExpiredBackups() {
  try {
    const result = await pool.query('DELETE FROM save_backups WHERE expires_at < NOW()');
    if (result.rowCount > 0) {
      console.log(`[Sync] Cleaned up ${result.rowCount} expired backups`);
    }
  } catch (e) {
    console.error('[Sync] Error cleaning up backups:', e);
  }
}
