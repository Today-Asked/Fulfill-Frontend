import React, { useEffect, useRef, useState } from "react";
import { GRID_COLUMNS, MIN_TILE_SIZE, canvasHeightUnits, isValidPlacement, type GridRect } from "../../lib/grid";

interface CanvasItem extends GridRect {
  id: number;
}

interface DragState {
  id: number;
  mode: "move" | "resize";
  startRect: GridRect;
  startX: number;
  startY: number;
  liveRect: GridRect;
  valid: boolean;
}

interface ArtworkCanvasProps<T extends CanvasItem> {
  items: T[];
  editable?: boolean;
  columns?: number;
  onLayoutChange?: (id: number, rect: GridRect) => void;
  renderItem: (item: T, state: { dragging: boolean; valid: boolean }) => React.ReactNode;
  className?: string;
}

/**
 * Renders artworks on a free-form bento-style canvas. Every grid unit is forced
 * to be a square (unit size = measured container width / columns), so the same
 * grid_x/y/w/h layout scales identically at any viewport width instead of
 * reflowing into a different arrangement per breakpoint.
 */
export function ArtworkCanvas<T extends CanvasItem>({
  items,
  editable = false,
  columns = GRID_COLUMNS,
  onLayoutChange,
  renderItem,
  className = "",
}: ArtworkCanvasProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [unit, setUnit] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setUnit(width / columns);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [columns]);

  const heightUnits = Math.max(canvasHeightUnits(items), 1);

  function beginDrag(event: React.PointerEvent, item: T, mode: "move" | "resize") {
    if (!editable || !unit) return;
    event.preventDefault();
    event.stopPropagation();
    const startRect: GridRect = { grid_x: item.grid_x, grid_y: item.grid_y, grid_w: item.grid_w, grid_h: item.grid_h };
    const state: DragState = {
      id: item.id,
      mode,
      startRect,
      startX: event.clientX,
      startY: event.clientY,
      liveRect: startRect,
      valid: true,
    };
    dragRef.current = state;
    setDrag(state);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    const state = dragRef.current;
    if (!state || !unit) return;
    event.preventDefault();
    const deltaX = Math.round((event.clientX - state.startX) / unit);
    const deltaY = Math.round((event.clientY - state.startY) / unit);
    const others: GridRect[] = items.filter((item) => item.id !== state.id);

    let candidate: GridRect;
    if (state.mode === "move") {
      const grid_x = Math.max(0, Math.min(columns - state.startRect.grid_w, state.startRect.grid_x + deltaX));
      const grid_y = Math.max(0, state.startRect.grid_y + deltaY);
      candidate = { ...state.startRect, grid_x, grid_y };
    } else {
      const grid_w = Math.max(MIN_TILE_SIZE, Math.min(columns - state.startRect.grid_x, state.startRect.grid_w + deltaX));
      const grid_h = Math.max(MIN_TILE_SIZE, state.startRect.grid_h + deltaY);
      candidate = { ...state.startRect, grid_w, grid_h };
    }

    const valid = isValidPlacement(candidate, others, columns);
    const next: DragState = { ...state, liveRect: candidate, valid };
    dragRef.current = next;
    setDrag(next);
  }

  function endDrag() {
    const state = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!state) return;
    const changed =
      state.liveRect.grid_x !== state.startRect.grid_x ||
      state.liveRect.grid_y !== state.startRect.grid_y ||
      state.liveRect.grid_w !== state.startRect.grid_w ||
      state.liveRect.grid_h !== state.startRect.grid_h;
    if (state.valid && changed && onLayoutChange) onLayoutChange(state.id, state.liveRect);
  }

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{ height: unit ? heightUnits * unit : undefined }}
    >
      {items.map((item) => {
        const isDragging = drag?.id === item.id;
        const rect = isDragging && drag ? drag.liveRect : item;
        const style: React.CSSProperties = {
          position: "absolute",
          left: rect.grid_x * unit,
          top: rect.grid_y * unit,
          width: rect.grid_w * unit,
          height: rect.grid_h * unit,
          visibility: unit ? "visible" : "hidden",
          transition: isDragging ? "none" : "left 150ms ease, top 150ms ease, width 150ms ease, height 150ms ease",
          zIndex: isDragging ? 20 : 1,
        };

        return (
          <div
            key={item.id}
            style={style}
            onPointerDown={
              editable
                ? (event) => {
                    if ((event.target as HTMLElement).closest("[data-no-drag]")) return;
                    beginDrag(event, item, "move");
                  }
                : undefined
            }
            onPointerMove={editable ? onPointerMove : undefined}
            onPointerUp={editable ? endDrag : undefined}
            onPointerCancel={editable ? endDrag : undefined}
            className={editable ? "touch-none select-none cursor-grab active:cursor-grabbing" : undefined}
          >
            <div
              className={`absolute inset-1 overflow-hidden rounded-xl ${
                isDragging && drag && !drag.valid ? "ring-2 ring-red-500/70" : ""
              }`}
            >
              {renderItem(item, { dragging: isDragging, valid: isDragging && drag ? drag.valid : true })}
            </div>

            {editable && (
              <div
                data-no-drag
                onPointerDown={(event) => beginDrag(event, item, "resize")}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className="absolute bottom-1.5 right-1.5 z-10 grid h-5 w-5 touch-none place-items-center rounded-md bg-white/85 text-black/70 shadow-sm cursor-se-resize"
                aria-label="調整大小"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M9 1L1 9M9 5L5 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
