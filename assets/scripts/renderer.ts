// Engine-free batched vector renderer. Every primitive is tessellated
// immediately into one preallocated interleaved vertex buffer
// (x, y, r, g, b, a) so a full combat frame uploads once and allocates
// nothing after warmup. The WebGL surface only pipes `data`/`vertexCount`
// to the GPU; this module stays pure so budgets can be unit-tested.

export interface VertexStats {
  vertices: number
  triangles: number
  segments: number
  fills: number
  grows: number
}

const FLOATS_PER_VERTEX = 6

interface Rgb {
  readonly r: number
  readonly g: number
  readonly b: number
}

const rgbCache = new Map<string, Rgb>()

function parseHex(hex: string): Rgb {
  const cached = rgbCache.get(hex)
  if (cached) return cached
  const value = hex.startsWith('#') ? hex.slice(1) : hex
  const number = Number.parseInt(value, 16)
  const rgb = { r: ((number >> 16) & 255) / 255, g: ((number >> 8) & 255) / 255, b: (number & 255) / 255 }
  rgbCache.set(hex, rgb)
  return rgb
}

export class VectorRenderer {
  data: Float32Array
  vertexCount = 0
  readonly stats: VertexStats = { vertices: 0, triangles: 0, segments: 0, fills: 0, grows: 0 }

  private red = 1
  private green = 1
  private blue = 1
  private alpha = 1
  private lineWidth = 1
  private readonly scratchPolyX: number[] = []
  private readonly scratchPolyY: number[] = []

  constructor(initialVertices = 1 << 17) {
    this.data = new Float32Array(initialVertices * FLOATS_PER_VERTEX)
  }

  get capacity(): number {
    return this.data.length / FLOATS_PER_VERTEX
  }

  begin(): void {
    this.vertexCount = 0
    this.stats.vertices = 0
    this.stats.triangles = 0
    this.stats.segments = 0
    this.stats.fills = 0
  }

  setColor(hex: string, alpha = 255): void {
    const rgb = parseHex(hex)
    this.red = rgb.r
    this.green = rgb.g
    this.blue = rgb.b
    this.alpha = alpha / 255
  }

  setAlpha(alpha: number): void {
    this.alpha = alpha
  }

  setWidth(width: number): void {
    this.lineWidth = Math.max(0.05, width)
  }

  segment(x1: number, y1: number, x2: number, y2: number): void {
    const dx = x2 - x1
    const dy = y2 - y1
    const length = Math.sqrt(dx * dx + dy * dy)
    if (length < 0.0001) return
    const half = this.lineWidth * 0.5
    const offsetX = -dy / length * half
    const offsetY = dx / length * half
    this.stats.segments += 1
    this.triangle(x1 + offsetX, y1 + offsetY, x2 + offsetX, y2 + offsetY, x2 - offsetX, y2 - offsetY)
    this.triangle(x1 + offsetX, y1 + offsetY, x2 - offsetX, y2 - offsetY, x1 - offsetX, y1 - offsetY)
  }

  disc(x: number, y: number, radius: number, quality = 10): void {
    this.stats.fills += 1
    for (let index = 0; index < quality; index += 1) {
      const a0 = index / quality * Math.PI * 2
      const a1 = (index + 1) / quality * Math.PI * 2
      this.triangle(
        x, y,
        x + Math.cos(a0) * radius, y + Math.sin(a0) * radius,
        x + Math.cos(a1) * radius, y + Math.sin(a1) * radius
      )
    }
  }

  ring(x: number, y: number, radius: number, quality = 0): void {
    const segments = quality > 0 ? quality : this.circleQuality(radius)
    for (let index = 0; index < segments; index += 1) {
      const a0 = index / segments * Math.PI * 2
      const a1 = (index + 1) / segments * Math.PI * 2
      this.segment(x + Math.cos(a0) * radius, y + Math.sin(a0) * radius, x + Math.cos(a1) * radius, y + Math.sin(a1) * radius)
    }
  }

  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void {
    const span = Math.abs(endAngle - startAngle)
    if (span < 0.0001) return
    const segments = Math.max(2, Math.min(this.circleQuality(radius), Math.ceil(span / (Math.PI * 2) * 32)))
    const step = (endAngle - startAngle) / segments
    for (let index = 0; index < segments; index += 1) {
      const a0 = startAngle + step * index
      this.segment(x + Math.cos(a0) * radius, y + Math.sin(a0) * radius, x + Math.cos(a0 + step) * radius, y + Math.sin(a0 + step) * radius)
    }
  }

