import { useState, useEffect, useRef, useCallback } from "react";
import { Position, Bounds } from "./types";
import { getSafePosition, snapToGrid } from "./rules";

export function useDraggable(
  id: string,
  initialPosition: Position = { x: 0, y: 0 },
  snap: boolean = true
) {
  const [position, setPosition] = useState<Position>(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [isIdle, setIsIdle] = useState(true);
  
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  
  const dragInfo = useRef({
    startX: 0,
    startY: 0,
    startPosX: 0,
    startPosY: 0,
    rafId: 0,
  });

  const getBounds = useCallback((): Bounds => {
    if (!elementRef.current) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    const rect = elementRef.current.getBoundingClientRect();
    return {
      minX: 0,
      minY: 0,
      maxX: window.innerWidth - rect.width,
      maxY: window.innerHeight - rect.height,
    };
  }, []);

  // Infrastructure: Persistence (Storage Adapter)
  useEffect(() => {
    const saved = localStorage.getItem(`widget-pos-${id}`);
    if (saved) {
      try {
        setPosition(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved widget position", e);
      }
    } else {
      setTimeout(() => {
        const bounds = getBounds();
        setPosition({ x: bounds.maxX - 16, y: bounds.minY + 100 });
      }, 100); 
    }
  }, [id, getBounds]);

  // Infrastructure: Window Resize Adapter
  useEffect(() => {
    let resizeTimer: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const bounds = getBounds();
        setPosition((prev) => {
          let newX = Math.max(bounds.minX, Math.min(prev.x, bounds.maxX));
          let newY = Math.max(bounds.minY, Math.min(prev.y, bounds.maxY));
          
          if (snap && elementRef.current) {
             const snapped = snapToGrid({ x: newX, y: newY }, elementRef.current.getBoundingClientRect(), bounds);
             newX = snapped.x;
             newY = snapped.y;
          }
          return { x: newX, y: newY };
        });
      }, 150);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [getBounds, snap]);

  const resetIdleTimer = useCallback(() => {
    setIsIdle(false);
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    idleTimeoutRef.current = setTimeout(() => setIsIdle(true), 3000);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a, input')) return; 
    
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    
    setIsDragging(true);
    resetIdleTimer();

    dragInfo.current.startX = e.clientX;
    dragInfo.current.startY = e.clientY;
    dragInfo.current.startPosX = position.x;
    dragInfo.current.startPosY = position.y;
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging) return;
    
    resetIdleTimer();
    
    const dx = e.clientX - dragInfo.current.startX;
    const dy = e.clientY - dragInfo.current.startY;
    
    let newX = dragInfo.current.startPosX + dx;
    let newY = dragInfo.current.startPosY + dy;

    const bounds = getBounds();
    newX = Math.max(bounds.minX, Math.min(newX, bounds.maxX));
    newY = Math.max(bounds.minY, Math.min(newY, bounds.maxY));

    if (dragInfo.current.rafId) cancelAnimationFrame(dragInfo.current.rafId);
    
    dragInfo.current.rafId = requestAnimationFrame(() => {
      setPosition({ x: newX, y: newY });
    });
  }, [isDragging, getBounds, resetIdleTimer]);

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return;
    
    setIsDragging(false);
    if (dragInfo.current.rafId) cancelAnimationFrame(dragInfo.current.rafId);

    if (!elementRef.current) return;
    const rect = elementRef.current.getBoundingClientRect();
    const bounds = getBounds();
    
    let finalPos = position;

    // Apply Business Rules
    if (snap) {
      finalPos = snapToGrid(finalPos, rect, bounds);
    }
    finalPos = getSafePosition(finalPos, rect, bounds);

    setPosition(finalPos);
    
    localStorage.setItem(`widget-pos-${id}`, JSON.stringify(finalPos));
    resetIdleTimer();
    
  }, [isDragging, position, snap, getBounds, id, resetIdleTimer]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    }
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isDragging, handlePointerMove, handlePointerUp]);

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };
  }, [resetIdleTimer]);

  return {
    ref: elementRef,
    position,
    isDragging,
    isIdle,
    onPointerDown: handlePointerDown,
  };
}
