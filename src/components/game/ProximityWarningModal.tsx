/**
 * Модальное окно с предупреждениями о близости зданий
 */

import type { FC } from 'react';
import { THEME_COLORS } from '../../core/constants/themeColors';
import { GameIcon, IconText } from '../ui/icons';

// Конвертер hex числа в CSS строку
const hexToCSS = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;

export interface ProximityWarning {
  level: 'info' | 'warning' | 'critical';
  message: string;
  icon: string;
}

interface ProximityWarningModalProps {
  warnings: ProximityWarning[];
  multiplier: number;
  quality: string;
  buildingName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ProximityWarningModal: FC<ProximityWarningModalProps> = ({
  warnings,
  multiplier,
  quality,
  buildingName,
  onConfirm,
  onCancel,
}) => {
  const hasBlockers = warnings.some(w => w.level === 'critical');
  const hasWarnings = warnings.some(w => w.level === 'warning');
  
  // Определяем цвет заголовка по качеству
  const titleColor = 
    quality === 'optimal' ? hexToCSS(THEME_COLORS.cyberGreen) :
    quality === 'good' ? '#90ee90' :
    quality === 'warning' ? hexToCSS(THEME_COLORS.cyberYellow) :
    quality === 'critical' ? hexToCSS(THEME_COLORS.cyberRed) :
    hexToCSS(THEME_COLORS.cyberText);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          backgroundColor: hexToCSS(THEME_COLORS.cyberDark),
          border: `2px solid ${titleColor}`,
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: `0 0 20px ${titleColor}40`,
        }}
      >
        {/* Заголовок */}
        <div style={{ marginBottom: '20px' }}>
          <h2
            style={{
              color: titleColor,
              margin: 0,
              marginBottom: '8px',
              fontSize: '20px',
              fontWeight: 'bold',
            }}
          >
            <IconText>{quality === 'optimal' && '✨ Оптимальное размещение!'}</IconText>
            {quality === 'good' && '✓ Хорошее размещение'}
            {quality === 'neutral' && 'ℹ️ Обычное размещение'}
            {quality === 'warning' && '⚠️ Неоптимальное размещение'}
            {quality === 'critical' && '🚫 Проблемы с размещением'}
          </h2>
          <p style={{ color: hexToCSS(THEME_COLORS.cyberText), margin: 0, fontSize: '14px' }}>
            {buildingName}
          </p>
        </div>

        {/* Множитель производства */}
        {Math.abs(multiplier - 1) > 0.01 && (
          <div
            style={{
              backgroundColor: multiplier > 1 ? '#00ff0020' : '#ff000020',
              border: `1px solid ${multiplier > 1 ? hexToCSS(THEME_COLORS.cyberGreen) : hexToCSS(THEME_COLORS.cyberRed)}`,
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: multiplier > 1 ? hexToCSS(THEME_COLORS.cyberGreen) : hexToCSS(THEME_COLORS.cyberRed),
                textAlign: 'center',
              }}
            >
              {multiplier > 1 ? '+' : ''}{((multiplier - 1) * 100).toFixed(0)}%
            </div>
            <div style={{ fontSize: '12px', color: hexToCSS(THEME_COLORS.cyberText), textAlign: 'center' }}>
              {multiplier > 1 ? 'Бонус к производству' : 'Штраф к производству'}
            </div>
          </div>
        )}

        {/* Список предупреждений */}
        {warnings.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            {warnings.map((warning, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '8px',
                  marginBottom: '8px',
                  backgroundColor:
                    warning.level === 'critical' ? '#ff000015' :
                    warning.level === 'warning' ? '#ffaa0015' :
                    '#00ffff15',
                  borderLeft: `3px solid ${
                    warning.level === 'critical' ? hexToCSS(THEME_COLORS.cyberRed) :
                    warning.level === 'warning' ? hexToCSS(THEME_COLORS.cyberYellow) :
                    hexToCSS(THEME_COLORS.cyberGreen)
                  }`,
                  borderRadius: '4px',
                }}
              >
                <span style={{ fontSize: '18px', flexShrink: 0 }}><GameIcon icon={warning.icon} /></span>
                <span
                  style={{
                    color: hexToCSS(THEME_COLORS.cyberText),
                    fontSize: '13px',
                    lineHeight: '1.5',
                  }}
                >
                  <IconText>{warning.message}</IconText>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Кнопки */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              backgroundColor: 'transparent',
              border: `2px solid ${hexToCSS(THEME_COLORS.cyberText)}`,
              borderRadius: '6px',
              color: hexToCSS(THEME_COLORS.cyberText),
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${hexToCSS(THEME_COLORS.cyberText)}20`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            disabled={hasBlockers}
            style={{
              padding: '10px 20px',
              backgroundColor: hasBlockers ? '#555' : titleColor,
              border: 'none',
              borderRadius: '6px',
              color: hasBlockers ? '#888' : hexToCSS(THEME_COLORS.cyberDark),
              cursor: hasBlockers ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'all 0.2s',
              opacity: hasBlockers ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!hasBlockers) {
                e.currentTarget.style.opacity = '0.9';
              }
            }}
            onMouseLeave={(e) => {
              if (!hasBlockers) {
                e.currentTarget.style.opacity = '1';
              }
            }}
          >
            {hasBlockers ? 'Нельзя построить' : hasWarnings ? 'Построить все равно' : 'Построить'}
          </button>
        </div>
      </div>
    </div>
  );
};
