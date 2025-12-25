import { useEffect, useRef, useCallback } from 'react';

export interface TouchGesture {
  type: 'tap' | 'double-tap' | 'long-press' | 'swipe' | 'pinch' | 'pan';
  startX: number;
  startY: number;
  endX?: number;
  endY?: number;
  deltaX?: number;
  deltaY?: number;
  scale?: number;
  distance?: number;
}

export interface TouchHandlers {
  onTap?: (x: number, y: number) => void;
  onDoubleTap?: (x: number, y: number) => void;
  onLongPress?: (x: number, y: number) => void;
  onSwipe?: (direction: 'up' | 'down' | 'left' | 'right', deltaX: number, deltaY: number) => void;
  onPinch?: (scale: number) => void;
  onPan?: (deltaX: number, deltaY: number) => void;
}

/**
 * Хук для обработки touch-жестов
 */
export const useTouchGestures = (
  elementRef: React.RefObject<HTMLElement>,
  handlers: TouchHandlers
) => {
  const touchStateRef = useRef({
    touches: [] as Touch[],
    startTime: 0,
    startX: 0,
    startY: 0,
    lastTapTime: 0,
    initialDistance: 0,
    longPressTimer: null as ReturnType<typeof setTimeout> | null,
  });

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const state = touchStateRef.current;
    state.touches = Array.from(e.touches);
    state.startTime = Date.now();

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      state.startX = touch.clientX;
      state.startY = touch.clientY;

      // Long press timer
      if (handlers.onLongPress) {
        state.longPressTimer = setTimeout(() => {
          handlers.onLongPress?.(state.startX, state.startY);
        }, 500);
      }
    } else if (e.touches.length === 2 && handlers.onPinch) {
      // Pinch gesture
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      state.initialDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
    }
  }, [handlers]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const state = touchStateRef.current;

    // Cancel long press on move
    if (state.longPressTimer) {
      clearTimeout(state.longPressTimer);
      state.longPressTimer = null;
    }

    if (e.touches.length === 1 && handlers.onPan) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - state.startX;
      const deltaY = touch.clientY - state.startY;
      handlers.onPan(deltaX, deltaY);
    } else if (e.touches.length === 2 && handlers.onPinch) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const scale = currentDistance / state.initialDistance;
      handlers.onPinch(scale);
    }
  }, [handlers]);

  const handleTouchEnd = useCallback((_e: TouchEvent) => {
    const state = touchStateRef.current;
    const endTime = Date.now();
    const duration = endTime - state.startTime;

    // Clear long press timer
    if (state.longPressTimer) {
      clearTimeout(state.longPressTimer);
      state.longPressTimer = null;
    }

    if (state.touches.length === 1) {
      const touch = state.touches[0];
      const endX = touch.clientX;
      const endY = touch.clientY;
      const deltaX = endX - state.startX;
      const deltaY = endY - state.startY;
      const distance = Math.hypot(deltaX, deltaY);

      // Tap or double tap (minimal movement)
      if (distance < 10 && duration < 300) {
        const timeSinceLastTap = endTime - state.lastTapTime;
        
        if (timeSinceLastTap < 300 && handlers.onDoubleTap) {
          // Double tap
          handlers.onDoubleTap(state.startX, state.startY);
          state.lastTapTime = 0; // Reset to prevent triple tap
        } else if (handlers.onTap) {
          // Single tap
          handlers.onTap(state.startX, state.startY);
          state.lastTapTime = endTime;
        }
      }
      // Swipe (significant movement)
      else if (distance > 50 && duration < 500 && handlers.onSwipe) {
        const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        let direction: 'up' | 'down' | 'left' | 'right';
        
        if (angle >= -45 && angle < 45) direction = 'right';
        else if (angle >= 45 && angle < 135) direction = 'down';
        else if (angle >= -135 && angle < -45) direction = 'up';
        else direction = 'left';

        handlers.onSwipe(direction, deltaX, deltaY);
      }
    }

    state.touches = [];
  }, [handlers]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [elementRef, handleTouchStart, handleTouchMove, handleTouchEnd]);
};

/**
 * Простой хук для tap-событий
 */
export const useTap = (
  elementRef: React.RefObject<HTMLElement>,
  onTap: (x: number, y: number) => void
) => {
  useTouchGestures(elementRef, { onTap });
};

/**
 * Хук для pinch-to-zoom
 */
export const usePinchZoom = (
  elementRef: React.RefObject<HTMLElement>,
  onZoom: (scale: number) => void
) => {
  const scaleRef = useRef(1);
  const baseScaleRef = useRef(1);

  useTouchGestures(elementRef, {
    onPinch: (scale) => {
      scaleRef.current = baseScaleRef.current * scale;
      onZoom(scaleRef.current);
    },
  });

  // Update base scale when pinch ends
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleTouchEnd = () => {
      baseScaleRef.current = scaleRef.current;
    };

    element.addEventListener('touchend', handleTouchEnd);
    return () => element.removeEventListener('touchend', handleTouchEnd);
  }, [elementRef]);
};
