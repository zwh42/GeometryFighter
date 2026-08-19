import { LAYOUT } from './design-tokens.ts'

export const DESIGN_WIDTH = 720
export const DESIGN_HEIGHT = 1280
export const RENDER_PIXEL_RATIO = 1
export const GRID_SPACING = 76
export const MAX_PARTICLES = 640
export const MAX_RIPPLES = 20
export const MAX_GRID_WARP_RIPPLES = 6
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

export interface HudLayoutInput {
  readonly viewport: ViewportSize
  readonly safeArea: SafeAreaBounds
  readonly labelHeight: number
  readonly obstructionTop: number
}

export interface HudLayout {
  readonly leftX: number
  readonly rightX: number
  readonly y: number
  readonly statusWidth: number
  readonly topInset: number
}

export function hudLayout(input: HudLayoutInput): HudLayout {
  const { viewport, safeArea, labelHeight, obstructionTop } = input
  const safeTop = Math.max(0, Math.min(viewport.height * 0.25, viewport.height - safeArea.y - safeArea.height))
  const safeLeft = Math.max(0, Math.min(viewport.width * 0.25, safeArea.x))
  const safeRight = Math.max(0, Math.min(viewport.width * 0.25, viewport.width - safeArea.x - safeArea.width))
  const leftInset = Math.max(LAYOUT.scoreEdge, safeLeft + LAYOUT.hudSafePadding)
  const rightInset = Math.max(LAYOUT.scoreEdge, safeRight + LAYOUT.hudSafePadding)
  const leftX = -viewport.width * 0.5 + leftInset
  const rightX = viewport.width * 0.5 - rightInset
  const topInset = Math.max(LAYOUT.hudMinimumTop, safeTop + LAYOUT.hudSafePadding, obstructionTop + LAYOUT.hudSafePadding)
  return {
    leftX,
    rightX,
    y: viewport.height * 0.5 - topInset - labelHeight * 0.5,
    statusWidth: rightX - leftX - LAYOUT.scoreWidth - LAYOUT.hudColumnGap,
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

export interface LatticePoint {
  x: number
  y: number
}

export type WarpTargetFn = (x: number, y: number, output: LatticePoint) => void

export class ReactiveGridLattice {
  readonly points: LatticePoint[] = []
  private readonly velocityX: number[] = []
  private readonly velocityY: number[] = []
  private readonly scratch: LatticePoint = { x: 0, y: 0 }
  private readonly stiffness: number
  private readonly damping: number

  constructor(stiffness: number, damping: number) {
    this.stiffness = stiffness
    this.damping = damping
  }

  advance(layout: GridBounds, spacing: number, dt: number, target: WarpTargetFn): void {
    for (let column = layout.minimumColumn; column <= layout.maximumColumn; column += 1) {
      for (let row = layout.minimumRow; row <= layout.maximumRow; row += 1) {
        const pointIndex = gridPointIndex(layout, column, row)
        const restX = column * spacing
        const restY = row * spacing
        let point = this.points[pointIndex]
        if (!point) {
          point = { x: restX, y: restY }
          this.points[pointIndex] = point
        }
        target(restX, restY, this.scratch)
        let velocityX = this.velocityX[pointIndex] || 0
        let velocityY = this.velocityY[pointIndex] || 0
        const offsetX = point.x - restX
        const offsetY = point.y - restY
        velocityX += ((this.scratch.x - offsetX) * this.stiffness - velocityX * this.damping) * dt
        velocityY += ((this.scratch.y - offsetY) * this.stiffness - velocityY * this.damping) * dt
        point.x = restX + offsetX + velocityX * dt
        point.y = restY + offsetY + velocityY * dt
        this.velocityX[pointIndex] = velocityX
        this.velocityY[pointIndex] = velocityY
      }
    }
    this.points.length = gridPointCount(layout)
    this.velocityX.length = this.points.length
    this.velocityY.length = this.points.length
  }

  kick(layout: GridBounds, spacing: number, x: number, y: number, radius: number, force: number): void {
    const column = Math.round(x / spacing)
    const row = Math.round(y / spacing)
    for (let cellColumn = column - 1; cellColumn <= column + 1; cellColumn += 1) {
      for (let cellRow = row - 1; cellRow <= row + 1; cellRow += 1) {
        if (cellColumn < layout.minimumColumn || cellColumn > layout.maximumColumn || cellRow < layout.minimumRow || cellRow > layout.maximumRow) continue
        const dx = cellColumn * spacing - x
        const dy = cellRow * spacing - y
        const distance = Math.max(1, Math.hypot(dx, dy))
        if (distance > radius) continue
        const push = (1 - distance / radius) * force
        const index = gridPointIndex(layout, cellColumn, cellRow)
        this.velocityX[index] = (this.velocityX[index] || 0) + dx / distance * push
        this.velocityY[index] = (this.velocityY[index] || 0) + dy / distance * push
      }
    }
  }
}

// Neon-tube flicker for the title glow: a slow breath, a fine shimmer, and a
// brief stutter roughly every three seconds. Always clamped to [0.3, 1] so the
// sign dims and flares but never blacks out.
export function titleGlowPulse(time: number): number {
  const breathe = 0.72 + 0.18 * Math.sin(time * 2.1) + 0.08 * Math.sin(time * 5.7 + 1.3)
  const stutter = (time * 0.31) % 1 < 0.045 ? 0.55 + 0.45 * Math.sin(time * 90) : 1
  return Math.min(1, Math.max(0.3, breathe * stutter))
}
