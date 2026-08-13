export const DESIGN_WIDTH = 720
export const DESIGN_HEIGHT = 1280
export const GRID_SPACING = 76
export const MAX_PARTICLES = 480
export const MAX_RIPPLES = 12
export const MAX_GRID_WARP_RIPPLES = 4
export const STAR_COUNT = 48

export interface GridBounds {
  readonly minimumColumn: number
  readonly maximumColumn: number
  readonly minimumRow: number
  readonly maximumRow: number
  readonly columnCount: number
  readonly rowCount: number
}

export function gridBounds(width: number, height: number, spacing: number): GridBounds {
  const columns = Math.ceil(width / spacing) + 2
  const rows = Math.ceil(height / spacing) + 2
  const minimumColumn = -Math.floor(columns / 2)
  const maximumColumn = Math.ceil(columns / 2)
  const minimumRow = -Math.floor(rows / 2)
  const maximumRow = Math.ceil(rows / 2)
  return {
    minimumColumn,
    maximumColumn,
    minimumRow,
    maximumRow,
    columnCount: maximumColumn - minimumColumn + 1,
    rowCount: maximumRow - minimumRow + 1
  }
}

export function gridPointCount(bounds: GridBounds): number {
  return bounds.columnCount * bounds.rowCount
}

export function gridPointIndex(bounds: GridBounds, column: number, row: number): number {
  return (column - bounds.minimumColumn) * bounds.rowCount + row - bounds.minimumRow
}
