import { LAYOUT } from './design-tokens.ts'

export const DESIGN_WIDTH = 720
export const DESIGN_HEIGHT = 1280
export const RENDER_PIXEL_RATIO = 1
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

export interface ViewportSize {
  readonly width: number
  readonly height: number
}

export interface SafeAreaBounds extends ViewportSize {
  readonly x: number
  readonly y: number
}

export interface HudAnchor {
  readonly x: number
  readonly y: number
  readonly topInset: number
}

export function scoreHudAnchor(viewport: ViewportSize, safeArea: SafeAreaBounds, labelHeight: number): HudAnchor {
  const safeTop = Math.max(0, Math.min(viewport.height * 0.25, viewport.height - safeArea.y - safeArea.height))
  const topInset = Math.max(LAYOUT.hudMinimumTop, safeTop + LAYOUT.hudSafePadding)
  return {
    x: -viewport.width * 0.5 + LAYOUT.scoreEdge,
    y: viewport.height * 0.5 - topInset - labelHeight * 0.5,
    topInset
  }
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
