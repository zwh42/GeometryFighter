export interface TouchPoint {
  id: number
  x: number
  y: number
}

export interface StickState {
  id: number
  active: boolean
  base: { x: number; y: number }
  knob: { x: number; y: number }
}

export interface TouchVectors {
  move: { x: number; y: number }
  aim: { x: number; y: number }
  engaged: boolean
}

export interface ControlBounds {
  halfWidth: number
  halfHeight: number
}

export function controlBounds(worldWidth: number, worldHeight: number, canvasWidth: number, canvasHeight: number, unitsPerPixel: number): ControlBounds {
  return {
    halfWidth: Math.min(worldWidth, canvasWidth * unitsPerPixel) * 0.5,
    halfHeight: Math.min(worldHeight, canvasHeight * unitsPerPixel) * 0.5
  }
}

function makeStick(): StickState {
  return { id: -1, active: false, base: { x: 0, y: 0 }, knob: { x: 0, y: 0 } }
}

function vectorFor(stick: StickState, unitsPerPixel: number): { x: number; y: number } {
  if (!stick.active) return { x: 0, y: 0 }
  const dx = stick.knob.x - stick.base.x
  const dy = stick.knob.y - stick.base.y
  const magnitude = Math.sqrt(dx * dx + dy * dy)
  if (magnitude === 0) return { x: 0, y: 0 }
  const strength = Math.max(0, Math.min(1, (magnitude - 7 * unitsPerPixel) / (35 * unitsPerPixel)))
  return { x: dx / magnitude * strength, y: dy / magnitude * strength }
}

export class TouchControls {
  readonly left = makeStick()
  readonly right = makeStick()
  singleHanded = true
  unitsPerPixel = 1

  resize(width: number, height: number, unitsPerPixel = 1): void {
    const nextSingleHanded = height >= width
    if (nextSingleHanded !== this.singleHanded) {
      this.release(this.left)
      this.release(this.right)
    }
    this.singleHanded = nextSingleHanded
    this.unitsPerPixel = Math.max(0.01, unitsPerPixel)
  }

  start(point: TouchPoint): void {
    if (this.singleHanded) {
      if (point.y < 0 && !this.left.active) this.activate(this.left, point)
    } else if (point.x < 0 && !this.left.active) {
      this.activate(this.left, point)
    } else if (point.x >= 0 && !this.right.active) {
      this.activate(this.right, point)
    }
  }

  move(point: TouchPoint): void {
    this.moveStick(this.left, point)
    if (!this.singleHanded) this.moveStick(this.right, point)
  }

  end(id: number): void {
    if (this.left.id === id) this.release(this.left)
    if (this.right.id === id) this.release(this.right)
  }

  vectors(): TouchVectors {
    return {
      move: vectorFor(this.left, this.unitsPerPixel),
      aim: this.singleHanded ? { x: 0, y: 0 } : vectorFor(this.right, this.unitsPerPixel),
      engaged: this.left.active
    }
  }

  private activate(stick: StickState, point: TouchPoint): void {
    stick.id = point.id
    stick.active = true
    stick.base = { x: point.x, y: point.y }
    stick.knob = { x: point.x, y: point.y }
  }

  private moveStick(stick: StickState, point: TouchPoint): void {
    if (!stick.active || stick.id !== point.id) return
    const dx = point.x - stick.base.x
    const dy = point.y - stick.base.y
    const magnitude = Math.sqrt(dx * dx + dy * dy)
    if (magnitude === 0) {
      stick.knob = { ...stick.base }
      return
    }
    const reach = Math.min(48 * this.unitsPerPixel, magnitude)
    stick.knob.x = stick.base.x + dx / magnitude * reach
    stick.knob.y = stick.base.y + dy / magnitude * reach
  }

  private release(stick: StickState): void {
    stick.id = -1
    stick.active = false
    stick.knob = { ...stick.base }
  }
}
