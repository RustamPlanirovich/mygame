import React from 'react';
import { createPortal } from 'react-dom';
import { IconText } from '../ui/icons';

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
      <div className="glass rounded-md border border-edge-strong px-3 py-2 shadow-elev-3 max-w-xs">
        <div className="text-sm text-cyber-text whitespace-pre-line">
          {typeof content === 'string' ? <IconText>{content}</IconText> : content}
        </div>
      </div>
    </div>,
    document.body
  );
};
