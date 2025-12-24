import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

const { initDb, pool } = await import('./db.js');

const PORT = Number(process.env.PORT ?? 5174);
const HOST = process.env.HOST ?? '127.0.0.1';
const SAVE_ID = process.env.SAVE_ID ?? 'local';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

app.get('/api/save', async (_req, res) => {
  const row = await pool.query('SELECT data FROM game_save WHERE id = $1', [SAVE_ID]);
  if (row.rowCount === 0) {
    res.status(404).json({ ok: false, error: 'NO_SAVE' });
    return;
  }
  res.json({ ok: true, data: row.rows[0].data });
});

app.put('/api/save', async (req, res) => {
  const data = req.body;
  if (!data || typeof data !== 'object') {
    res.status(400).json({ ok: false, error: 'INVALID_SAVE' });
    return;
  }

  await pool.query(
    `
    INSERT INTO game_save (id, data, updated_at)
    VALUES ($1, $2::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
    `,
    [SAVE_ID, JSON.stringify(data)]
  );

  res.json({ ok: true });
});

app.delete('/api/save', async (_req, res) => {
  await pool.query('DELETE FROM game_save WHERE id = $1', [SAVE_ID]);
  res.json({ ok: true });
});

await initDb();
app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://${HOST}:${PORT}`);
});
