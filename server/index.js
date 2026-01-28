import express from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const { initDb, pool } = await import('./db.js');
import { createMarketRoutes, initMarketTables } from './market.js';
import { createGuildRoutes } from './guilds.js';
import { createSyncRoutes, initSyncTables, cleanupExpiredBackups } from './sync.js';
import { createAIRoutes } from './ai.js';
import { startAIOracle } from './ai-oracle.js';
import { createP2PLendingRoutes, initP2PLendingTables } from './p2p-lending.js';

const PORT = Number(process.env.PORT ?? 5174);
const HOST = process.env.HOST ?? '127.0.0.1';
const SAVE_ID = process.env.SAVE_ID ?? 'local';

const app = express();
app.use(express.json({ limit: '1mb' }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

// Утилита для генерации токена
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Утилита для создания сессии
async function createSession(userId, userAgent, ipAddress) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 дней
  
  await pool.query(
    'INSERT INTO sessions (user_id, token, expires_at, user_agent, ip_address) VALUES ($1, $2, $3, $4, $5)',
    [userId, token, expiresAt, userAgent, ipAddress]
  );
  
  return { token, expiresAt };
}

// Утилита для очистки истекших сессий
async function cleanExpiredSessions() {
  await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
}

// Middleware для проверки авторизации через токен
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ ok: false, error: 'NOT_AUTHENTICATED' });
    return;
  }
  
  const token = authHeader.substring(7);
  
  try {
    // Проверяем токен и получаем пользователя
    const result = await pool.query(
      'SELECT user_id FROM sessions WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    
    if (result.rowCount === 0) {
      res.status(401).json({ ok: false, error: 'INVALID_TOKEN' });
      return;
    }
    
    req.userId = result.rows[0].user_id;
    req.token = token;
    
    // Обновляем время последней активности
    await pool.query(
      'UPDATE sessions SET last_activity_at = NOW() WHERE token = $1',
      [token]
    );
    
    next();
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
};

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Регистрация
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      res.status(400).json({ ok: false, error: 'EMAIL_AND_PASSWORD_REQUIRED' });
      return;
    }

    // Проверяем, существует ли пользователь
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      res.status(409).json({ ok: false, error: 'USER_EXISTS' });
      return;
    }

    // Создаем пользователя (пароль храним как есть, без хеширования, как запросил пользователь)
    const result = await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, settings, current_save_id, pinned_resources',
      [email, password]
    );
    
    const user = result.rows[0];
    
    // Создаем слот по умолчанию для нового пользователя
    const slotResult = await pool.query(
      `INSERT INTO game_slots (user_id, name, description, last_played_at)
       VALUES ($1, 'Моя игра', 'Первая игра', NOW())
       RETURNING id`,
      [user.id]
    );
    const defaultSlotId = slotResult.rows[0].id;
    
    // Устанавливаем его как текущий
    await pool.query(
      'UPDATE users SET current_slot_id = $1 WHERE id = $2',
      [defaultSlotId, user.id]
    );
    
    // Создаем сессию
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.connection.remoteAddress;
    const { token, expiresAt } = await createSession(user.id, userAgent, ipAddress);

    res.json({ 
      ok: true, 
      user,
      token,
      expiresAt
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Вход
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      res.status(400).json({ ok: false, error: 'EMAIL_AND_PASSWORD_REQUIRED' });
      return;
    }

    const result = await pool.query(
      'SELECT id, email, settings, current_save_id, pinned_resources, current_slot_id FROM users WHERE email = $1 AND password = $2',
      [email, password]
    );
    
    if (result.rowCount === 0) {
      res.status(401).json({ ok: false, error: 'INVALID_CREDENTIALS' });
      return;
    }
    
    const user = result.rows[0];
    
    // Если у пользователя нет слота - создаем ему слот по умолчанию
    if (!user.current_slot_id) {
      // Проверяем есть ли у него вообще слоты
      const slotsResult = await pool.query(
        'SELECT id FROM game_slots WHERE user_id = $1 LIMIT 1',
        [user.id]
      );
      
      let slotId;
      if (slotsResult.rowCount === 0) {
        // Создаем слот по умолчанию
        const newSlotResult = await pool.query(
          `INSERT INTO game_slots (user_id, name, description, last_played_at)
           VALUES ($1, 'Моя игра', 'Первая игра', NOW())
           RETURNING id`,
          [user.id]
        );
        slotId = newSlotResult.rows[0].id;
        
        // Переносим существующие сохранения в новый слот
        await pool.query(
          'UPDATE game_save SET slot_id = $1 WHERE user_id = $2 AND slot_id IS NULL',
          [slotId, user.id]
        );
      } else {
        slotId = slotsResult.rows[0].id;
      }
      
      // Устанавливаем слот как текущий
      await pool.query(
        'UPDATE users SET current_slot_id = $1 WHERE id = $2',
        [slotId, user.id]
      );
      user.current_slot_id = slotId;
    }
    
    // Создаем сессию
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.connection.remoteAddress;
    const { token, expiresAt } = await createSession(user.id, userAgent, ipAddress);

    res.json({ 
      ok: true, 
      user,
      token,
      expiresAt
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Выход (удаление текущей сессии)
app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM sessions WHERE token = $1', [req.token]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Выход из всех сессий (удаление всех сессий пользователя)
app.post('/api/auth/logout-all', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [req.userId]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Получить информацию о текущей сессии
app.get('/api/auth/session', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT u.id, u.email, u.settings, u.current_save_id, u.pinned_resources, s.created_at, s.last_activity_at, s.expires_at FROM users u JOIN sessions s ON u.id = s.user_id WHERE s.token = $1',
      [req.token]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'SESSION_NOT_FOUND' });
      return;
    }
    
    res.json({ ok: true, user: result.rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// ========== SETTINGS API ==========

// Получить настройки пользователя
app.get('/api/settings', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT settings FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'USER_NOT_FOUND' });
      return;
    }
    
    res.json({ ok: true, settings: result.rows[0].settings || {} });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Обновить настройки пользователя
app.put('/api/settings', authMiddleware, async (req, res) => {
  try {
    const { settings } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      res.status(400).json({ ok: false, error: 'INVALID_SETTINGS_DATA' });
      return;
    }

    const result = await pool.query(
      'UPDATE users SET settings = $1::jsonb WHERE id = $2 RETURNING settings',
      [JSON.stringify(settings), req.userId]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'USER_NOT_FOUND' });
      return;
    }
    
    res.json({ ok: true, settings: result.rows[0].settings });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// ========== USER PREFERENCES API ==========

// Получить pinned resources
app.get('/api/preferences/pinned-resources', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT pinned_resources FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'USER_NOT_FOUND' });
      return;
    }
    
    res.json({ 
      ok: true, 
      pinnedResources: result.rows[0].pinned_resources || ['energy', 'ore', 'ice', 'carbon', 'steel', 'dark_matter']
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Обновить pinned resources
app.put('/api/preferences/pinned-resources', authMiddleware, async (req, res) => {
  try {
    const { pinnedResources } = req.body;
    
    if (!Array.isArray(pinnedResources)) {
      res.status(400).json({ ok: false, error: 'INVALID_PINNED_RESOURCES' });
      return;
    }

    const result = await pool.query(
      'UPDATE users SET pinned_resources = $1::jsonb WHERE id = $2 RETURNING pinned_resources',
      [JSON.stringify(pinnedResources), req.userId]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'USER_NOT_FOUND' });
      return;
    }
    
    res.json({ ok: true, pinnedResources: result.rows[0].pinned_resources });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Получить current save ID
app.get('/api/preferences/current-save', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT current_save_id FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'USER_NOT_FOUND' });
      return;
    }
    
    res.json({ ok: true, currentSaveId: result.rows[0].current_save_id });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Обновить current save ID
app.put('/api/preferences/current-save', authMiddleware, async (req, res) => {
  try {
    const { currentSaveId } = req.body;
    
    if (currentSaveId !== null && typeof currentSaveId !== 'number') {
      res.status(400).json({ ok: false, error: 'INVALID_SAVE_ID' });
      return;
    }

    // Проверяем, что сохранение существует и принадлежит пользователю
    if (currentSaveId !== null) {
      const saveCheck = await pool.query(
        'SELECT id FROM game_save WHERE id = $1 AND user_id = $2',
        [currentSaveId, req.userId]
      );
      
      if (saveCheck.rowCount === 0) {
        res.status(404).json({ ok: false, error: 'SAVE_NOT_FOUND' });
        return;
      }
    }

    const result = await pool.query(
      'UPDATE users SET current_save_id = $1 WHERE id = $2 RETURNING current_save_id',
      [currentSaveId, req.userId]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'USER_NOT_FOUND' });
      return;
    }
    
    res.json({ ok: true, currentSaveId: result.rows[0].current_save_id });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});


