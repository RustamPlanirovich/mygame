/**
 * Модуль торговых гильдий
 * Фаза 1: Мультиплеерная торговля
 */

// Константы гильдий
const GUILD_CONSTANTS = {
  CREATE_COST: 10_000,
  MIN_NAME_LENGTH: 3,
  MAX_NAME_LENGTH: 24,
  MIN_TAG_LENGTH: 2,
  MAX_TAG_LENGTH: 4,
  BASE_MAX_MEMBERS: 10,
  MAX_LEVEL: 10,
  CHAT_MESSAGE_LIMIT: 100,  // Последние 100 сообщений
};

/**
 * Получение максимального количества членов по уровню
 */
function getMaxGuildMembers(level) {
  return GUILD_CONSTANTS.BASE_MAX_MEMBERS + (level - 1) * 5;
}

/**
 * Получение опыта для следующего уровня
 */
function getGuildLevelExperience(level) {
  return 1000 * Math.pow(2, level - 1);
}

/**
 * Получение бонусов гильдии по уровню
 */
function getGuildBonuses(level) {
  const bonuses = [];
  if (level >= 1) bonuses.push('trade_fee_reduction');
  if (level >= 3) bonuses.push('priority_orders');
  if (level >= 5) bonuses.push('bulk_discount');
  if (level >= 7) bonuses.push('extended_order_time');
  return bonuses;
}

/**
 * Создание роутов для гильдий
 */
