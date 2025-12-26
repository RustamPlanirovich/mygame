import express from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const { initDb, pool } = await import('./db.js');

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
      'SELECT id, email, settings, current_save_id, pinned_resources FROM users WHERE email = $1 AND password = $2',
      [email, password]
    );
    
    if (result.rowCount === 0) {
      res.status(401).json({ ok: false, error: 'INVALID_CREDENTIALS' });
      return;
    }
    
    const user = result.rows[0];
    
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


// ========== SAVES API ==========

// Получить список всех сохранений пользователя
app.get('/api/saves', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, save_type, created_at, updated_at 
       FROM game_save 
       WHERE user_id = $1 
       ORDER BY updated_at DESC`,
      [req.userId]
    );
    res.json({ ok: true, saves: result.rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Получить конкретное сохранение
app.get('/api/saves/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, save_type, data, created_at, updated_at FROM game_save WHERE id = $1 AND user_id = $2',
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
         RETURNING id, name, save_type, created_at, updated_at`,
        [JSON.stringify(data), saveId, req.userId]
      );
      
      if (result.rowCount === 0) {
        res.status(404).json({ ok: false, error: 'SAVE_NOT_FOUND' });
        return;
      }
    } else {
      // Создаем новое сохранение
      result = await pool.query(
        `INSERT INTO game_save (user_id, name, save_type, data)
         VALUES ($1, $2, $3, $4::jsonb)
         RETURNING id, name, save_type, created_at, updated_at`,
        [req.userId, saveName, type, JSON.stringify(data)]
      );
    }

    // Для автосохранений - удаляем старые, оставляем только 3 последних
    if (type === 'auto') {
      await pool.query(
        `DELETE FROM game_save
         WHERE user_id = $1 
         AND save_type = 'auto'
         AND id NOT IN (
           SELECT id FROM game_save
           WHERE user_id = $1 AND save_type = 'auto'
           ORDER BY created_at DESC
           LIMIT 3
         )`,
        [req.userId]
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

// Получить последнее ручное сохранение (для автозагрузки)
app.get('/api/saves/latest/manual', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, save_type, data, created_at, updated_at 
       FROM game_save 
       WHERE user_id = $1 AND save_type = 'manual'
       ORDER BY updated_at DESC 
       LIMIT 1`,
      [req.userId]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'NO_MANUAL_SAVE' });
      return;
    }
    
    res.json({ ok: true, save: result.rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

await initDb();
app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://${HOST}:${PORT}`);
});
