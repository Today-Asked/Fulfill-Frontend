/** Shared layout math for the Fulfill Grid free-form portfolio layout.
 *
 * The grid is `GRID_COLUMNS` wide and every unit cell is forced to be a square:
 * unit size = container width / GRID_COLUMNS. Because grid_x/y/w/h are stored in
 * these units (not pixels), the same layout scales identically at any viewport
 * width instead of reflowing into a different arrangement per breakpoint.
 */

export const GRID_COLUMNS = 6;
export const DEFAULT_TILE_W = 2;
export const DEFAULT_TILE_H = 2;
export const MIN_TILE_SIZE = 1;

export interface GridRect {
  grid_x: number;
  grid_y: number;
  grid_w: number;
  grid_h: number;
}

export function rectsOverlap(a: GridRect, b: GridRect): boolean {
  return (
    a.grid_x < b.grid_x + b.grid_w &&
    a.grid_x + a.grid_w > b.grid_x &&
    a.grid_y < b.grid_y + b.grid_h &&
    a.grid_y + a.grid_h > b.grid_y
  );
}

export function isValidPlacement(
  candidate: GridRect,
  others: GridRect[],
  columns = GRID_COLUMNS,
): boolean {
  if (candidate.grid_x < 0 || candidate.grid_y < 0) return false;
  if (candidate.grid_w < MIN_TILE_SIZE || candidate.grid_h < MIN_TILE_SIZE) return false;
  if (candidate.grid_x + candidate.grid_w > columns) return false;
  return !others.some((other) => rectsOverlap(candidate, other));
}

/** Finds the first free slot for a new tile, scanning row by row, left to right. */
export function findNextFreeSlot(
  existing: GridRect[],
  w: number = DEFAULT_TILE_W,
  h: number = DEFAULT_TILE_H,
  columns = GRID_COLUMNS,
): { grid_x: number; grid_y: number } {
  const maxY = existing.reduce((max, rect) => Math.max(max, rect.grid_y + rect.grid_h), 0);
  for (let y = 0; y <= maxY; y += 1) {
    for (let x = 0; x <= columns - w; x += 1) {
      const candidate = { grid_x: x, grid_y: y, grid_w: w, grid_h: h };
      if (!existing.some((other) => rectsOverlap(candidate, other))) {
        return { grid_x: x, grid_y: y };
      }
    }
  }
  return { grid_x: 0, grid_y: maxY };
}

export function canvasHeightUnits(rects: GridRect[]): number {
  return rects.reduce((max, rect) => Math.max(max, rect.grid_y + rect.grid_h), 0);
}
