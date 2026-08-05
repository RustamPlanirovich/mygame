/**
 * CreditScore - Компонент отображения кредитного рейтинга
 */


import { memo } from 'react';
import {
  getCreditScoreCategory,
  getCreditScoreCategoryName,
  getCreditScoreColor,
} from '../../../core/gameTypes.finance';

interface CreditScoreProps {
  score: number;
  compact?: boolean;
}

// memo: родительская FinancePanel рендерится на каждый тик. Пропсы — примитивы,
// поэтому стандартного поверхностного сравнения достаточно.
export const CreditScore = memo(CreditScoreImpl);

function CreditScoreImpl({ score, compact = false }: CreditScoreProps) {
  const category = getCreditScoreCategory(score);
  const categoryName = getCreditScoreCategoryName(category);
  const color = getCreditScoreColor(category);

  const normalizedScore = ((score - 300) / (850 - 300)) * 100;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="font-mono font-bold tabular-nums" style={{ color }}>
          {score}
        </span>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h4 className="stat-label">Кредитный рейтинг</h4>
        <div className="text-right">
          <div className="font-mono text-2xl font-bold tabular-nums" style={{ color }}>
            {score}
          </div>
          <div className="text-sm" style={{ color }}>
            {categoryName}
          </div>
        </div>
      </div>

      {/*
        Шкала рейтинга не выражается через <Meter>: у неё есть радужная подложка,
        отдельный маркер позиции и цвет заливки, который приходит из
        getCreditScoreColor() как произвольный hex — а Meter принимает только
        фиксированный набор тонов. Поэтому дорожка рисуется вручную.
      */}
      <div className="relative h-3 bg-slate-700 rounded-full overflow-hidden">
        {/* Градиентный фон */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, #ef4444, #f97316, #eab308, #84cc16, #22c55e)',
            opacity: 0.3,
          }}
        />

        {/* Индикатор */}
        <div
          className="absolute top-0 h-full w-1 bg-white shadow-lg"
          style={{
            left: `${normalizedScore}%`,
            transform: 'translateX(-50%)',
          }}
        />

        {/* Заполнение */}
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${normalizedScore}%`,
            backgroundColor: color,
          }}
        />
      </div>

      <div className="flex justify-between text-xs text-slate-500 mt-1">
        <span>Плохой</span>
        <span>Удовл.</span>
        <span>Хороший</span>
        <span>Отличный</span>
      </div>

      {/* Влияние на ставки */}
      <div className="mt-3 text-sm text-slate-400">
        <div className="flex justify-between">
          <span>Доступные кредиты:</span>
          <span className="font-mono tabular-nums text-white">
            {score >= 750 ? '4 из 4' : score >= 650 ? '3 из 4' : score >= 500 ? '2 из 4' : '1 из 4'}
          </span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Модификатор ставки:</span>
          <span className={`font-mono tabular-nums ${score >= 700 ? 'text-green-400' : score < 500 ? 'text-red-400' : 'text-white'}`}>
            {score >= 800 ? '-30%' : score >= 700 ? '-15%' : score >= 600 ? '±0%' : score >= 500 ? '+15%' : '+50%'}
          </span>
        </div>
      </div>
    </div>
  );
}
