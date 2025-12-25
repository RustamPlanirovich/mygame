import { useState, useCallback, useRef, useEffect } from 'react';

interface TooltipPosition {
  x: number;
  y: number;
}

interface TooltipState {
  content: React.ReactNode;
  position: TooltipPosition;
  visible: boolean;
}

export const useTooltip = () => {
  const [tooltip, setTooltip] = useState<TooltipState>({
    content: null,
    position: { x: 0, y: 0 },
    visible: false,
  });
  
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = useCallback((content: React.ReactNode, event: React.MouseEvent) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top - 10;

    setTooltip({
      content,
      position: { x, y },
      visible: true,
    });
  }, []);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setTooltip(prev => ({ ...prev, visible: false }));
    }, 150);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { tooltip, showTooltip, hideTooltip };
};
