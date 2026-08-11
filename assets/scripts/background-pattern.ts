export const BACKGROUND_PATTERNS = ['lattice', 'diamond', 'orbit', 'depth'] as const

export type BackgroundPattern = typeof BACKGROUND_PATTERNS[number]

export interface BackgroundPoint {
  readonly x: number
  readonly y: number
}

export interface BackgroundBounds {
  readonly width: number
  readonly height: number
  readonly spacing: number
  readonly sampleStep: number
}

export type BackgroundPath = readonly BackgroundPoint[]

export function patternForProgress(wave: number, weaponTier: number): BackgroundPattern {
  const stage = Math.max(0, Math.floor(wave) - 1) + Math.max(0, Math.floor(weaponTier) - 1)
  switch (stage % BACKGROUND_PATTERNS.length) {
    case 0: return 'lattice'
    case 1: return 'diamond'
    case 2: return 'orbit'
    default: return 'depth'
  }
}

function sampleSegment(start: BackgroundPoint, end: BackgroundPoint, sampleStep: number): BackgroundPoint[] {
  const distance = Math.hypot(end.x - start.x, end.y - start.y)
  const segments = Math.max(1, Math.ceil(distance / sampleStep))
  const points: BackgroundPoint[] = []
  for (let index = 0; index <= segments; index += 1) {
    const progress = index / segments
    points.push({
      x: start.x + (end.x - start.x) * progress,
      y: start.y + (end.y - start.y) * progress
    })
  }
  return points
}

function samplePolyline(vertices: readonly BackgroundPoint[], sampleStep: number, closed: boolean): BackgroundPoint[] {
  const points: BackgroundPoint[] = []
  const edgeCount = closed ? vertices.length : vertices.length - 1
  for (let edge = 0; edge < edgeCount; edge += 1) {
    const start = vertices[edge]
    const end = vertices[(edge + 1) % vertices.length]
    if (!start || !end) continue
    const segment = sampleSegment(start, end, sampleStep)
    for (let pointIndex = edge === 0 ? 0 : 1; pointIndex < segment.length; pointIndex += 1) {
      const point = segment[pointIndex]
      if (point) points.push(point)
    }
  }
  return points
}

function buildLattice(bounds: BackgroundBounds): BackgroundPath[] {
  const paths: BackgroundPath[] = []
  const halfWidth = bounds.width * 0.5
  const halfHeight = bounds.height * 0.5
  for (let x = -halfWidth + bounds.spacing * 0.5; x < halfWidth; x += bounds.spacing) {
    paths.push(sampleSegment({ x, y: -halfHeight }, { x, y: halfHeight }, bounds.sampleStep))
  }
  for (let y = -halfHeight + bounds.spacing * 0.5; y < halfHeight; y += bounds.spacing) {
    paths.push(sampleSegment({ x: -halfWidth, y }, { x: halfWidth, y }, bounds.sampleStep))
  }
  return paths
}

function diagonalEndpoints(offset: number, slope: number, halfWidth: number, halfHeight: number): readonly [BackgroundPoint, BackgroundPoint] | null {
  const candidates: BackgroundPoint[] = []
  const leftY = slope * -halfWidth + offset
  const rightY = slope * halfWidth + offset
  const bottomX = (-halfHeight - offset) / slope
  const topX = (halfHeight - offset) / slope
  if (Math.abs(leftY) <= halfHeight) candidates.push({ x: -halfWidth, y: leftY })
  if (Math.abs(rightY) <= halfHeight) candidates.push({ x: halfWidth, y: rightY })
  if (Math.abs(bottomX) < halfWidth) candidates.push({ x: bottomX, y: -halfHeight })
  if (Math.abs(topX) < halfWidth) candidates.push({ x: topX, y: halfHeight })
  const start = candidates[0]
  const end = candidates[1]
  return start && end ? [start, end] : null
}

function buildDiamond(bounds: BackgroundBounds): BackgroundPath[] {
  const paths: BackgroundPath[] = []
  const halfWidth = bounds.width * 0.5
  const halfHeight = bounds.height * 0.5
  const span = halfWidth + halfHeight
  for (let slope = -1; slope <= 1; slope += 2) {
    for (let offset = -span + bounds.spacing * 0.5; offset < span; offset += bounds.spacing) {
      const endpoints = diagonalEndpoints(offset, slope, halfWidth, halfHeight)
      if (endpoints) paths.push(sampleSegment(endpoints[0], endpoints[1], bounds.sampleStep))
    }
  }
  return paths
}

function buildOrbit(bounds: BackgroundBounds): BackgroundPath[] {
  const paths: BackgroundPath[] = []
  const halfWidth = bounds.width * 0.5
  const halfHeight = bounds.height * 0.5
  const center: BackgroundPoint = { x: halfWidth * 0.24, y: -halfHeight * 0.12 }
  const radiusX = halfWidth - Math.abs(center.x)
  const radiusY = halfHeight - Math.abs(center.y)
  for (let ring = 1; ring <= 6; ring += 1) {
    const points: BackgroundPoint[] = []
    const scale = ring / 6
    const circumference = Math.PI * 2 * Math.sqrt((radiusX * radiusX + radiusY * radiusY) * 0.5) * scale
    const segments = Math.max(32, Math.ceil(circumference / bounds.sampleStep))
    for (let index = 0; index <= segments; index += 1) {
      const angle = index / segments * Math.PI * 2
      points.push({
        x: center.x + Math.cos(angle) * radiusX * scale,
        y: center.y + Math.sin(angle) * radiusY * scale
      })
    }
    paths.push(points)
  }
  return paths
}

function buildDepth(bounds: BackgroundBounds): BackgroundPath[] {
  const paths: BackgroundPath[] = []
  const halfWidth = bounds.width * 0.5
  const halfHeight = bounds.height * 0.5
  const frameCorners: BackgroundPoint[][] = []
  for (let frame = 0; frame < 6; frame += 1) {
    const scale = 1 - frame * 0.13
    const offsetY = -halfHeight * frame * 0.018
    const corners: BackgroundPoint[] = [
      { x: -halfWidth * scale, y: -halfHeight * scale + offsetY },
      { x: halfWidth * scale, y: -halfHeight * scale + offsetY },
      { x: halfWidth * scale, y: halfHeight * scale + offsetY },
      { x: -halfWidth * scale, y: halfHeight * scale + offsetY }
    ]
    frameCorners.push(corners)
    paths.push(samplePolyline(corners, bounds.sampleStep, true))
  }
  const outer = frameCorners[0]
  const inner = frameCorners[5]
  if (outer && inner) {
    for (let corner = 0; corner < 4; corner += 1) {
      const start = outer[corner]
      const end = inner[corner]
      if (start && end) paths.push(sampleSegment(start, end, bounds.sampleStep))
    }
  }
  return paths
}

export function buildBackgroundPaths(pattern: BackgroundPattern, bounds: BackgroundBounds): readonly BackgroundPath[] {
  switch (pattern) {
    case 'lattice': return buildLattice(bounds)
    case 'diamond': return buildDiamond(bounds)
    case 'orbit': return buildOrbit(bounds)
    case 'depth': return buildDepth(bounds)
    default: {
      const unreachable: never = pattern
      return unreachable
    }
  }
}
