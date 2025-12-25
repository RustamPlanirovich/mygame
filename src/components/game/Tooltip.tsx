import React from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: React.ReactNode;
  position: { x: number; y: number };
  visible: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, position, visible }) => {
  if (!visible || !content) return null;

  return createPortal(
    <div
      className="fixed z-[9999] pointer-events-none animate-fade-in"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -100%)',
      }}
    >
      <div className="bg-cyber-dark/95 backdrop-blur-sm border-2 border-cyber-green rounded-lg px-3 py-2 shadow-2xl max-w-xs">
        <div className="text-sm text-cyber-text whitespace-pre-line">
          {content}
        </div>
      </div>
    </div>,
    document.body
  );
};
