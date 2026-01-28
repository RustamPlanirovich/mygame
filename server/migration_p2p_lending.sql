-- Миграция для P2P кредитования

-- Таблица офферов (предложений кредитов)
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

-- Таблица активных P2P кредитов
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

-- Таблица платежей по P2P кредитам
CREATE TABLE IF NOT EXISTS p2p_loan_payments (
  id SERIAL PRIMARY KEY,
  loan_id UUID NOT NULL REFERENCES p2p_loans(id) ON DELETE CASCADE,
  amount DECIMAL NOT NULL,
  principal_part DECIMAL NOT NULL,
  interest_part DECIMAL NOT NULL,
  paid_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_p2p_offers_status ON p2p_loan_offers(status);
CREATE INDEX IF NOT EXISTS idx_p2p_offers_lender ON p2p_loan_offers(lender_id);
CREATE INDEX IF NOT EXISTS idx_p2p_offers_expires ON p2p_loan_offers(expires_at);
CREATE INDEX IF NOT EXISTS idx_p2p_loans_lender ON p2p_loans(lender_id);
CREATE INDEX IF NOT EXISTS idx_p2p_loans_borrower ON p2p_loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_p2p_loans_status ON p2p_loans(status);
CREATE INDEX IF NOT EXISTS idx_p2p_loans_due_date ON p2p_loans(due_date);
CREATE INDEX IF NOT EXISTS idx_p2p_payments_loan ON p2p_loan_payments(loan_id);
