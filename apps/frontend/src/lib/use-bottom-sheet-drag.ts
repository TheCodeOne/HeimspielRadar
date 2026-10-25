import * as React from 'react';

export interface UseBottomSheetDragOptions {
  onClose: () => void;
  threshold?: number;
  velocityThreshold?: number;
}

export interface UseBottomSheetDragResult {
  isAnimatingOut: boolean;
  dragY: number;
  isDragging: boolean;
  closeWithAnimation: () => void;
  touchHandlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
}

export function useBottomSheetDrag({
  onClose,
  threshold = 80,
  velocityThreshold = 0.35,
}: UseBottomSheetDragOptions): UseBottomSheetDragResult {
  const [isAnimatingOut, setIsAnimatingOut] = React.useState(false);
  const [dragY, setDragY] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);

  const isDraggingRef = React.useRef(false);
  const startYRef = React.useRef(0);
  const startTimeRef = React.useRef(0);
  const lastYRef = React.useRef(0);

  const closeWithAnimation = React.useCallback(() => {
    setIsAnimatingOut(true);

    const timer = setTimeout(() => {
      onClose();
      setIsAnimatingOut(false);
      setDragY(0);
    }, 250);

    return () => clearTimeout(timer);
  }, [onClose]);

  const onTouchStart = React.useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];

    if (!touch) {
      return;
    }

    startYRef.current = touch.clientY;
    lastYRef.current = touch.clientY;
    startTimeRef.current = Date.now();
    isDraggingRef.current = true;
    setIsDragging(true);
  }, []);

  const onTouchMove = React.useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current) {
      return;
    }

    const touch = e.touches[0];

    if (!touch) {
      return;
    }

    const deltaY = touch.clientY - startYRef.current;
    lastYRef.current = touch.clientY;

    if (deltaY > 0) {
      // Dragging down: follow finger 1:1
      setDragY(deltaY);
    } else {
      // Dragging up past top: apply rubber-band damping
      setDragY(deltaY * 0.15);
    }
  }, []);

  const onTouchEnd = React.useCallback(
    (e: React.TouchEvent) => {
      if (!isDraggingRef.current) {
        return;
      }

      isDraggingRef.current = false;
      setIsDragging(false);

      const changedTouch = e.changedTouches ? e.changedTouches[0] : null;
      const endY = changedTouch ? changedTouch.clientY : lastYRef.current;
      const deltaY = endY - startYRef.current;
      const elapsed = Math.max(Date.now() - startTimeRef.current, 1);
      const velocity = deltaY / elapsed;

      if (deltaY > threshold || velocity > velocityThreshold) {
        closeWithAnimation();
      } else {
        setDragY(0);
      }
    },
    [threshold, velocityThreshold, closeWithAnimation]
  );

  return {
    isAnimatingOut,
    dragY,
    isDragging,
    closeWithAnimation,
    touchHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
}
