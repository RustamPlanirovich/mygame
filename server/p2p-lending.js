/**
 * Модуль P2P кредитования
 * Глобальный рынок кредитов между игроками
 */

const P2P_CONSTANTS = {
  MIN_LOAN_AMOUNT: 1000,
  MAX_LOAN_AMOUNT: 10000000,
  MIN_INTEREST_RATE: 0.01,
  MAX_INTEREST_RATE: 0.5,
  MIN_TERM_DAYS: 1,
  MAX_TERM_DAYS: 365,
  OFFER_LIFETIME_MS: 7 * 24 * 60 * 60 * 1000,
  PLATFORM_FEE_PERCENT: 1,
  MAX_ACTIVE_OFFERS: 10,
  MAX_ACTIVE_LOANS_AS_LENDER: 20,
  MAX_ACTIVE_LOANS_AS_BORROWER: 5,
};

/**
 * Инициализация таблиц P2P кредитования
 */
export async function initP2PLendingTables(pool) {
  // Таблица офферов (предложений кредитов)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS p2p_loan_offers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount DECIMAL NOT NULL CHECK (amount >= 1000 AND amount <= 10000000),
      interest_rate DECIMAL NOT NULL CHECK (interest_rate >= 0.01 AND interest_rate <= 0.50),
      term_days INTEGER NOT NULL CHECK (term_days >= 1 AND term_days <= 365),
      min_credit_score INTEGER DEFAULT 300 CHECK (min_credit_score >= 300 AND min_credit_score <= 850),
      requires_collateral BOOLEAN DEFAULT false,
      status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'active', 'cancelled', 'expired')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );
  `);

  // Таблица активных P2P кредитов
  await pool.query(`
    CREATE TABLE IF NOT EXISTS p2p_loans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      offer_id UUID REFERENCES p2p_loan_offers(id),
      lender_id INTEGER NOT NULL REFERENCES users(id),
      borrower_id INTEGER NOT NULL REFERENCES users(id),
      principal DECIMAL NOT NULL,
      interest_rate DECIMAL NOT NULL,
      term_days INTEGER NOT NULL,
      remaining_balance DECIMAL NOT NULL,
      status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paid', 'defaulted')),
      start_date TIMESTAMPTZ DEFAULT NOW(),
      due_date TIMESTAMPTZ NOT NULL,
      interest_paid DECIMAL DEFAULT 0,
      last_payment_date TIMESTAMPTZ,
      days_overdue INTEGER DEFAULT 0
    );
  `);

  // Таблица платежей по P2P кредитам
  await pool.query(`
    CREATE TABLE IF NOT EXISTS p2p_loan_payments (
      id SERIAL PRIMARY KEY,
      loan_id UUID NOT NULL REFERENCES p2p_loans(id) ON DELETE CASCADE,
      amount DECIMAL NOT NULL,
      principal_part DECIMAL NOT NULL,
      interest_part DECIMAL NOT NULL,
      paid_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Индексы
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_p2p_offers_status ON p2p_loan_offers(status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_p2p_offers_lender ON p2p_loan_offers(lender_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_p2p_loans_lender ON p2p_loans(lender_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_p2p_loans_borrower ON p2p_loans(borrower_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_p2p_loans_status ON p2p_loans(status);`);
}

/**
 * Создание роутов P2P кредитования
 */
export function createP2PLendingRoutes(app, pool, authMiddleware) {
  console.log('[P2P] Registering P2P lending routes...');
  
  // ==========================================
  // ОФФЕРЫ (ПРЕДЛОЖЕНИЯ КРЕДИТОВ)
  // ==========================================

  /**
   * GET /api/p2p/offers - Получить все открытые офферы
   */
  console.log('[P2P] Adding GET /api/p2p/offers route');
  app.get('/api/p2p/offers', async (req, res) => {
    try {
      const { minAmount, maxAmount, maxRate, minTerm, maxTerm, minCreditScore, limit = 50, offset = 0 } =
        req.query;

      let query = `
        SELECT 
          o.*,
          u.email as lender_name
        FROM p2p_loan_offers o
        JOIN users u ON o.lender_id = u.id
        WHERE o.status = 'open' AND o.expires_at > NOW()
      `;
      const params = [];
      let paramIndex = 1;

      if (minAmount) {
        query += ` AND o.amount >= $${paramIndex++}`;
        params.push(parseFloat(minAmount));
      }
      if (maxAmount) {
        query += ` AND o.amount <= $${paramIndex++}`;
        params.push(parseFloat(maxAmount));
      }
      if (maxRate) {
        query += ` AND o.interest_rate <= $${paramIndex++}`;
        params.push(parseFloat(maxRate));
      }
      if (minTerm) {
        query += ` AND o.term_days >= $${paramIndex++}`;
        params.push(parseInt(minTerm));
      }
      if (maxTerm) {
        query += ` AND o.term_days <= $${paramIndex++}`;
        params.push(parseInt(maxTerm));
      }
      if (minCreditScore) {
        query += ` AND o.min_credit_score <= $${paramIndex++}`;
        params.push(parseInt(minCreditScore));
      }

      query += ` ORDER BY o.interest_rate ASC, o.amount DESC`;
      query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(parseInt(limit), parseInt(offset));

      const result = await pool.query(query, params);

      res.json({
        ok: true,
        offers: result.rows.map((row) => ({
          id: row.id,
          lenderId: row.lender_id.toString(),
          lenderName: row.lender_name,
          amount: row.amount.toString(),
          interestRate: parseFloat(row.interest_rate),
          termDays: row.term_days,
          minCreditScore: row.min_credit_score,
          requiresCollateral: row.requires_collateral,
          status: row.status,
          createdAt: new Date(row.created_at).getTime(),
          expiresAt: new Date(row.expires_at).getTime(),
        })),
      });
    } catch (e) {
      console.error('Error fetching P2P offers:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  /**
   * POST /api/p2p/offers - Создать оффер (выставить деньги в кредит)
   */
  app.post('/api/p2p/offers', authMiddleware, async (req, res) => {
    try {
      const { amount, interestRate, termDays, minCreditScore = 300, requiresCollateral = false } = req.body;
      const lenderId = req.userId;

      // Валидация
      if (!amount || amount < P2P_CONSTANTS.MIN_LOAN_AMOUNT || amount > P2P_CONSTANTS.MAX_LOAN_AMOUNT) {
        return res.status(400).json({
          ok: false,
          error: `Сумма должна быть от ${P2P_CONSTANTS.MIN_LOAN_AMOUNT} до ${P2P_CONSTANTS.MAX_LOAN_AMOUNT}`,
        });
      }

      if (
        !interestRate ||
        interestRate < P2P_CONSTANTS.MIN_INTEREST_RATE ||
        interestRate > P2P_CONSTANTS.MAX_INTEREST_RATE
      ) {
        return res.status(400).json({
          ok: false,
          error: `Ставка должна быть от ${P2P_CONSTANTS.MIN_INTEREST_RATE * 100}% до ${P2P_CONSTANTS.MAX_INTEREST_RATE * 100}%`,
        });
      }

      if (!termDays || termDays < P2P_CONSTANTS.MIN_TERM_DAYS || termDays > P2P_CONSTANTS.MAX_TERM_DAYS) {
        return res.status(400).json({
          ok: false,
          error: `Срок должен быть от ${P2P_CONSTANTS.MIN_TERM_DAYS} до ${P2P_CONSTANTS.MAX_TERM_DAYS} дней`,
        });
      }

      // Проверяем лимит активных офферов
      const activeOffersResult = await pool.query(
        `SELECT COUNT(*) FROM p2p_loan_offers WHERE lender_id = $1 AND status = 'open'`,
        [lenderId]
      );

      if (parseInt(activeOffersResult.rows[0].count) >= P2P_CONSTANTS.MAX_ACTIVE_OFFERS) {
        return res.status(400).json({
          ok: false,
          error: `Максимум ${P2P_CONSTANTS.MAX_ACTIVE_OFFERS} активных офферов`,
        });
      }

      const expiresAt = new Date(Date.now() + P2P_CONSTANTS.OFFER_LIFETIME_MS);

      const result = await pool.query(
        `INSERT INTO p2p_loan_offers 
         (lender_id, amount, interest_rate, term_days, min_credit_score, requires_collateral, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [lenderId, amount, interestRate, termDays, minCreditScore, requiresCollateral, expiresAt]
      );

      const offer = result.rows[0];

      res.json({
        ok: true,
        offer: {
          id: offer.id,
          lenderId: offer.lender_id.toString(),
          amount: offer.amount.toString(),
          interestRate: parseFloat(offer.interest_rate),
          termDays: offer.term_days,
          minCreditScore: offer.min_credit_score,
          requiresCollateral: offer.requires_collateral,
          status: offer.status,
          createdAt: new Date(offer.created_at).getTime(),
          expiresAt: new Date(offer.expires_at).getTime(),
        },
      });
    } catch (e) {
      console.error('Error creating P2P offer:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  /**
   * DELETE /api/p2p/offers/:id - Отменить оффер
   */
  app.delete('/api/p2p/offers/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const lenderId = req.userId;

      const result = await pool.query(
        `UPDATE p2p_loan_offers 
         SET status = 'cancelled' 
         WHERE id = $1 AND lender_id = $2 AND status = 'open'
         RETURNING id`,
        [id, lenderId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ ok: false, error: 'Оффер не найден или уже закрыт' });
      }

      res.json({ ok: true });
    } catch (e) {
      console.error('Error cancelling P2P offer:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  // ==========================================
  // ВЗЯТИЕ КРЕДИТА
  // ==========================================

  /**
   * POST /api/p2p/borrow/:offerId - Взять кредит по офферу
   */
  app.post('/api/p2p/borrow/:offerId', authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { offerId } = req.params;
      const { creditScore } = req.body; // Кредитный рейтинг заёмщика
      const borrowerId = req.userId;

      // Получаем оффер
      const offerResult = await client.query(
        `SELECT * FROM p2p_loan_offers 
         WHERE id = $1 AND status = 'open' AND expires_at > NOW()
         FOR UPDATE`,
        [offerId]
      );

      if (offerResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ ok: false, error: 'Оффер не найден или уже закрыт' });
      }

      const offer = offerResult.rows[0];

      // Нельзя брать кредит у самого себя
      if (offer.lender_id === borrowerId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, error: 'Нельзя взять кредит у самого себя' });
      }

      // Проверяем кредитный рейтинг
      if (creditScore < offer.min_credit_score) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          error: `Требуется кредитный рейтинг не менее ${offer.min_credit_score}`,
        });
      }

      // Проверяем лимит активных кредитов заёмщика
      const borrowerLoansResult = await client.query(
        `SELECT COUNT(*) FROM p2p_loans WHERE borrower_id = $1 AND status = 'active'`,
        [borrowerId]
      );

      if (parseInt(borrowerLoansResult.rows[0].count) >= P2P_CONSTANTS.MAX_ACTIVE_LOANS_AS_BORROWER) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          error: `Максимум ${P2P_CONSTANTS.MAX_ACTIVE_LOANS_AS_BORROWER} активных кредитов`,
        });
      }

      // Рассчитываем общую сумму к возврату
      const principal = parseFloat(offer.amount);
      const interestRate = parseFloat(offer.interest_rate);
      const termDays = offer.term_days;
      const totalInterest = principal * interestRate * (termDays / 365);
      const remainingBalance = principal + totalInterest;
      const dueDate = new Date(Date.now() + termDays * 24 * 60 * 60 * 1000);

      // Обновляем оффер
      await client.query(`UPDATE p2p_loan_offers SET status = 'active' WHERE id = $1`, [offerId]);

      // Создаём кредит
      const loanResult = await client.query(
        `INSERT INTO p2p_loans 
         (offer_id, lender_id, borrower_id, principal, interest_rate, term_days, remaining_balance, due_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [offerId, offer.lender_id, borrowerId, principal, interestRate, termDays, remainingBalance, dueDate]
      );

      await client.query('COMMIT');

      const loan = loanResult.rows[0];

      res.json({
        ok: true,
        loan: {
          id: loan.id,
          offerId: loan.offer_id,
          lenderId: loan.lender_id.toString(),
          borrowerId: loan.borrower_id.toString(),
          principal: loan.principal.toString(),
          interestRate: parseFloat(loan.interest_rate),
          termDays: loan.term_days,
          remainingBalance: loan.remaining_balance.toString(),
          status: loan.status,
          startDate: new Date(loan.start_date).getTime(),
          dueDate: new Date(loan.due_date).getTime(),
        },
        // Сумма которую получает заёмщик (за вычетом комиссии)
        amountReceived: (principal * (1 - P2P_CONSTANTS.PLATFORM_FEE_PERCENT / 100)).toString(),
      });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Error borrowing P2P loan:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    } finally {
      client.release();
    }
  });

  // ==========================================
  // МОИ КРЕДИТЫ
  // ==========================================

  /**
   * GET /api/p2p/my/offers - Мои офферы
   */
  app.get('/api/p2p/my/offers', authMiddleware, async (req, res) => {
    try {
      const lenderId = req.userId;

      const result = await pool.query(
        `SELECT * FROM p2p_loan_offers WHERE lender_id = $1 ORDER BY created_at DESC`,
        [lenderId]
      );

      res.json({
        ok: true,
        offers: result.rows.map((row) => ({
          id: row.id,
          lenderId: row.lender_id.toString(),
          amount: row.amount.toString(),
          interestRate: parseFloat(row.interest_rate),
          termDays: row.term_days,
          minCreditScore: row.min_credit_score,
          requiresCollateral: row.requires_collateral,
          status: row.status,
          createdAt: new Date(row.created_at).getTime(),
          expiresAt: new Date(row.expires_at).getTime(),
        })),
      });
    } catch (e) {
      console.error('Error fetching my P2P offers:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  /**
   * GET /api/p2p/my/loans-as-lender - Кредиты где я кредитор
   */
  app.get('/api/p2p/my/loans-as-lender', authMiddleware, async (req, res) => {
    try {
      const lenderId = req.userId;

      // Автоматически закрываем кредиты с нулевым балансом
      await pool.query(
        `UPDATE p2p_loans 
         SET status = 'paid' 
         WHERE lender_id = $1 AND status = 'active' AND remaining_balance <= 0.01`,
        [lenderId]
      );

      const result = await pool.query(
        `SELECT l.*, u.email as borrower_name
         FROM p2p_loans l
         JOIN users u ON l.borrower_id = u.id
         WHERE l.lender_id = $1
         ORDER BY l.start_date DESC`,
        [lenderId]
      );

      res.json({
        ok: true,
        loans: result.rows.map((row) => ({
          id: row.id,
          offerId: row.offer_id,
          lenderId: row.lender_id.toString(),
          borrowerId: row.borrower_id.toString(),
          borrowerName: row.borrower_name,
          principal: row.principal.toString(),
          interestRate: parseFloat(row.interest_rate),
          termDays: row.term_days,
          remainingBalance: row.remaining_balance.toString(),
          status: row.status,
          startDate: new Date(row.start_date).getTime(),
          dueDate: new Date(row.due_date).getTime(),
          interestPaid: row.interest_paid.toString(),
          daysOverdue: row.days_overdue,
        })),
      });
    } catch (e) {
      console.error('Error fetching loans as lender:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  /**
   * GET /api/p2p/my/loans-as-borrower - Кредиты где я заёмщик
   */
  app.get('/api/p2p/my/loans-as-borrower', authMiddleware, async (req, res) => {
    try {
      const borrowerId = req.userId;

      // Автоматически закрываем кредиты с нулевым балансом
      await pool.query(
        `UPDATE p2p_loans 
         SET status = 'paid' 
         WHERE borrower_id = $1 AND status = 'active' AND remaining_balance <= 0.01`,
        [borrowerId]
      );

      const result = await pool.query(
        `SELECT l.*, u.email as lender_name
         FROM p2p_loans l
         JOIN users u ON l.lender_id = u.id
         WHERE l.borrower_id = $1
         ORDER BY l.start_date DESC`,
        [borrowerId]
      );

      res.json({
        ok: true,
        loans: result.rows.map((row) => ({
          id: row.id,
          offerId: row.offer_id,
          lenderId: row.lender_id.toString(),
          lenderName: row.lender_name,
          borrowerId: row.borrower_id.toString(),
          principal: row.principal.toString(),
          interestRate: parseFloat(row.interest_rate),
          termDays: row.term_days,
          remainingBalance: row.remaining_balance.toString(),
          status: row.status,
          startDate: new Date(row.start_date).getTime(),
          dueDate: new Date(row.due_date).getTime(),
          interestPaid: row.interest_paid.toString(),
          daysOverdue: row.days_overdue,
        })),
      });
    } catch (e) {
      console.error('Error fetching loans as borrower:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  /**
   * POST /api/p2p/loans/:id/pay - Погасить P2P кредит
   */
  app.post('/api/p2p/loans/:id/pay', authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { id } = req.params;
      const { amount } = req.body;
      const borrowerId = req.userId;

      // Получаем кредит
      const loanResult = await client.query(
        `SELECT * FROM p2p_loans 
         WHERE id = $1 AND borrower_id = $2 AND status = 'active'
         FOR UPDATE`,
        [id, borrowerId]
      );

      if (loanResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ ok: false, error: 'Кредит не найден' });
      }

      const loan = loanResult.rows[0];
      const remainingBalance = parseFloat(loan.remaining_balance);
      const paymentAmount = Math.min(parseFloat(amount), remainingBalance);

      // Рассчитываем части платежа
      const principal = parseFloat(loan.principal);
      const interestRate = parseFloat(loan.interest_rate);
      const totalInterest = principal * interestRate * (loan.term_days / 365);
      const interestRatio = totalInterest / (principal + totalInterest);

      const interestPart = paymentAmount * interestRatio;
      const principalPart = paymentAmount - interestPart;

      const newBalance = Math.max(0, remainingBalance - paymentAmount);
      // Кредит полностью погашен если остаток меньше 1 копейки или равен 0
      const isFullyPaid = newBalance < 0.01 || Math.abs(remainingBalance - paymentAmount) < 0.01;
      const newInterestPaid = parseFloat(loan.interest_paid) + interestPart;
      
      // Финальный баланс: если погашен полностью, ставим точный 0
      const finalBalance = isFullyPaid ? 0 : newBalance;

      // Обновляем кредит
      await client.query(
        `UPDATE p2p_loans 
         SET remaining_balance = $1, 
             interest_paid = $2, 
             status = $3,
             last_payment_date = NOW()
         WHERE id = $4`,
        [finalBalance, newInterestPaid, isFullyPaid ? 'paid' : 'active', id]
      );

      // Записываем платёж
      await client.query(
        `INSERT INTO p2p_loan_payments (loan_id, amount, principal_part, interest_part)
         VALUES ($1, $2, $3, $4)`,
        [id, paymentAmount, principalPart, interestPart]
      );

      await client.query('COMMIT');

      res.json({
        ok: true,
        payment: {
          amount: paymentAmount.toString(),
          principalPart: principalPart.toString(),
          interestPart: interestPart.toString(),
          remainingBalance: Math.max(0, newBalance).toString(),
          isFullyPaid,
        },
        // Сумма которую получает кредитор (за вычетом комиссии)
        amountToLender: (paymentAmount * (1 - P2P_CONSTANTS.PLATFORM_FEE_PERCENT / 100)).toString(),
      });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Error paying P2P loan:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    } finally {
      client.release();
    }
  });

  // ==========================================
  // СТАТИСТИКА
  // ==========================================

  /**
   * GET /api/p2p/stats - Статистика P2P рынка
   */
  app.get('/api/p2p/stats', async (_req, res) => {
    try {
      const [offersStats, loansStats, avgRateResult] = await Promise.all([
        pool.query(`
          SELECT 
            COUNT(*) as total_offers,
            COALESCE(SUM(amount), 0) as total_amount_available
          FROM p2p_loan_offers 
          WHERE status = 'open' AND expires_at > NOW()
        `),
        pool.query(`
          SELECT 
            COUNT(*) as total_loans,
            COALESCE(SUM(principal), 0) as total_volume,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_loans,
            COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_loans,
            COUNT(CASE WHEN status = 'defaulted' THEN 1 END) as defaulted_loans
          FROM p2p_loans
        `),
        pool.query(`
          SELECT COALESCE(AVG(interest_rate), 0.1) as avg_rate
          FROM p2p_loan_offers
          WHERE status = 'open' AND expires_at > NOW()
        `),
      ]);

      res.json({
        ok: true,
        stats: {
          openOffers: parseInt(offersStats.rows[0].total_offers) || 0,
          availableAmount: offersStats.rows[0].total_amount_available?.toString() || '0',
          averageRate: parseFloat(avgRateResult.rows[0].avg_rate) || 0.1,
          totalLoans: parseInt(loansStats.rows[0].total_loans) || 0,
          activeLoans: parseInt(loansStats.rows[0].active_loans) || 0,
          paidLoans: parseInt(loansStats.rows[0].paid_loans) || 0,
          defaultedLoans: parseInt(loansStats.rows[0].defaulted_loans) || 0,
          totalVolume: loansStats.rows[0].total_volume?.toString() || '0',
        },
      });
    } catch (e) {
      console.error('Error fetching P2P stats:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  /**
   * Фоновая задача: обновление просроченных кредитов
   */
  async function updateOverdueLoans() {
    try {
      // Обновляем days_overdue для просроченных кредитов
      await pool.query(`
        UPDATE p2p_loans 
        SET days_overdue = EXTRACT(DAY FROM NOW() - due_date)::INTEGER
        WHERE status = 'active' AND due_date < NOW()
      `);

      // Помечаем кредиты как дефолтные если просрочка > 30 дней
      await pool.query(`
        UPDATE p2p_loans 
        SET status = 'defaulted'
        WHERE status = 'active' AND days_overdue > 30
      `);

      // Помечаем истёкшие офферы
      await pool.query(`
        UPDATE p2p_loan_offers 
        SET status = 'expired'
        WHERE status = 'open' AND expires_at < NOW()
      `);
    } catch (e) {
      console.error('Error updating overdue loans:', e);
    }
  }

  // Запускаем обновление каждый час
  setInterval(updateOverdueLoans, 60 * 60 * 1000);
  // И сразу при старте
  updateOverdueLoans();
}