export function createGuildRoutes(app, pool, authMiddleware) {
  
  // ==========================================
  // ГИЛЬДИИ
  // ==========================================

  /**
   * GET /api/guilds - Список гильдий
   */
  app.get('/api/guilds', async (req, res) => {
    try {
      const { limit = 50, offset = 0, search } = req.query;
      
      let query = `
        SELECT 
          g.*,
          COUNT(gm.player_id) as member_count,
          u.email as leader_name
        FROM guilds g
        LEFT JOIN guild_members gm ON g.id = gm.guild_id
        LEFT JOIN users u ON g.leader_id = u.id
      `;
      
      const params = [];
      let paramIndex = 1;
      
      if (search) {
        query += ` WHERE g.name ILIKE $${paramIndex} OR g.tag ILIKE $${paramIndex}`;
        params.push(`%${search}%`);
        paramIndex++;
      }
      
      query += ` GROUP BY g.id, u.email`;
      query += ` ORDER BY g.level DESC, member_count DESC`;
      query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(parseInt(limit), parseInt(offset));
      
      const result = await pool.query(query, params);
      
      const countQuery = search 
        ? `SELECT COUNT(*) FROM guilds WHERE name ILIKE $1 OR tag ILIKE $1`
        : 'SELECT COUNT(*) FROM guilds';
      const countParams = search ? [`%${search}%`] : [];
      const countResult = await pool.query(countQuery, countParams);
      
      res.json({
        ok: true,
        guilds: result.rows.map(row => ({
          id: row.id,
          name: row.name,
          tag: row.tag,
          leaderId: row.leader_id.toString(),
          leaderName: row.leader_name,
          level: row.level,
          experience: row.experience.toString(),
          treasury: row.treasury.toString(),
          maxMembers: row.max_members,
          memberCount: parseInt(row.member_count),
          bonuses: getGuildBonuses(row.level),
          createdAt: new Date(row.created_at).getTime()
        })),
        total: parseInt(countResult.rows[0].count)
      });
    } catch (e) {
      console.error('Error fetching guilds:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  /**
   * GET /api/guilds/my - Моя гильдия
   * ВАЖНО: Этот маршрут должен быть ДО /api/guilds/:id
   */
  app.get('/api/guilds/my', authMiddleware, async (req, res) => {
    try {
      const playerId = req.userId;
      
      const result = await pool.query(`
        SELECT 
          g.*,
          gm.role as my_role,
          gm.contribution as my_contribution,
          u.email as leader_name,
          (SELECT COUNT(*) FROM guild_members WHERE guild_id = g.id) as member_count
        FROM guild_members gm
        JOIN guilds g ON gm.guild_id = g.id
        LEFT JOIN users u ON g.leader_id = u.id
        WHERE gm.player_id = $1
      `, [playerId]);
      
      if (result.rowCount === 0) {
        res.json({ ok: true, guild: null });
        return;
      }
      
      const row = result.rows[0];
      
      res.json({
        ok: true,
        guild: {
          id: row.id,
          name: row.name,
          tag: row.tag,
          leaderId: row.leader_id.toString(),
          leaderName: row.leader_name,
          level: row.level,
          experience: row.experience.toString(),
          experienceForNextLevel: getGuildLevelExperience(row.level).toString(),
          treasury: row.treasury.toString(),
          maxMembers: row.max_members,
          memberCount: parseInt(row.member_count),
          bonuses: getGuildBonuses(row.level),
          createdAt: new Date(row.created_at).getTime(),
          myRole: row.my_role,
          myContribution: row.my_contribution.toString()
        }
      });
    } catch (e) {
      console.error('Error fetching my guild:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  /**
   * GET /api/guilds/:id - Информация о гильдии
   */
  app.get('/api/guilds/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      const guildResult = await pool.query(`
        SELECT 
          g.*,
          u.email as leader_name
        FROM guilds g
        LEFT JOIN users u ON g.leader_id = u.id
        WHERE g.id = $1
      `, [id]);
      
      if (guildResult.rowCount === 0) {
        res.status(404).json({ ok: false, error: 'GUILD_NOT_FOUND' });
        return;
      }
      
      const guild = guildResult.rows[0];
      
      // Получаем членов гильдии
      const membersResult = await pool.query(`
        SELECT 
          gm.*,
          u.email as player_name,
          t.total_volume,
          t.rating
        FROM guild_members gm
        JOIN users u ON gm.player_id = u.id
        LEFT JOIN traders t ON gm.player_id = t.player_id
        WHERE gm.guild_id = $1
        ORDER BY gm.role = 'leader' DESC, gm.role = 'officer' DESC, gm.contribution DESC
      `, [id]);
      
      res.json({
        ok: true,
        guild: {
          id: guild.id,
          name: guild.name,
          tag: guild.tag,
          leaderId: guild.leader_id.toString(),
          leaderName: guild.leader_name,
          level: guild.level,
          experience: guild.experience.toString(),
          experienceForNextLevel: getGuildLevelExperience(guild.level).toString(),
          treasury: guild.treasury.toString(),
          maxMembers: guild.max_members,
          bonuses: getGuildBonuses(guild.level),
          createdAt: new Date(guild.created_at).getTime(),
          members: membersResult.rows.map(m => ({
            playerId: m.player_id.toString(),
            playerName: m.player_name,
            role: m.role,
            contribution: m.contribution.toString(),
            joinedAt: new Date(m.joined_at).getTime(),
            totalVolume: (m.total_volume || '0').toString(),
            rating: parseFloat(m.rating || 5)
          }))
        }
      });
    } catch (e) {
      console.error('Error fetching guild:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  /**
   * POST /api/guilds - Создать гильдию
   */
  app.post('/api/guilds', authMiddleware, async (req, res) => {
    const client = await pool.connect();
    
    try {
      const { name, tag } = req.body;
      const playerId = req.userId;
      
      // Валидация имени
      if (!name || name.length < GUILD_CONSTANTS.MIN_NAME_LENGTH || name.length > GUILD_CONSTANTS.MAX_NAME_LENGTH) {
        res.status(400).json({ ok: false, error: 'INVALID_GUILD_NAME' });
        return;
      }
      
      // Валидация тега
      if (!tag || tag.length < GUILD_CONSTANTS.MIN_TAG_LENGTH || tag.length > GUILD_CONSTANTS.MAX_TAG_LENGTH) {
        res.status(400).json({ ok: false, error: 'INVALID_GUILD_TAG' });
        return;
      }
      
      // Проверка, что тег содержит только буквы и цифры
      if (!/^[A-Za-z0-9]+$/.test(tag)) {
        res.status(400).json({ ok: false, error: 'INVALID_GUILD_TAG_CHARS' });
        return;
      }
      
      await client.query('BEGIN');
      
      // Проверяем, не состоит ли игрок уже в гильдии
      const existingMemberResult = await client.query(
        'SELECT guild_id FROM guild_members WHERE player_id = $1',
        [playerId]
      );
      
      if (existingMemberResult.rowCount > 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ ok: false, error: 'ALREADY_IN_GUILD' });
        return;
      }
      
      // Проверяем уникальность имени и тега
      const existingGuildResult = await client.query(
        'SELECT id FROM guilds WHERE LOWER(name) = LOWER($1) OR LOWER(tag) = LOWER($2)',
        [name, tag]
      );
      
      if (existingGuildResult.rowCount > 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ ok: false, error: 'GUILD_NAME_OR_TAG_EXISTS' });
        return;
      }
      
      // Создаём гильдию
      const guildResult = await client.query(`
        INSERT INTO guilds (name, tag, leader_id, max_members)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [name, tag.toUpperCase(), playerId, GUILD_CONSTANTS.BASE_MAX_MEMBERS]);
      
      const guild = guildResult.rows[0];
      
      // Добавляем лидера в члены гильдии
      await client.query(`
        INSERT INTO guild_members (guild_id, player_id, role)
        VALUES ($1, $2, 'leader')
      `, [guild.id, playerId]);
      
      // Обновляем трейдера
      await client.query(`
        INSERT INTO traders (player_id, player_name, guild_id)
        VALUES ($1, (SELECT email FROM users WHERE id = $1), $2)
        ON CONFLICT (player_id) DO UPDATE SET guild_id = $2
      `, [playerId, guild.id]);
      
      await client.query('COMMIT');
      
      res.json({
        ok: true,
        guild: {
          id: guild.id,
          name: guild.name,
          tag: guild.tag,
          leaderId: guild.leader_id.toString(),
          level: guild.level,
          experience: guild.experience.toString(),
          treasury: guild.treasury.toString(),
          maxMembers: guild.max_members,
          bonuses: getGuildBonuses(guild.level),
          createdAt: new Date(guild.created_at).getTime()
        }
      });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Error creating guild:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    } finally {
      client.release();
    }
  });

  /**
   * POST /api/guilds/:id/join - Вступить в гильдию
   */
  app.post('/api/guilds/:id/join', authMiddleware, async (req, res) => {
    const client = await pool.connect();
    
    try {
      const { id } = req.params;
      const playerId = req.userId;
      
      await client.query('BEGIN');
      
      // Проверяем, не состоит ли игрок уже в гильдии
      const existingMemberResult = await client.query(
        'SELECT guild_id FROM guild_members WHERE player_id = $1',
        [playerId]
      );
      
      if (existingMemberResult.rowCount > 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ ok: false, error: 'ALREADY_IN_GUILD' });
        return;
      }
      
      // Получаем информацию о гильдии
      const guildResult = await client.query(
        'SELECT * FROM guilds WHERE id = $1',
        [id]
      );
      
      if (guildResult.rowCount === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({ ok: false, error: 'GUILD_NOT_FOUND' });
        return;
      }
      
      const guild = guildResult.rows[0];
      
      // Проверяем количество членов
      const memberCountResult = await client.query(
        'SELECT COUNT(*) FROM guild_members WHERE guild_id = $1',
        [id]
      );
      
      if (parseInt(memberCountResult.rows[0].count) >= guild.max_members) {
        await client.query('ROLLBACK');
        res.status(400).json({ ok: false, error: 'GUILD_FULL' });
        return;
      }
      
      // Добавляем игрока в гильдию
      await client.query(`
        INSERT INTO guild_members (guild_id, player_id, role)
        VALUES ($1, $2, 'member')
      `, [id, playerId]);
      
      // Обновляем трейдера
      await client.query(`
        INSERT INTO traders (player_id, player_name, guild_id)
        VALUES ($1, (SELECT email FROM users WHERE id = $1), $2)
        ON CONFLICT (player_id) DO UPDATE SET guild_id = $2
      `, [playerId, id]);
      
      await client.query('COMMIT');
      
      res.json({ ok: true, message: 'JOINED_GUILD' });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Error joining guild:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    } finally {
      client.release();
    }
  });

  /**
   * POST /api/guilds/:id/leave - Покинуть гильдию
   */
  app.post('/api/guilds/:id/leave', authMiddleware, async (req, res) => {
    const client = await pool.connect();
    
    try {
      const { id } = req.params;
      const playerId = req.userId;
      
      await client.query('BEGIN');
      
      // Проверяем членство
      const memberResult = await client.query(
        'SELECT role FROM guild_members WHERE guild_id = $1 AND player_id = $2',
        [id, playerId]
      );
      
      if (memberResult.rowCount === 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ ok: false, error: 'NOT_IN_GUILD' });
        return;
      }
      
      // Лидер не может покинуть гильдию, только передать или распустить
      if (memberResult.rows[0].role === 'leader') {
        // Проверяем, есть ли другие члены
        const otherMembersResult = await client.query(
          'SELECT COUNT(*) FROM guild_members WHERE guild_id = $1 AND player_id != $2',
          [id, playerId]
        );
        
        if (parseInt(otherMembersResult.rows[0].count) > 0) {
          await client.query('ROLLBACK');
          res.status(400).json({ ok: false, error: 'LEADER_CANNOT_LEAVE' });
          return;
        }
        
        // Если лидер единственный член - распускаем гильдию
        await client.query('DELETE FROM guilds WHERE id = $1', [id]);
      } else {
        // Удаляем из членов
        await client.query(
          'DELETE FROM guild_members WHERE guild_id = $1 AND player_id = $2',
          [id, playerId]
        );
      }
      
      // Обновляем трейдера
      await client.query(
        'UPDATE traders SET guild_id = NULL WHERE player_id = $1',
        [playerId]
      );
      
      await client.query('COMMIT');
      
      res.json({ ok: true, message: 'LEFT_GUILD' });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Error leaving guild:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    } finally {
      client.release();
    }
  });

  /**
   * POST /api/guilds/:id/promote - Повысить участника
   */
  app.post('/api/guilds/:id/promote', authMiddleware, async (req, res) => {
    const client = await pool.connect();
    
    try {
      const { id } = req.params;
      const { targetPlayerId } = req.body;
      const playerId = req.userId;
      
      await client.query('BEGIN');
      
      // Проверяем, что запрашивающий - лидер или офицер
      const requesterResult = await client.query(
        'SELECT role FROM guild_members WHERE guild_id = $1 AND player_id = $2',
        [id, playerId]
      );
      
      if (requesterResult.rowCount === 0 || !['leader', 'officer'].includes(requesterResult.rows[0].role)) {
        await client.query('ROLLBACK');
        res.status(403).json({ ok: false, error: 'INSUFFICIENT_PERMISSIONS' });
        return;
      }
      
      // Получаем текущую роль цели
      const targetResult = await client.query(
        'SELECT role FROM guild_members WHERE guild_id = $1 AND player_id = $2',
        [id, targetPlayerId]
      );
      
      if (targetResult.rowCount === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({ ok: false, error: 'MEMBER_NOT_FOUND' });
        return;
      }
      
      const currentRole = targetResult.rows[0].role;
      let newRole;
      
      if (currentRole === 'member') {
        newRole = 'officer';
      } else if (currentRole === 'officer' && requesterResult.rows[0].role === 'leader') {
        // Передача лидерства
        newRole = 'leader';
        await client.query(
          'UPDATE guild_members SET role = $1 WHERE guild_id = $2 AND player_id = $3',
          ['officer', id, playerId]
        );
        await client.query(
          'UPDATE guilds SET leader_id = $1 WHERE id = $2',
          [targetPlayerId, id]
        );
      } else {
        await client.query('ROLLBACK');
        res.status(400).json({ ok: false, error: 'CANNOT_PROMOTE' });
        return;
      }
      
      await client.query(
        'UPDATE guild_members SET role = $1 WHERE guild_id = $2 AND player_id = $3',
        [newRole, id, targetPlayerId]
      );
      
      await client.query('COMMIT');
      
      res.json({ ok: true, newRole });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Error promoting member:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    } finally {
      client.release();
    }
  });

  /**
   * POST /api/guilds/:id/demote - Понизить участника
   */
  app.post('/api/guilds/:id/demote', authMiddleware, async (req, res) => {
    const client = await pool.connect();
    
    try {
      const { id } = req.params;
      const { targetPlayerId } = req.body;
      const playerId = req.userId;
      
      await client.query('BEGIN');
      
      // Проверяем, что запрашивающий - лидер
      const requesterResult = await client.query(
        'SELECT role FROM guild_members WHERE guild_id = $1 AND player_id = $2',
        [id, playerId]
      );
      
      if (requesterResult.rowCount === 0 || requesterResult.rows[0].role !== 'leader') {
        await client.query('ROLLBACK');
        res.status(403).json({ ok: false, error: 'INSUFFICIENT_PERMISSIONS' });
        return;
      }
      
      // Получаем текущую роль цели
      const targetResult = await client.query(
        'SELECT role FROM guild_members WHERE guild_id = $1 AND player_id = $2',
        [id, targetPlayerId]
      );
      
      if (targetResult.rowCount === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({ ok: false, error: 'MEMBER_NOT_FOUND' });
        return;
      }
      
      if (targetResult.rows[0].role !== 'officer') {
        await client.query('ROLLBACK');
        res.status(400).json({ ok: false, error: 'CANNOT_DEMOTE' });
        return;
      }
      
      await client.query(
        'UPDATE guild_members SET role = $1 WHERE guild_id = $2 AND player_id = $3',
        ['member', id, targetPlayerId]
      );
      
      await client.query('COMMIT');
      
      res.json({ ok: true, newRole: 'member' });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Error demoting member:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    } finally {
      client.release();
    }
  });

  /**
   * POST /api/guilds/:id/kick - Исключить участника
   */
  app.post('/api/guilds/:id/kick', authMiddleware, async (req, res) => {
    const client = await pool.connect();
    
    try {
      const { id } = req.params;
      const { targetPlayerId } = req.body;
      const playerId = req.userId;
      
      await client.query('BEGIN');
      
      // Проверяем, что запрашивающий - лидер или офицер
      const requesterResult = await client.query(
        'SELECT role FROM guild_members WHERE guild_id = $1 AND player_id = $2',
        [id, playerId]
      );
      
      if (requesterResult.rowCount === 0 || !['leader', 'officer'].includes(requesterResult.rows[0].role)) {
        await client.query('ROLLBACK');
        res.status(403).json({ ok: false, error: 'INSUFFICIENT_PERMISSIONS' });
        return;
      }
      
      // Получаем роль цели
      const targetResult = await client.query(
        'SELECT role FROM guild_members WHERE guild_id = $1 AND player_id = $2',
        [id, targetPlayerId]
      );
      
      if (targetResult.rowCount === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({ ok: false, error: 'MEMBER_NOT_FOUND' });
        return;
      }
      
      // Офицер не может исключить офицера или лидера
      if (requesterResult.rows[0].role === 'officer' && targetResult.rows[0].role !== 'member') {
        await client.query('ROLLBACK');
        res.status(403).json({ ok: false, error: 'CANNOT_KICK_OFFICER' });
        return;
      }
      
      // Лидера нельзя исключить
      if (targetResult.rows[0].role === 'leader') {
        await client.query('ROLLBACK');
        res.status(400).json({ ok: false, error: 'CANNOT_KICK_LEADER' });
        return;
      }
      
      // Удаляем участника
      await client.query(
        'DELETE FROM guild_members WHERE guild_id = $1 AND player_id = $2',
        [id, targetPlayerId]
      );
      
      // Обновляем трейдера
      await client.query(
        'UPDATE traders SET guild_id = NULL WHERE player_id = $1',
        [targetPlayerId]
      );
      
      await client.query('COMMIT');
      
      res.json({ ok: true, message: 'MEMBER_KICKED' });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Error kicking member:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    } finally {
      client.release();
    }
  });

  /**
   * POST /api/guilds/:id/treasury/deposit - Внести в казну
   */
  app.post('/api/guilds/:id/treasury/deposit', authMiddleware, async (req, res) => {
    const client = await pool.connect();
    
    try {
      const { id } = req.params;
      const { amount } = req.body;
      const playerId = req.userId;
      
      const depositAmount = parseFloat(amount);
      if (isNaN(depositAmount) || depositAmount <= 0) {
        res.status(400).json({ ok: false, error: 'INVALID_AMOUNT' });
        return;
      }
      
      await client.query('BEGIN');
      
      // Проверяем членство
      const memberResult = await client.query(
        'SELECT * FROM guild_members WHERE guild_id = $1 AND player_id = $2',
        [id, playerId]
      );
      
      if (memberResult.rowCount === 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ ok: false, error: 'NOT_IN_GUILD' });
        return;
      }
      
      // Обновляем казну и вклад
      await client.query(
        'UPDATE guilds SET treasury = treasury + $1 WHERE id = $2',
        [depositAmount, id]
      );
      
      await client.query(
        'UPDATE guild_members SET contribution = contribution + $1 WHERE guild_id = $2 AND player_id = $3',
        [depositAmount, id, playerId]
      );
      
      // Добавляем опыт гильдии (1 опыт за каждые 100 кредитов)
      const experienceGain = Math.floor(depositAmount / 100);
      if (experienceGain > 0) {
        await client.query(
          'UPDATE guilds SET experience = experience + $1 WHERE id = $2',
          [experienceGain, id]
        );
        
        // Проверяем повышение уровня
        const guildResult = await client.query('SELECT level, experience FROM guilds WHERE id = $1', [id]);
        const guild = guildResult.rows[0];
        const expNeeded = getGuildLevelExperience(guild.level);
        
        if (parseFloat(guild.experience) >= expNeeded && guild.level < GUILD_CONSTANTS.MAX_LEVEL) {
          await client.query(
            'UPDATE guilds SET level = level + 1, max_members = $1 WHERE id = $2',
            [getMaxGuildMembers(guild.level + 1), id]
          );
        }
      }
      
      await client.query('COMMIT');
      
      res.json({ ok: true, message: 'DEPOSIT_SUCCESS' });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Error depositing to treasury:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    } finally {
      client.release();
    }
  });

  // ==========================================
  // ЧАТ ГИЛЬДИИ
  // ==========================================

  /**
   * GET /api/guilds/:id/chat - Получить сообщения чата
   */
  app.get('/api/guilds/:id/chat', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const playerId = req.userId;
      
      // Проверяем членство
      const memberResult = await pool.query(
        'SELECT * FROM guild_members WHERE guild_id = $1 AND player_id = $2',
        [id, playerId]
      );
      
      if (memberResult.rowCount === 0) {
        res.status(403).json({ ok: false, error: 'NOT_IN_GUILD' });
        return;
      }
      
      const result = await pool.query(`
        SELECT * FROM guild_chat
        WHERE guild_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `, [id, GUILD_CONSTANTS.CHAT_MESSAGE_LIMIT]);
      
      res.json({
        ok: true,
        messages: result.rows.reverse().map(row => ({
          id: row.id.toString(),
          guildId: row.guild_id,
          playerId: row.player_id.toString(),
          playerName: row.player_name,
          message: row.message,
          createdAt: new Date(row.created_at).getTime()
        }))
      });
    } catch (e) {
      console.error('Error fetching guild chat:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  /**
   * POST /api/guilds/:id/chat - Отправить сообщение
   */
  app.post('/api/guilds/:id/chat', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { message } = req.body;
      const playerId = req.userId;
      
      if (!message || message.trim().length === 0 || message.length > 500) {
        res.status(400).json({ ok: false, error: 'INVALID_MESSAGE' });
        return;
      }
      
      // Проверяем членство
      const memberResult = await pool.query(`
        SELECT gm.*, u.email as player_name
        FROM guild_members gm
        JOIN users u ON gm.player_id = u.id
        WHERE gm.guild_id = $1 AND gm.player_id = $2
      `, [id, playerId]);
      
      if (memberResult.rowCount === 0) {
        res.status(403).json({ ok: false, error: 'NOT_IN_GUILD' });
        return;
      }
      
      const playerName = memberResult.rows[0].player_name;
      
      const result = await pool.query(`
        INSERT INTO guild_chat (guild_id, player_id, player_name, message)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [id, playerId, playerName, message.trim()]);
      
      res.json({
        ok: true,
        message: {
          id: result.rows[0].id.toString(),
          guildId: result.rows[0].guild_id,
          playerId: result.rows[0].player_id.toString(),
          playerName: result.rows[0].player_name,
          message: result.rows[0].message,
          createdAt: new Date(result.rows[0].created_at).getTime()
        }
      });
    } catch (e) {
      console.error('Error sending guild message:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });
}

export { GUILD_CONSTANTS, getMaxGuildMembers, getGuildLevelExperience, getGuildBonuses };
