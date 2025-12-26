import express from 'express';
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
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-user-id');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

// Middleware для проверки авторизации
const authMiddleware = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    res.status(401).json({ ok: false, error: 'NOT_AUTHENTICATED' });
    return;
  }
  req.userId = userId;
  next();
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
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email',
      [email, password]
    );

    res.json({ ok: true, user: result.rows[0] });
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

    const result = await pool.query('SELECT id, email FROM users WHERE email = $1 AND password = $2', [email, password]);
    
    if (result.rowCount === 0) {
      res.status(401).json({ ok: false, error: 'INVALID_CREDENTIALS' });
      return;
    }

    res.json({ ok: true, user: result.rows[0] });
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