  polygon(points: readonly number[], x = 0, y = 0, scale = 1, rotation = 0, fill = true, stroke = true): void {
    const count = points.length / 2
    if (count < 2) return
    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)
    const polyX = this.scratchPolyX
    const polyY = this.scratchPolyY
    polyX.length = count
    polyY.length = count
    for (let index = 0; index < count; index += 1) {
      const px = points[index * 2] * scale
      const py = points[index * 2 + 1] * scale
      polyX[index] = x + px * cos - py * sin
      polyY[index] = y + px * sin + py * cos
    }
    if (fill && count >= 3) {
      this.stats.fills += 1
      let centerX = 0
      let centerY = 0
      for (let index = 0; index < count; index += 1) {
        centerX += polyX[index]
        centerY += polyY[index]
      }
      centerX /= count
      centerY /= count
      for (let index = 0; index < count; index += 1) {
        const next = (index + 1) % count
        this.triangle(centerX, centerY, polyX[index], polyY[index], polyX[next], polyY[next])
      }
    }
    if (stroke) {
      for (let index = 0; index < count; index += 1) {
        const next = (index + 1) % count
        this.segment(polyX[index], polyY[index], polyX[next], polyY[next])
      }
    }
  }

  polyline(points: readonly number[], joints = false): void {
    const count = points.length / 2
    if (count < 2) return
    for (let index = 0; index + 1 < count; index += 1) {
      this.segment(points[index * 2], points[index * 2 + 1], points[index * 2 + 2], points[index * 2 + 3])
    }
    if (joints) for (let index = 0; index < count; index += 1) this.disc(points[index * 2], points[index * 2 + 1], this.lineWidth * 0.5, 6)
  }

  rectStroke(x: number, y: number, width: number, height: number): void {
    this.segment(x, y, x + width, y)
    this.segment(x + width, y, x + width, y + height)
    this.segment(x + width, y + height, x, y + height)
    this.segment(x, y + height, x, y)
  }

  rectFill(x: number, y: number, width: number, height: number): void {
    this.stats.fills += 1
    this.triangle(x, y, x + width, y, x + width, y + height)
    this.triangle(x, y, x + width, y + height, x, y + height)
  }

  private triangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
    if (this.vertexCount + 3 > this.capacity) this.grow()
    const data = this.data
    let cursor = this.vertexCount * FLOATS_PER_VERTEX
    const red = this.red
    const green = this.green
    const blue = this.blue
    const alpha = this.alpha
    data[cursor] = x1
    data[cursor + 1] = y1
    data[cursor + 2] = red
    data[cursor + 3] = green
    data[cursor + 4] = blue
    data[cursor + 5] = alpha
    cursor += FLOATS_PER_VERTEX
    data[cursor] = x2
    data[cursor + 1] = y2
    data[cursor + 2] = red
    data[cursor + 3] = green
    data[cursor + 4] = blue
    data[cursor + 5] = alpha
    cursor += FLOATS_PER_VERTEX
    data[cursor] = x3
    data[cursor + 1] = y3
    data[cursor + 2] = red
    data[cursor + 3] = green
    data[cursor + 4] = blue
    data[cursor + 5] = alpha
    this.vertexCount += 3
    this.stats.vertices += 3
    this.stats.triangles += 1
  }

  private grow(): void {
    this.stats.grows += 1
    const next = new Float32Array(Math.max(this.data.length * 2, (this.vertexCount + 3) * FLOATS_PER_VERTEX))
    next.set(this.data)
    this.data = next
  }

  private circleQuality(radius: number): number {
    return Math.max(10, Math.min(30, Math.round(radius * 0.9)))
  }
}