// ========== GAME SLOTS API ==========

// Получить список всех игровых слотов пользователя
app.get('/api/slots', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, created_at, updated_at, last_played_at, play_time_seconds
       FROM game_slots 
       WHERE user_id = $1 
       ORDER BY last_played_at DESC NULLS LAST, updated_at DESC`,
      [req.userId]
    );
    
    // Получаем текущий слот пользователя
    const userResult = await pool.query(
      'SELECT current_slot_id FROM users WHERE id = $1',
      [req.userId]
    );
    
    res.json({ 
      ok: true, 
      slots: result.rows,
      currentSlotId: userResult.rows[0]?.current_slot_id || null
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Получить конкретный игровой слот
app.get('/api/slots/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, created_at, updated_at, last_played_at, play_time_seconds
       FROM game_slots 
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'SLOT_NOT_FOUND' });
      return;
    }
    
    res.json({ ok: true, slot: result.rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Создать новый игровой слот
app.post('/api/slots', authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ ok: false, error: 'NAME_REQUIRED' });
      return;
    }
    
    const result = await pool.query(
      `INSERT INTO game_slots (user_id, name, description, last_played_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, name, description, created_at, updated_at, last_played_at, play_time_seconds`,
      [req.userId, name.trim(), description?.trim() || null]
    );
    
    const newSlot = result.rows[0];
    
    // Устанавливаем новый слот как текущий
    await pool.query(
      'UPDATE users SET current_slot_id = $1 WHERE id = $2',
      [newSlot.id, req.userId]
    );
    
    res.json({ ok: true, slot: newSlot });
  } catch (e) {
    if (e.code === '23505') {
      res.status(409).json({ ok: false, error: 'SLOT_NAME_EXISTS' });
    } else {
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  }
});

// Обновить игровой слот
app.put('/api/slots/:id', authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ ok: false, error: 'INVALID_NAME' });
        return;
      }
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description?.trim() || null);
    }
    
    if (updates.length === 0) {
      res.status(400).json({ ok: false, error: 'NO_UPDATES' });
      return;
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(req.params.id, req.userId);
    
    const result = await pool.query(
      `UPDATE game_slots 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING id, name, description, created_at, updated_at, last_played_at, play_time_seconds`,
      values
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'SLOT_NOT_FOUND' });
      return;
    }
    
    res.json({ ok: true, slot: result.rows[0] });
  } catch (e) {
    if (e.code === '23505') {
      res.status(409).json({ ok: false, error: 'SLOT_NAME_EXISTS' });
    } else {
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  }
});

// Удалить игровой слот
app.delete('/api/slots/:id', authMiddleware, async (req, res) => {
  try {
    // Проверяем, что это не текущий активный слот, или сбрасываем его
    const userResult = await pool.query(
      'SELECT current_slot_id FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (userResult.rows[0]?.current_slot_id === parseInt(req.params.id)) {
      // Сбрасываем текущий слот
      await pool.query(
        'UPDATE users SET current_slot_id = NULL WHERE id = $1',
        [req.userId]
      );
    }
    
    const result = await pool.query(
      'DELETE FROM game_slots WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'SLOT_NOT_FOUND' });
      return;
    }
    
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Переключиться на игровой слот
app.post('/api/slots/:id/switch', authMiddleware, async (req, res) => {
  try {
    // Проверяем, что слот существует
    const slotResult = await pool.query(
      'SELECT id, name FROM game_slots WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    
    if (slotResult.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'SLOT_NOT_FOUND' });
      return;
    }
    
    // Обновляем текущий слот пользователя и время последней игры
    await pool.query(
      'UPDATE users SET current_slot_id = $1 WHERE id = $2',
      [req.params.id, req.userId]
    );
    
    await pool.query(
      'UPDATE game_slots SET last_played_at = NOW() WHERE id = $1',
      [req.params.id]
    );
    
    // Получаем последнее сохранение для этого слота
    const saveResult = await pool.query(
      `SELECT id, name, save_type, data, created_at, updated_at
       FROM game_save 
       WHERE slot_id = $1 
       ORDER BY updated_at DESC 
       LIMIT 1`,
      [req.params.id]
    );
    
    res.json({ 
      ok: true, 
      slot: slotResult.rows[0],
      latestSave: saveResult.rows[0] || null
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Получить текущий слот пользователя
app.get('/api/slots/current', authMiddleware, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT current_slot_id FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (!userResult.rows[0]?.current_slot_id) {
      res.json({ ok: true, slot: null, latestSave: null });
      return;
    }
    
    const slotId = userResult.rows[0].current_slot_id;
    
    const slotResult = await pool.query(
      `SELECT id, name, description, created_at, updated_at, last_played_at, play_time_seconds
       FROM game_slots WHERE id = $1`,
      [slotId]
    );
    
    if (slotResult.rowCount === 0) {
      res.json({ ok: true, slot: null, latestSave: null });
      return;
    }
    
    // Получаем последнее сохранение для этого слота
    const saveResult = await pool.query(
      `SELECT id, name, save_type, data, created_at, updated_at
       FROM game_save 
       WHERE slot_id = $1 
       ORDER BY updated_at DESC 
       LIMIT 1`,
      [slotId]
    );
    
    res.json({ 
      ok: true, 
      slot: slotResult.rows[0],
      latestSave: saveResult.rows[0] || null
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});


// ========== SAVES API ==========

// Получить список всех сохранений для текущего слота
app.get('/api/saves', authMiddleware, async (req, res) => {
  try {
    // Получаем текущий слот
    const userResult = await pool.query(
      'SELECT current_slot_id FROM users WHERE id = $1',
      [req.userId]
    );
    
    const slotId = userResult.rows[0]?.current_slot_id;
    
    let result;
    if (slotId) {
      result = await pool.query(
        `SELECT id, name, save_type, slot_id, created_at, updated_at 
         FROM game_save 
         WHERE slot_id = $1 
         ORDER BY updated_at DESC`,
        [slotId]
      );
    } else {
      // Для обратной совместимости - сохранения без слота
      result = await pool.query(
        `SELECT id, name, save_type, slot_id, created_at, updated_at 
         FROM game_save 
         WHERE user_id = $1 AND slot_id IS NULL
         ORDER BY updated_at DESC`,
        [req.userId]
      );
    }
    
    res.json({ ok: true, saves: result.rows, slotId });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Получить конкретное сохранение
app.get('/api/saves/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, save_type, slot_id, data, created_at, updated_at FROM game_save WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'SAVE_NOT_FOUND' });
      return;
    }
    
    res.json({ ok: true, save: result.rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Создать или обновить сохранение
app.put('/api/saves', authMiddleware, async (req, res) => {
  try {
    const { name, saveType, data, saveId } = req.body;
    
    if (!data || typeof data !== 'object') {
      res.status(400).json({ ok: false, error: 'INVALID_SAVE_DATA' });
      return;
    }

    const type = saveType || 'manual';
    
    if (!['manual', 'auto'].includes(type)) {
      res.status(400).json({ ok: false, error: 'INVALID_SAVE_TYPE' });
      return;
    }
    
    // Получаем текущий слот пользователя
    const userResult = await pool.query(
      'SELECT current_slot_id FROM users WHERE id = $1',
      [req.userId]
    );
    
    const slotId = userResult.rows[0]?.current_slot_id;

    let saveName = name;
    
    // Для автосохранений генерируем имя с датой
    if (type === 'auto') {
      saveName = `Автосохранение ${new Date().toLocaleString('ru-RU')}`;
    } else if (!saveName) {
      res.status(400).json({ ok: false, error: 'NAME_REQUIRED_FOR_MANUAL_SAVE' });
      return;
    }

    let result;
    
    // Если передан saveId - обновляем существующее сохранение
    if (saveId) {
      result = await pool.query(
        `UPDATE game_save 
         SET data = $1::jsonb, updated_at = NOW()
         WHERE id = $2 AND user_id = $3
         RETURNING id, name, save_type, slot_id, created_at, updated_at`,
        [JSON.stringify(data), saveId, req.userId]
      );
      
      if (result.rowCount === 0) {
        res.status(404).json({ ok: false, error: 'SAVE_NOT_FOUND' });
        return;
      }
    } else {
      // Создаем новое сохранение с привязкой к слоту
      result = await pool.query(
        `INSERT INTO game_save (user_id, slot_id, name, save_type, data)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         RETURNING id, name, save_type, slot_id, created_at, updated_at`,
        [req.userId, slotId, saveName, type, JSON.stringify(data)]
      );
    }
    
    // Обновляем время последней игры в слоте
    if (slotId) {
      await pool.query(
        'UPDATE game_slots SET last_played_at = NOW(), updated_at = NOW() WHERE id = $1',
        [slotId]
      );
    }

    // Для автосохранений - удаляем старые, оставляем только 3 последних
    if (type === 'auto' && slotId) {
      await pool.query(
        `DELETE FROM game_save
         WHERE slot_id = $1 
         AND save_type = 'auto'
         AND id NOT IN (
           SELECT id FROM game_save
           WHERE slot_id = $1 AND save_type = 'auto'
           ORDER BY created_at DESC
           LIMIT 3
         )`,
        [slotId]
      );
    }

    res.json({ ok: true, save: result.rows[0] });
  } catch (e) {
    // Проверяем на дубликат имени
    if (e.code === '23505') {
      res.status(409).json({ ok: false, error: 'SAVE_NAME_EXISTS' });
    } else {
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  }
});

// Удалить сохранение
app.delete('/api/saves/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM game_save WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'SAVE_NOT_FOUND' });
      return;
    }
    
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Получить последнее сохранение для текущего слота (для автозагрузки)
app.get('/api/saves/latest/manual', authMiddleware, async (req, res) => {
  try {
    // Получаем текущий слот пользователя
    const userResult = await pool.query(
      'SELECT current_slot_id FROM users WHERE id = $1',
      [req.userId]
    );
    
    const slotId = userResult.rows[0]?.current_slot_id;
    
    // Если нет текущего слота - нет сохранений
    if (!slotId) {
      res.status(404).json({ ok: false, error: 'NO_CURRENT_SLOT' });
      return;
    }
    
    // Загружаем последнее сохранение для текущего слота
    const result = await pool.query(
      `SELECT id, name, save_type, slot_id, data, created_at, updated_at 
       FROM game_save 
       WHERE slot_id = $1
       ORDER BY updated_at DESC 
       LIMIT 1`,
      [slotId]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'NO_SAVES_FOR_SLOT' });
      return;
    }
    
    res.json({ ok: true, save: result.rows[0], slotId });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

await initDb();

// Инициализация таблиц для торговой биржи и гильдий
await initMarketTables(pool);

// Инициализация таблиц для синхронизации
await initSyncTables();

// Инициализация таблиц для P2P кредитования
await initP2PLendingTables(pool);

// Регистрация маршрутов для торговой биржи и гильдий
createMarketRoutes(app, pool, authMiddleware);
createGuildRoutes(app, pool, authMiddleware);

// Регистрация маршрутов для синхронизации
createSyncRoutes(app, authMiddleware);

// Регистрация маршрутов для AI
createAIRoutes(app, pool, authMiddleware);

// Запуск AI Oracle (периодическое обновление раз в час)
startAIOracle(pool);

// Регистрация маршрутов для P2P кредитования
createP2PLendingRoutes(app, pool, authMiddleware);

// Периодическая очистка истёкших бэкапов (каждый час)
setInterval(cleanupExpiredBackups, 60 * 60 * 1000);

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://${HOST}:${PORT}`);
});
