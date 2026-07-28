'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'twerz-ai-editor-width';
const DEFAULT_WIDTH = 400;
const MIN_WIDTH = 280;
const MAX_WIDTH = 720;
const MAX_WIDTH_RATIO = 0.55;
const MOBILE_BREAKPOINT = 768;

function readStoredWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_WIDTH;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_WIDTH;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_WIDTH;
}

function clampWidth(width: number, containerWidth: number): number {
  const maxByRatio = containerWidth * MAX_WIDTH_RATIO;
  const max = Math.min(MAX_WIDTH, maxByRatio);
  return Math.max(MIN_WIDTH, Math.min(max, width));
}

export function useResizablePanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    setWidth(clampWidth(readStoredWidth(), window.innerWidth));
  }, []);

  const getContainerWidth = useCallback(() => {
    return containerRef.current?.offsetWidth ?? window.innerWidth;
  }, []);

  const onResizeStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (window.innerWidth <= MOBILE_BREAKPOINT) return;
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startWidth: width };
      setIsDragging(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [width],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startX - e.clientX;
      const next = clampWidth(dragRef.current.startWidth + delta, getContainerWidth());
      setWidth(next);
    },
    [getContainerWidth],
  );

  const onPointerUp = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    setWidth((current) => {
      const clamped = clampWidth(current, getContainerWidth());
      localStorage.setItem(STORAGE_KEY, String(clamped));
      return clamped;
    });
  }, [getContainerWidth]);

  useEffect(() => {
    if (!isDragging) return;
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
    };
  }, [isDragging, onPointerMove, onPointerUp]);

  const onResizeReset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setWidth(DEFAULT_WIDTH);
  }, []);

  return {
    width,
    isDragging,
    containerRef,
    onResizeStart,
    onResizeReset,
  };
}
