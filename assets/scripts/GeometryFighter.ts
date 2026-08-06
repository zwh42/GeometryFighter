// allow: SIZE_OK — single Cocos scene component owns the immediate-mode presentation surface.
import {
  _decorator,
  Camera,
  Canvas,
  Color,
  Component,
  EventKeyboard,
  EventTouch,
  Graphics,
  Input,
  input,
  KeyCode,
  Label,
  Layers,
  Node,
  ResolutionPolicy,
  sys,
  UITransform,
  Vec2,
  view
} from 'cc'
import {
  GeometryWorld,
  clamp,
  length,
  normalized,
  weaponTier
} from './simulation'
import type { Ally, Bullet, ControlState, Enemy, Supply, Vector, WorldEvent } from './simulation'

const { ccclass } = _decorator
const TUTORIAL_HOLD = 3.5
const TUTORIAL_DURATION = 4.5

interface StickState {
  id: number
  active: boolean
  base: Vector
  knob: Vector
}

interface Particle extends Vector {
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  drag: number
}

interface Ripple extends Vector {
  radius: number
  speed: number
  life: number
  maxLife: number
  strength: number
  color: string
}

interface TrailPoint extends Vector {
  life: number
}

interface FloatingText extends Vector {
  text: string
  color: string
  life: number
}

interface Star extends Vector {
  size: number
  phase: number
}

interface FrequencyParam {
  setValueAtTime(value: number, time: number): void
  exponentialRampToValueAtTime(value: number, time: number): void
}

interface AudioNodeLike {
  connect(destination: unknown): void
}

interface OscillatorLike extends AudioNodeLike {
  frequency: FrequencyParam
  type: string
  start(time: number): void
  stop(time: number): void
}

interface GainLike extends AudioNodeLike {
  gain: FrequencyParam
}

interface AudioContextLike {
  currentTime: number
  destination: unknown
  state?: string
  resume?(): Promise<void>
  createOscillator(): OscillatorLike
  createGain(): GainLike
}

interface MiniGamePlatform {
  createWebAudioContext?(): AudioContextLike
}

class Synth {
  private context: AudioContextLike | null = null

  unlock(): void {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume?.()
      return
    }
    const platform = (globalThis as { wx?: MiniGamePlatform }).wx
    if (!platform?.createWebAudioContext) return
    this.context = platform.createWebAudioContext()
  }

  tone(frequency: number, duration: number, volume: number, type: string, slide = 1): void {
    const context = this.context
    if (!context) return
    const start = context.currentTime
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(25, frequency * slide), start + duration)
    gain.gain.setValueAtTime(Math.max(0.0001, volume), start)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(start)
    oscillator.stop(start + duration)
  }
}

@ccclass('GeometryFighter')
export class GeometryFighter extends Component {
  private readonly world = new GeometryWorld()
  private readonly synth = new Synth()
  private readonly controls: ControlState = {
    move: { x: 0, y: 0 },
    aim: { x: 0, y: 0 },
    start: false,
    pause: false
  }

  private readonly leftStick: StickState = this.makeStick()
  private readonly keys = new Set<KeyCode>()
  private readonly particles: Particle[] = []
  private readonly particlePool: Particle[] = []
  private readonly ripples: Ripple[] = []
  private readonly playerTrail: TrailPoint[] = []
  private readonly floatingTexts: FloatingText[] = []
  private readonly stars: Star[] = []
  private gridGlow!: Graphics
  private grid!: Graphics
  private effectGlow!: Graphics
  private effects!: Graphics
  private entitiesGlow!: Graphics
  private entities!: Graphics
  private controlsGraphics!: Graphics
  private scoreLabel!: Label
  private statusLabel!: Label
  private titleLabel!: Label
  private subtitleLabel!: Label
  private promptLabel!: Label
  private messageLabel!: Label
  private messageTimer = 0
  private time = 0
  private highScoreClock = 0
  private lastPlayerPosition: Vector = { x: 0, y: 0 }
  private readonly warpOutput: Vector = { x: 0, y: 0 }
  private particleReplaceCursor = 0

  protected override onLoad(): void {
    view.setDesignResolutionSize(720, 1280, ResolutionPolicy.FIXED_WIDTH)
    this.ensureSceneCamera()
    this.createRenderLayers()
    this.createInterface()
    this.populateStars()
    this.world.highScore = Number(sys.localStorage.getItem('geometry-fighter-high-score') || 0)
    this.resizeWorld()
    this.bindInput()
    view.on('design-resolution-changed', this.resizeWorld, this)
  }

  protected override onDestroy(): void {
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this)
    input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this)
    input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this)
    input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this)
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this)
    input.off(Input.EventType.KEY_UP, this.onKeyUp, this)
    view.off('design-resolution-changed', this.resizeWorld, this)
  }

  override update(dt: number): void {
    this.time += dt
    this.updateKeyboard()
    this.world.update(dt, this.controls)
    this.controls.start = false
    this.controls.pause = false
    this.processWorldEvents(this.world.consumeEvents())
    this.updateVisualState(Math.min(dt, 0.034))
    this.render()
    this.updateInterface()
    this.highScoreClock -= dt
    if (this.highScoreClock <= 0 && this.world.highScore > Number(sys.localStorage.getItem('geometry-fighter-high-score') || 0)) {
      sys.localStorage.setItem('geometry-fighter-high-score', String(this.world.highScore))
      this.highScoreClock = 2
    }
  }

  private makeStick(): StickState {
    return { id: -1, active: false, base: { x: 0, y: 0 }, knob: { x: 0, y: 0 } }
  }

  private ensureSceneCamera(): void {
    if (!this.node.getComponent(Canvas)) this.node.addComponent(Canvas)
    const transform = this.node.getComponent(UITransform) || this.node.addComponent(UITransform)
    transform.setContentSize(720, 1280)
    this.node.layer = Layers.Enum.UI_2D
    let cameraNode = this.node.getChildByName('Camera')
    if (!cameraNode) {
      cameraNode = new Node('Camera')
      this.node.addChild(cameraNode)
    }
    cameraNode.layer = Layers.Enum.DEFAULT
    cameraNode.setPosition(0, 0, 1000)
    const camera = cameraNode.getComponent(Camera) || cameraNode.addComponent(Camera)
    camera.projection = Camera.ProjectionType.ORTHO
    camera.orthoHeight = 640
    camera.visibility = Layers.Enum.UI_2D
    camera.clearColor = new Color(1, 3, 13, 255)
  }

  private createRenderLayers(): void {
    this.gridGlow = this.createGraphics('Grid Glow')
    this.grid = this.createGraphics('Grid')
    this.effectGlow = this.createGraphics('Effect Glow')
    this.effects = this.createGraphics('Effects')
    this.entitiesGlow = this.createGraphics('Entity Glow')
    this.entities = this.createGraphics('Entities')
    this.controlsGraphics = this.createGraphics('Controls')
  }

  private createGraphics(name: string): Graphics {
    const layer = new Node(name)
    layer.layer = Layers.Enum.UI_2D
    this.node.addChild(layer)
    const transform = layer.addComponent(UITransform)
    transform.setContentSize(720, 1280)
    const graphics = layer.addComponent(Graphics)
    graphics.lineJoin = Graphics.LineJoin.ROUND
    graphics.lineCap = Graphics.LineCap.ROUND
    return graphics
  }

  private createInterface(): void {
    this.scoreLabel = this.createLabel('Score', 23, '#bcff49')
    this.scoreLabel.horizontalAlign = Label.HorizontalAlign.LEFT
    this.statusLabel = this.createLabel('Status', 18, '#fff36a')
    this.statusLabel.horizontalAlign = Label.HorizontalAlign.RIGHT
    this.titleLabel = this.createLabel('Title', 74, '#eafbff')
    this.titleLabel.string = 'GEOMETRY\nFIGHTER'
    this.titleLabel.lineHeight = 72
    this.subtitleLabel = this.createLabel('Subtitle', 22, '#70ecff')
    this.subtitleLabel.string = '竖屏单手 · 移动即射击 · 保持倍率'
    this.promptLabel = this.createLabel('Prompt', 20, '#d6ff4f')
    this.messageLabel = this.createLabel('Message', 32, '#ffffff')
    this.messageLabel.node.active = false
  }

  private createLabel(name: string, fontSize: number, hex: string): Label {
    const node = new Node(name)
    node.layer = Layers.Enum.UI_2D
    this.node.addChild(node)
    const transform = node.addComponent(UITransform)
    transform.setContentSize(900, 160)
    const label = node.addComponent(Label)
    label.fontSize = fontSize
    label.lineHeight = fontSize + 4
    label.color = this.color(hex)
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    label.enableOutline = true
    label.outlineColor = new Color(0, 20, 42, 255)
    label.outlineWidth = 2
    return label
  }

  private populateStars(): void {
    let value = 0x1836ef91
    for (let index = 0; index < 95; index += 1) {
      value = (value * 1664525 + 1013904223) >>> 0
      const rx = value / 0x100000000
      value = (value * 1664525 + 1013904223) >>> 0
      const ry = value / 0x100000000
      this.stars.push({ x: rx - 0.5, y: ry - 0.5, size: 0.7 + (index % 4) * 0.35, phase: index * 1.717 })
    }
  }

  private bindInput(): void {
    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this)
    input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this)
    input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this)
    input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this)
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this)
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this)
  }

  private resizeWorld(): void {
    const size = view.getVisibleSize()
    this.world.resize(size.width, size.height)
    const transform = this.node.getComponent(UITransform)
    transform?.setContentSize(size.width, size.height)
    for (const child of this.node.children) {
      if (child.getComponent(Graphics)) child.getComponent(UITransform)?.setContentSize(size.width, size.height)
    }
    const camera = this.node.getChildByName('Camera')?.getComponent(Camera)
    if (camera) camera.orthoHeight = size.height * 0.5
  }

  private touchPosition(event: EventTouch): Vector {
    const location = event.getUILocation(new Vec2())
    const size = view.getVisibleSize()
    return { x: location.x - size.width * 0.5, y: location.y - size.height * 0.5 }
  }

  private onTouchStart(event: EventTouch): void {
    this.synth.unlock()
    this.controls.start = true
    const point = this.touchPosition(event)
    const id = event.getID() ?? -1
    if (point.y < 0 && !this.leftStick.active) this.activateStick(this.leftStick, id, point)
    this.syncSticks()
  }

  private onTouchMove(event: EventTouch): void {
    const point = this.touchPosition(event)
    const id = event.getID() ?? -1
    this.moveStick(this.leftStick, id, point)
    this.syncSticks()
  }

  private onTouchEnd(event: EventTouch): void {
    const id = event.getID() ?? -1
    if (this.leftStick.id === id) this.releaseStick(this.leftStick)
    this.syncSticks()
  }

  private activateStick(stick: StickState, id: number, point: Vector): void {
    stick.id = id
    stick.active = true
    stick.base = { ...point }
    stick.knob = { ...point }
  }

  private moveStick(stick: StickState, id: number, point: Vector): void {
    if (!stick.active || stick.id !== id) return
    const dx = point.x - stick.base.x
    const dy = point.y - stick.base.y
    const direction = normalized(dx, dy)
    const reach = Math.min(58, length(dx, dy))
    stick.knob.x = stick.base.x + direction.x * reach
    stick.knob.y = stick.base.y + direction.y * reach
  }

  private releaseStick(stick: StickState): void {
    stick.id = -1
    stick.active = false
    stick.knob = { ...stick.base }
  }

  private syncSticks(): void {
    this.controls.move = this.stickVector(this.leftStick)
  }

  private stickVector(stick: StickState): Vector {
    if (!stick.active) return { x: 0, y: 0 }
    const dx = stick.knob.x - stick.base.x
    const dy = stick.knob.y - stick.base.y
    const direction = normalized(dx, dy)
    const strength = clamp((length(dx, dy) - 8) / 42, 0, 1)
    return { x: direction.x * strength, y: direction.y * strength }
  }

  private onKeyDown(event: EventKeyboard): void {
    this.keys.add(event.keyCode)
    if (event.keyCode === KeyCode.ENTER) this.controls.start = true
    if (event.keyCode === KeyCode.KEY_P || event.keyCode === KeyCode.ESCAPE) this.controls.pause = true
  }

  private onKeyUp(event: EventKeyboard): void {
    this.keys.delete(event.keyCode)
  }

  private updateKeyboard(): void {
    const moveX = Number(this.keys.has(KeyCode.KEY_D) || this.keys.has(KeyCode.ARROW_RIGHT)) - Number(this.keys.has(KeyCode.KEY_A) || this.keys.has(KeyCode.ARROW_LEFT))
    const moveY = Number(this.keys.has(KeyCode.KEY_W) || this.keys.has(KeyCode.ARROW_UP)) - Number(this.keys.has(KeyCode.KEY_S) || this.keys.has(KeyCode.ARROW_DOWN))
    const aimX = Number(this.keys.has(KeyCode.KEY_L)) - Number(this.keys.has(KeyCode.KEY_J))
    const aimY = Number(this.keys.has(KeyCode.KEY_I)) - Number(this.keys.has(KeyCode.KEY_K))
    if (moveX || moveY) this.controls.move = normalized(moveX, moveY)
    else if (!this.leftStick.active) this.controls.move = { x: 0, y: 0 }
    if (aimX || aimY) this.controls.aim = normalized(aimX, aimY)
    else this.controls.aim = { x: 0, y: 0 }
  }

  private processWorldEvents(events: WorldEvent[]): void {
    for (const event of events) {
      if (event.kind === 'shoot') {
        this.spawnBurst(event.x, event.y, '#fff36a', Math.min(4, event.amount), 70)
        this.ripples.push({ x: event.x, y: event.y, radius: 6, speed: 120, life: 0.22, maxLife: 0.22, strength: 5, color: event.color })
        this.synth.tone(360 + event.amount * 65, 0.035, 0.018, 'square', 1.7)
      } else if (event.kind === 'kill') {
        this.spawnBurst(event.x, event.y, event.color, 26, 235)
        this.ripples.push({ x: event.x, y: event.y, radius: 10, speed: 270, life: 0.65, maxLife: 0.65, strength: 24, color: event.color })
        this.floatingTexts.push({ x: event.x, y: event.y, text: event.text, color: event.color, life: 0.72 })
        this.synth.tone(90, 0.1, 0.04, 'sawtooth', 0.42)
      } else if (event.kind === 'death') {
        this.spawnBurst(event.x, event.y, '#ffffff', 90, 360)
        this.ripples.push({ x: event.x, y: event.y, radius: 15, speed: 560, life: 0.9, maxLife: 0.9, strength: 44, color: '#ff5679' })
        this.showMessage(event.text, '#ff6c7f', 1)
        this.synth.tone(210, 0.42, 0.1, 'sawtooth', 0.08)
      } else if (event.kind === 'reward' || event.kind === 'wave') {
        this.showMessage(event.text, event.color, 1.1)
        this.synth.tone(event.kind === 'reward' ? 760 : 430, 0.18, 0.05, 'sine', 1.7)
      } else if (event.kind === 'blackhole') {
        this.spawnBurst(event.x, event.y, '#ff4fd8', 4, 100)
      } else if (event.kind === 'supply') {
        if (event.text) this.showMessage(event.text, event.color, 1.15)
        this.spawnBurst(event.x, event.y, event.color, event.text ? 18 : 6, event.text ? 160 : 90)
      } else if (event.kind === 'super') {
        this.showMessage(event.text, event.color, 1.4)
        this.spawnBurst(event.x, event.y, event.color, 56, 310)
        this.ripples.push({ x: event.x, y: event.y, radius: 10, speed: 360, life: 0.75, maxLife: 0.75, strength: 30, color: event.color })
        this.synth.tone(620, 0.24, 0.06, 'square', 1.85)
      }
    }
  }

  private spawnBurst(x: number, y: number, color: string, count: number, speed: number): void {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2
      const velocity = speed * (0.25 + Math.random() * 0.75)
      const life = 0.25 + Math.random() * 0.75
      const replacing = this.particles.length >= 850
      if (replacing) this.particleReplaceCursor %= this.particles.length
      const particle = replacing
        ? this.particles[this.particleReplaceCursor]
        : this.particlePool.pop() ?? { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 1, color: '#ffffff', drag: 1 }
      particle.x = x
      particle.y = y
      particle.vx = Math.cos(angle) * velocity
      particle.vy = Math.sin(angle) * velocity
      particle.life = life
      particle.maxLife = life
      particle.size = 1.2 + Math.random() * 3.6
      particle.color = color
      particle.drag = 1.5 + Math.random() * 3
      if (replacing) this.particleReplaceCursor += 1
      else this.particles.push(particle)
    }
  }

  private showMessage(text: string, color: string, duration: number): void {
    this.messageLabel.string = text
    this.messageLabel.color = this.color(color)
    this.messageLabel.node.active = true
    this.messageTimer = duration
  }

  private updateVisualState(dt: number): void {
    let write = 0
    for (const particle of this.particles) {
      particle.x += particle.vx * dt
      particle.y += particle.vy * dt
      const drag = Math.exp(-particle.drag * dt)
      particle.vx *= drag
      particle.vy *= drag
      particle.life -= dt
      if (particle.life > 0) {
        this.particles[write] = particle
        write += 1
      } else {
        this.particlePool.push(particle)
      }
    }
    this.particles.length = write
    if (this.particleReplaceCursor >= write) this.particleReplaceCursor = 0

    write = 0
    for (const ripple of this.ripples) {
      ripple.radius += ripple.speed * dt
      ripple.life -= dt
      if (ripple.life > 0) {
        this.ripples[write] = ripple
        write += 1
      }
    }
    this.ripples.length = write

    write = 0
    for (const text of this.floatingTexts) {
      text.y += 30 * dt
      text.life -= dt
      if (text.life > 0) {
        this.floatingTexts[write] = text
        write += 1
      }
    }
    this.floatingTexts.length = write
    if (this.world.player.alive && this.world.state === 'playing') {
      const moved = length(this.world.player.x - this.lastPlayerPosition.x, this.world.player.y - this.lastPlayerPosition.y)
      if (moved > 2) this.playerTrail.push({ x: this.world.player.x, y: this.world.player.y, life: 0.34 })
      this.lastPlayerPosition.x = this.world.player.x
      this.lastPlayerPosition.y = this.world.player.y
    }
    for (const point of this.playerTrail) point.life -= dt
    while (this.playerTrail.length > 30 || this.playerTrail[0]?.life <= 0) this.playerTrail.shift()
    this.messageTimer -= dt
    if (this.messageTimer <= 0) this.messageLabel.node.active = false
  }

  private render(): void {
    this.renderGrid()
    this.renderEffects()
    this.renderEntities()
    this.renderControls()
  }

  private renderGrid(): void {
    const glow = this.gridGlow
    const sharp = this.grid
    glow.clear()
    sharp.clear()
    const width = this.world.width
    const height = this.world.height
    glow.fillColor = new Color(0, 2, 13, 255)
    glow.rect(-width * 0.5, -height * 0.5, width, height)
    glow.fill()
    for (const star of this.stars) {
      const alpha = 32 + Math.floor((Math.sin(this.time * 1.8 + star.phase) * 0.5 + 0.5) * 70)
      sharp.fillColor = new Color(63, 137, 190, alpha)
      sharp.circle(star.x * width, star.y * height, star.size)
      sharp.fill()
    }
    const spacing = 42
    this.drawGridLines(glow, spacing, 7, new Color(0, 91, 156, 23))
    this.drawGridLines(sharp, spacing, 1.15, new Color(21, 149, 221, 72))
    glow.lineWidth = 14
    glow.strokeColor = new Color(69, 191, 255, 44)
    glow.rect(-width * 0.5 + 8, -height * 0.5 + 8, width - 16, height - 16)
    glow.stroke()
    sharp.lineWidth = 2.2
    sharp.strokeColor = new Color(218, 250, 255, 230)
    sharp.rect(-width * 0.5 + 8, -height * 0.5 + 8, width - 16, height - 16)
    sharp.stroke()
  }

  private drawGridLines(graphics: Graphics, spacing: number, lineWidth: number, color: Color): void {
    const halfWidth = this.world.width * 0.5
    const halfHeight = this.world.height * 0.5
    const columns = Math.ceil(this.world.width / spacing) + 2
    const rows = Math.ceil(this.world.height / spacing) + 2
    graphics.lineWidth = lineWidth
    graphics.strokeColor = color
    for (let column = -Math.floor(columns / 2); column <= Math.ceil(columns / 2); column += 1) {
      const x = column * spacing
      for (let row = -Math.floor(rows / 2); row <= Math.ceil(rows / 2); row += 1) {
        const y = row * spacing
        const point = this.warpPoint(x, y)
        if (row === -Math.floor(rows / 2)) graphics.moveTo(point.x, point.y)
        else graphics.lineTo(point.x, point.y)
      }
    }
    for (let row = -Math.floor(rows / 2); row <= Math.ceil(rows / 2); row += 1) {
      const y = row * spacing
      for (let column = -Math.floor(columns / 2); column <= Math.ceil(columns / 2); column += 1) {
        const x = column * spacing
        const point = this.warpPoint(x, y)
        if (column === -Math.floor(columns / 2)) graphics.moveTo(point.x, point.y)
        else graphics.lineTo(point.x, point.y)
      }
    }
    graphics.stroke()
    graphics.lineWidth = lineWidth * 0.8
    graphics.strokeColor = new Color(color.r, color.g, color.b, Math.min(255, color.a * 1.35))
    graphics.rect(-halfWidth, -halfHeight, this.world.width, this.world.height)
    graphics.stroke()
  }

  private warpPoint(x: number, y: number): Vector {
    let warpedX = x
    let warpedY = y
    for (const ripple of this.ripples) {
      const dx = x - ripple.x
      const dy = y - ripple.y
      const distance = Math.max(1, length(dx, dy))
      const band = Math.abs(distance - ripple.radius)
      if (band < 90) {
        const fade = ripple.life / ripple.maxLife
        const force = Math.sin((1 - band / 90) * Math.PI) * ripple.strength * fade
        warpedX += dx / distance * force
        warpedY += dy / distance * force
      }
    }
    for (const enemy of this.world.enemies) {
      if (enemy.dead || enemy.kind !== 'blackhole') continue
      const dx = enemy.x - x
      const dy = enemy.y - y
      const distance = Math.max(20, length(dx, dy))
      if (distance < 290) {
        const force = (1 - distance / 290) * 38 * enemy.mass
        warpedX += dx / distance * force
        warpedY += dy / distance * force
      }
    }
    this.warpOutput.x = warpedX
    this.warpOutput.y = warpedY
    return this.warpOutput
  }

  private renderEffects(): void {
    const glow = this.effectGlow
    const sharp = this.effects
    glow.clear()
    sharp.clear()
    for (const point of this.playerTrail) {
      const alpha = clamp(point.life / 0.34, 0, 1)
      glow.fillColor = new Color(70, 239, 255, Math.floor(alpha * 55))
      glow.circle(point.x, point.y, 10 * alpha)
      glow.fill()
    }
    for (const particle of this.particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1)
      const color = this.color(particle.color, Math.floor(alpha * 210))
      const tailScale = 0.035
      glow.lineWidth = particle.size * 3.2
      glow.strokeColor = this.color(particle.color, Math.floor(alpha * 42))
      glow.moveTo(particle.x, particle.y)
      glow.lineTo(particle.x - particle.vx * tailScale, particle.y - particle.vy * tailScale)
      glow.stroke()
      sharp.lineWidth = Math.max(1, particle.size * alpha)
      sharp.strokeColor = color
      sharp.moveTo(particle.x, particle.y)
      sharp.lineTo(particle.x - particle.vx * tailScale, particle.y - particle.vy * tailScale)
      sharp.stroke()
    }
    for (const ripple of this.ripples) {
      const alpha = clamp(ripple.life / ripple.maxLife, 0, 1)
      glow.lineWidth = 16 * alpha
      glow.strokeColor = this.color(ripple.color, Math.floor(alpha * 70))
      glow.circle(ripple.x, ripple.y, ripple.radius)
      glow.stroke()
      sharp.lineWidth = 2.4
      sharp.strokeColor = this.color(ripple.color, Math.floor(alpha * 230))
      sharp.circle(ripple.x, ripple.y, ripple.radius)
      sharp.stroke()
    }
    for (const bullet of this.world.bullets) this.drawBullet(glow, sharp, bullet)
  }

  private drawBullet(glow: Graphics, sharp: Graphics, bullet: Bullet): void {
    const tail = bullet.kind === 'missile' ? 30 : 20
    const x2 = bullet.x - Math.cos(bullet.angle) * tail
    const y2 = bullet.y - Math.sin(bullet.angle) * tail
    glow.lineWidth = 12
    glow.strokeColor = bullet.kind === 'missile' ? new Color(255, 137, 42, 70) : new Color(255, 239, 73, 55)
    glow.moveTo(bullet.x, bullet.y)
    glow.lineTo(x2, y2)
    glow.stroke()
    sharp.lineWidth = 2.8
    sharp.strokeColor = new Color(255, 253, 215, 255)
    sharp.moveTo(bullet.x, bullet.y)
    sharp.lineTo(x2, y2)
    sharp.stroke()
    if (bullet.kind === 'missile') {
      sharp.fillColor = new Color(255, 252, 226, 255)
      this.polygon(sharp, bullet.x, bullet.y, 7, 3, bullet.angle, true)
    }
  }

  private renderEntities(): void {
    this.entitiesGlow.clear()
    this.entities.clear()
    for (const enemy of this.world.enemies) {
      if (enemy.dead) continue
      const spawnAlpha = enemy.spawnTimer > 0 ? 1 - enemy.spawnTimer / 0.45 : 1
      this.drawEnemy(this.entitiesGlow, enemy, true, spawnAlpha)
      this.drawEnemy(this.entities, enemy, false, spawnAlpha)
    }
    for (const supply of this.world.supplies) {
      if (supply.dead) continue
      this.drawSupply(this.entitiesGlow, supply, true)
      this.drawSupply(this.entities, supply, false)
    }
    for (const ally of this.world.allies) {
      if (ally.life <= 0) continue
      this.drawAlly(this.entitiesGlow, ally, true)
      this.drawAlly(this.entities, ally, false)
    }
    if (this.world.player.alive) {
      const flicker = this.world.player.invulnerable > 0 && Math.floor(this.time * 14) % 2 === 0
      if (!flicker) {
        this.drawPlayer(this.entitiesGlow, true)
        this.drawPlayer(this.entities, false)
      }
    }
  }

  private drawPlayer(graphics: Graphics, glow: boolean): void {
    const player = this.world.player
    const color = glow ? new Color(92, 235, 255, 66) : new Color(232, 255, 255, 255)
    graphics.lineWidth = glow ? 13 : 2.6
    graphics.strokeColor = color
    const forward = { x: Math.cos(player.angle), y: Math.sin(player.angle) }
    const side = { x: -forward.y, y: forward.x }
    graphics.moveTo(player.x + forward.x * 19 - side.x * 10, player.y + forward.y * 19 - side.y * 10)
    graphics.lineTo(player.x + forward.x * 7 - side.x * 5, player.y + forward.y * 7 - side.y * 5)
    graphics.lineTo(player.x + forward.x * 1 - side.x * 12, player.y + forward.y * 1 - side.y * 12)
    graphics.lineTo(player.x - forward.x * 12 - side.x * 10, player.y - forward.y * 12 - side.y * 10)
    graphics.lineTo(player.x - forward.x * 5, player.y - forward.y * 5)
    graphics.lineTo(player.x - forward.x * 12 + side.x * 10, player.y - forward.y * 12 + side.y * 10)
    graphics.lineTo(player.x + forward.x * 1 + side.x * 12, player.y + forward.y * 1 + side.y * 12)
    graphics.lineTo(player.x + forward.x * 7 + side.x * 5, player.y + forward.y * 7 + side.y * 5)
    graphics.lineTo(player.x + forward.x * 19 + side.x * 10, player.y + forward.y * 19 + side.y * 10)
    graphics.stroke()
    graphics.lineWidth = glow ? 8 : 1.4
    graphics.moveTo(player.x + forward.x * 7 - side.x * 5, player.y + forward.y * 7 - side.y * 5)
    graphics.lineTo(player.x - forward.x * 5, player.y - forward.y * 5)
    graphics.lineTo(player.x + forward.x * 7 + side.x * 5, player.y + forward.y * 7 + side.y * 5)
    graphics.stroke()
    if (!glow) {
      graphics.strokeColor = new Color(93, 255, 186, 255)
      graphics.moveTo(player.x - forward.x * 8 + side.x * 5, player.y - forward.y * 8 + side.y * 5)
      graphics.lineTo(player.x - forward.x * 18, player.y - forward.y * 18)
      graphics.lineTo(player.x - forward.x * 8 - side.x * 5, player.y - forward.y * 8 - side.y * 5)
      graphics.stroke()
    }
  }

  private drawAlly(graphics: Graphics, ally: Ally, glow: boolean): void {
    const forward = { x: Math.cos(ally.angle), y: Math.sin(ally.angle) }
    const side = { x: -forward.y, y: forward.x }
    graphics.lineWidth = glow ? 10 : 1.8
    graphics.strokeColor = glow ? new Color(67, 246, 255, 62) : new Color(176, 255, 255, 255)
    graphics.circle(ally.x, ally.y, 5.5)
    graphics.stroke()
    graphics.moveTo(ally.x + forward.x * 12, ally.y + forward.y * 12)
    graphics.lineTo(ally.x + forward.x * 3 + side.x * 7, ally.y + forward.y * 3 + side.y * 7)
    graphics.lineTo(ally.x - forward.x * 7 + side.x * 4, ally.y - forward.y * 7 + side.y * 4)
    graphics.moveTo(ally.x + forward.x * 3 - side.x * 7, ally.y + forward.y * 3 - side.y * 7)
    graphics.lineTo(ally.x + forward.x * 12, ally.y + forward.y * 12)
    graphics.lineTo(ally.x - forward.x * 7 - side.x * 4, ally.y - forward.y * 7 - side.y * 4)
    graphics.stroke()
  }

  private drawSupply(graphics: Graphics, supply: Supply, glow: boolean): void {
    const alpha = supply.spawnTimer > 0 ? 1 - supply.spawnTimer / 0.6 : 1
    const rotation = this.time * (glow ? 0.65 : -0.85)
    graphics.lineWidth = glow ? 13 : 2.2
    graphics.strokeColor = glow ? new Color(188, 255, 73, Math.floor(alpha * 68)) : new Color(219, 255, 149, Math.floor(alpha * 255))
    graphics.circle(supply.x, supply.y, supply.radius + 4)
    graphics.stroke()
    for (let orbit = 0; orbit < 2; orbit += 1) {
      const orbitRadius = supply.radius - 3 - orbit * 6
      const orbitStart = rotation * (orbit === 0 ? -1.8 : 2.1) + orbit * Math.PI * 0.5
      graphics.arc(supply.x, supply.y, orbitRadius, orbitStart, orbitStart + Math.PI * 1.25, false)
      graphics.stroke()
    }
    for (let ray = 0; ray < 4; ray += 1) {
      const rayAngle = ray * Math.PI * 0.5 - rotation * 0.4
      graphics.moveTo(supply.x + Math.cos(rayAngle) * (supply.radius + 8), supply.y + Math.sin(rayAngle) * (supply.radius + 8))
      graphics.lineTo(supply.x + Math.cos(rayAngle) * (supply.radius + 16), supply.y + Math.sin(rayAngle) * (supply.radius + 16))
    }
    graphics.stroke()
    graphics.strokeColor = glow ? new Color(245, 255, 224, Math.floor(alpha * 62)) : new Color(245, 255, 224, Math.floor(alpha * 255))
    if (supply.effect === 'detonation') {
      for (let spoke = 0; spoke < 6; spoke += 1) {
        const spokeAngle = rotation + spoke / 6 * Math.PI * 2
        graphics.moveTo(supply.x + Math.cos(spokeAngle) * 3, supply.y + Math.sin(spokeAngle) * 3)
        graphics.lineTo(supply.x + Math.cos(spokeAngle) * 11, supply.y + Math.sin(spokeAngle) * 11)
      }
      graphics.stroke()
    } else if (supply.effect === 'overload') {
      graphics.moveTo(supply.x + 2, supply.y + 11)
      graphics.lineTo(supply.x - 5, supply.y - 1)
      graphics.lineTo(supply.x + 1, supply.y - 1)
      graphics.lineTo(supply.x - 2, supply.y - 11)
      graphics.lineTo(supply.x + 7, supply.y + 3)
      graphics.lineTo(supply.x + 1, supply.y + 3)
      graphics.stroke()
    } else {
      this.polygon(graphics, supply.x, supply.y, 9, 3, rotation, false)
      graphics.circle(supply.x, supply.y, 2.6)
      graphics.fillColor = new Color(245, 255, 224, Math.floor(alpha * 255))
      graphics.fill()
    }
    if (!glow) {
      for (let index = 0; index < supply.maxHealth; index += 1) {
        const angle = index / supply.maxHealth * Math.PI * 2 - Math.PI * 0.5
        graphics.fillColor = index < supply.health ? new Color(245, 255, 224, 255) : new Color(245, 255, 224, 50)
        graphics.circle(supply.x + Math.cos(angle) * (supply.radius + 8), supply.y + Math.sin(angle) * (supply.radius + 8), 2)
        graphics.fill()
      }
    }
  }

  private drawEnemy(graphics: Graphics, enemy: Enemy, glow: boolean, alpha: number): void {
    const colorHex = this.world.enemyColor(enemy.kind)
    graphics.strokeColor = this.color(colorHex, Math.floor(alpha * (glow ? 70 : 245)))
    graphics.fillColor = this.color(colorHex, Math.floor(alpha * (glow ? 22 : 35)))
    graphics.lineWidth = glow ? 12 : 2.4
    switch (enemy.kind) {
      case 'wanderer':
        for (let arm = 0; arm < 4; arm += 1) {
          const angle = enemy.angle + arm * Math.PI * 0.5
          const sideAngle = angle - Math.PI * 0.5
          graphics.moveTo(enemy.x + Math.cos(angle) * 2, enemy.y + Math.sin(angle) * 2)
          graphics.lineTo(enemy.x + Math.cos(angle) * enemy.radius * 0.42 + Math.cos(sideAngle) * enemy.radius * 0.32, enemy.y + Math.sin(angle) * enemy.radius * 0.42 + Math.sin(sideAngle) * enemy.radius * 0.32)
          graphics.lineTo(enemy.x + Math.cos(angle) * enemy.radius + Math.cos(sideAngle) * enemy.radius * 0.08, enemy.y + Math.sin(angle) * enemy.radius + Math.sin(sideAngle) * enemy.radius * 0.08)
          graphics.lineTo(enemy.x + Math.cos(angle) * enemy.radius * 0.58 - Math.cos(sideAngle) * enemy.radius * 0.2, enemy.y + Math.sin(angle) * enemy.radius * 0.58 - Math.sin(sideAngle) * enemy.radius * 0.2)
        }
        graphics.stroke()
        return
      case 'grunt':
        this.polygon(graphics, enemy.x, enemy.y, enemy.radius, 4, enemy.angle + Math.PI * 0.25, true)
        if (!glow) {
          const forward = { x: Math.cos(enemy.angle), y: Math.sin(enemy.angle) }
          const side = { x: -forward.y, y: forward.x }
          graphics.moveTo(enemy.x - forward.x * enemy.radius * 0.7, enemy.y - forward.y * enemy.radius * 0.7)
          graphics.lineTo(enemy.x + forward.x * enemy.radius * 0.7, enemy.y + forward.y * enemy.radius * 0.7)
          graphics.moveTo(enemy.x - side.x * enemy.radius * 0.7, enemy.y - side.y * enemy.radius * 0.7)
          graphics.lineTo(enemy.x + side.x * enemy.radius * 0.7, enemy.y + side.y * enemy.radius * 0.7)
          graphics.stroke()
        }
        return
      case 'weaver':
        this.polygon(graphics, enemy.x, enemy.y, enemy.radius, 4, enemy.angle, true)
        if (!glow) this.polygon(graphics, enemy.x, enemy.y, enemy.radius * 0.72, 4, enemy.angle + Math.PI * 0.25, false)
        return
      case 'spinner':
        this.polygon(graphics, enemy.x, enemy.y, enemy.radius, 4, enemy.angle, true)
        if (!glow) {
          const forward = { x: Math.cos(enemy.angle + Math.PI * 0.25), y: Math.sin(enemy.angle + Math.PI * 0.25) }
          const side = { x: -forward.y, y: forward.x }
          graphics.moveTo(enemy.x - forward.x * enemy.radius, enemy.y - forward.y * enemy.radius)
          graphics.lineTo(enemy.x + forward.x * enemy.radius, enemy.y + forward.y * enemy.radius)
          graphics.moveTo(enemy.x - side.x * enemy.radius, enemy.y - side.y * enemy.radius)
          graphics.lineTo(enemy.x + side.x * enemy.radius, enemy.y + side.y * enemy.radius)
          graphics.stroke()
        }
        return
      case 'snake':
        graphics.strokeColor = glow ? new Color(67, 246, 255, Math.floor(alpha * 70)) : new Color(67, 246, 255, Math.floor(alpha * 245))
        this.polygon(graphics, enemy.x, enemy.y, enemy.radius, 3, enemy.angle, true)
        graphics.strokeColor = this.color(colorHex, Math.floor(alpha * (glow ? 70 : 245)))
        for (let index = enemy.segments.length - 1; index >= 0; index -= 1) {
          const segment = enemy.segments[index]
          const radius = 7 + (enemy.segments.length - index) * 0.35
          this.polygon(graphics, segment.x, segment.y, radius, 4, segment.angle + Math.PI * 0.25, index % 2 === 0)
        }
        return
      case 'repulsar':
        {
          const forward = { x: Math.cos(enemy.angle), y: Math.sin(enemy.angle) }
          const side = { x: -forward.y, y: forward.x }
          graphics.moveTo(enemy.x + forward.x * enemy.radius, enemy.y + forward.y * enemy.radius)
          graphics.lineTo(enemy.x + forward.x * enemy.radius * 0.15 + side.x * enemy.radius * 0.62, enemy.y + forward.y * enemy.radius * 0.15 + side.y * enemy.radius * 0.62)
          graphics.lineTo(enemy.x - forward.x * enemy.radius * 0.72 + side.x * enemy.radius * 0.42, enemy.y - forward.y * enemy.radius * 0.72 + side.y * enemy.radius * 0.42)
          graphics.lineTo(enemy.x - forward.x * enemy.radius * 0.35, enemy.y - forward.y * enemy.radius * 0.35)
          graphics.lineTo(enemy.x - forward.x * enemy.radius * 0.72 - side.x * enemy.radius * 0.42, enemy.y - forward.y * enemy.radius * 0.72 - side.y * enemy.radius * 0.42)
          graphics.lineTo(enemy.x + forward.x * enemy.radius * 0.15 - side.x * enemy.radius * 0.62, enemy.y + forward.y * enemy.radius * 0.15 - side.y * enemy.radius * 0.62)
          graphics.close()
          graphics.stroke()
          graphics.strokeColor = glow ? new Color(67, 246, 255, Math.floor(alpha * 70)) : new Color(67, 246, 255, Math.floor(alpha * 245))
          graphics.moveTo(enemy.x - forward.x * enemy.radius * 0.72 + side.x * enemy.radius * 0.42, enemy.y - forward.y * enemy.radius * 0.72 + side.y * enemy.radius * 0.42)
          graphics.lineTo(enemy.x - forward.x * enemy.radius, enemy.y - forward.y * enemy.radius)
          graphics.lineTo(enemy.x - forward.x * enemy.radius * 0.72 - side.x * enemy.radius * 0.42, enemy.y - forward.y * enemy.radius * 0.72 - side.y * enemy.radius * 0.42)
        }
        graphics.stroke()
        return
      case 'blackhole': {
        const pulse = Math.sin(this.time * 4 + enemy.phase) * 3
        graphics.circle(enemy.x, enemy.y, enemy.radius + pulse)
        graphics.stroke()
        graphics.circle(enemy.x, enemy.y, enemy.radius * 0.63)
        if (!glow) {
          graphics.fillColor = new Color(0, 0, 5, 235)
          graphics.fill()
          graphics.strokeColor = new Color(255, 205, 94, 230)
          graphics.circle(enemy.x, enemy.y, enemy.radius * 1.22 + pulse)
          graphics.stroke()
          graphics.strokeColor = new Color(157, 97, 255, 220)
          graphics.arc(enemy.x, enemy.y, enemy.radius * 0.48, -this.time * 1.7, -this.time * 1.7 + Math.PI * 1.35, false)
          graphics.stroke()
        }
        return
      }
      case 'dart':
        this.polygon(graphics, enemy.x, enemy.y, enemy.radius, 3, enemy.angle, true)
        if (!glow) {
          graphics.moveTo(enemy.x - Math.cos(enemy.angle) * enemy.radius * 0.55, enemy.y - Math.sin(enemy.angle) * enemy.radius * 0.55)
          graphics.lineTo(enemy.x + Math.cos(enemy.angle) * enemy.radius, enemy.y + Math.sin(enemy.angle) * enemy.radius)
          graphics.stroke()
        }
        return
      case 'orbiter':
        this.polygon(graphics, enemy.x, enemy.y, enemy.radius, 4, enemy.angle + Math.PI * 0.25, true)
        this.polygon(graphics, enemy.x, enemy.y, enemy.radius * 0.48, 4, -enemy.angle, false)
        if (!glow) {
          graphics.circle(enemy.x, enemy.y, enemy.radius * 1.45)
          graphics.stroke()
        }
        return
      case 'crusher':
        this.polygon(graphics, enemy.x, enemy.y, enemy.radius, 5, enemy.angle, true)
        this.polygon(graphics, enemy.x, enemy.y, enemy.radius * 0.58, 5, -enemy.angle, false)
        return
      case 'splitter':
        this.polygon(graphics, enemy.x, enemy.y, enemy.radius, 6, enemy.angle, true)
        for (let split = 0; split < 3; split += 1) {
          const angle = enemy.angle + split / 3 * Math.PI * 2
          graphics.moveTo(enemy.x, enemy.y)
          graphics.lineTo(enemy.x + Math.cos(angle) * enemy.radius, enemy.y + Math.sin(angle) * enemy.radius)
        }
        graphics.stroke()
        return
      case 'shard':
        this.polygon(graphics, enemy.x, enemy.y, enemy.radius, 3, enemy.angle, true)
        return
      default: {
        const unreachable: never = enemy.kind
        void unreachable
      }
    }
  }

  private polygon(graphics: Graphics, x: number, y: number, radius: number, sides: number, rotation: number, fill: boolean): void {
    for (let index = 0; index < sides; index += 1) {
      const angle = rotation + index / sides * Math.PI * 2
      const px = x + Math.cos(angle) * radius
      const py = y + Math.sin(angle) * radius
      if (index === 0) graphics.moveTo(px, py)
      else graphics.lineTo(px, py)
    }
    graphics.close()
    if (fill) graphics.fill()
    graphics.stroke()
  }

  private renderControls(): void {
    const graphics = this.controlsGraphics
    graphics.clear()
    if (this.world.state !== 'playing') return
    const defaultY = -this.world.height * 0.5 + 92
    this.drawStick(graphics, this.leftStick, 0, defaultY, '#45eaff')
  }

  private drawStick(graphics: Graphics, stick: StickState, defaultX: number, defaultY: number, hex: string): void {
    const base = stick.active ? stick.base : { x: defaultX, y: defaultY }
    const knob = stick.active ? stick.knob : base
    graphics.lineWidth = 2
    graphics.strokeColor = this.color(hex, stick.active ? 155 : 58)
    graphics.fillColor = this.color(hex, stick.active ? 28 : 12)
    graphics.circle(base.x, base.y, 46)
    graphics.fill()
    graphics.stroke()
    graphics.fillColor = this.color(hex, stick.active ? 82 : 25)
    graphics.circle(knob.x, knob.y, 16)
    graphics.fill()
    graphics.stroke()
  }

  private updateInterface(): void {
    const width = this.world.width
    const height = this.world.height
    const hudWidth = width - 48
    this.scoreLabel.node.getComponent(UITransform)?.setContentSize(hudWidth, 92)
    this.statusLabel.node.getComponent(UITransform)?.setContentSize(hudWidth, 92)
    this.subtitleLabel.node.getComponent(UITransform)?.setContentSize(hudWidth, 100)
    this.promptLabel.node.getComponent(UITransform)?.setContentSize(hudWidth, 100)
    const safeArea = sys.getSafeAreaRect()
    const safeTop = clamp(height - safeArea.y - safeArea.height, 0, height * 0.25)
    const hudTop = Math.max(58, safeTop + 54)
    this.scoreLabel.node.setPosition(0, height * 0.5 - hudTop)
    this.scoreLabel.string = `SCORE  ${this.scoreText(this.world.score)}\nHIGH   ${this.scoreText(this.world.highScore)}`
    this.statusLabel.node.setPosition(0, height * 0.5 - hudTop)
    const specialStatus: string[] = []
    if (this.world.missileTimer > 0) specialStatus.push(`MISSILE ${this.world.missileTimer.toFixed(1)}s`)
    if (this.world.overloadTimer > 0) specialStatus.push(`OVERDRIVE ${this.world.overloadTimer.toFixed(1)}s`)
    if (this.world.allies.length > 0) specialStatus.push(`ALLY ×${this.world.allies.length}`)
    specialStatus.push(this.world.supplies.some((supply) => !supply.dead) ? 'SUPER ACTIVE' : `SUPER ${Math.ceil(this.world.supplyClock)}s`)
    const specialLine = specialStatus.length > 0 ? `\n${specialStatus.join('  ')}` : ''
    this.statusLabel.string = `VECTOR  ×${this.world.multiplier}   ◇ ${this.world.lives}   W${weaponTier(this.world.score)}${specialLine}`
    this.titleLabel.node.setPosition(0, height * 0.12)
    this.subtitleLabel.node.setPosition(0, height * 0.12 - 132)
    this.promptLabel.node.setPosition(0, -height * 0.18)
    this.messageLabel.node.setPosition(0, height * 0.5 - Math.max(142, safeTop + 120))
    const showTitle = this.world.state === 'title'
    const showGameOver = this.world.state === 'gameover'
    this.titleLabel.node.active = showTitle || showGameOver
    this.subtitleLabel.node.active = showTitle || showGameOver
    this.promptLabel.node.active = showTitle || showGameOver || this.world.state === 'paused' || (this.world.state === 'playing' && this.world.elapsed < TUTORIAL_DURATION)
    if (showTitle) {
      this.promptLabel.fontSize = 20
      this.promptLabel.lineHeight = 24
      this.promptLabel.color = this.color('#d6ff4f')
      this.titleLabel.string = 'GEOMETRY\nFIGHTER'
      this.titleLabel.color = new Color(231, 253, 255, 255)
      this.subtitleLabel.string = '竖屏单手 · 移动即射击 · 保持倍率'
      this.promptLabel.string = '下半屏单指拖动 · 移动方向即射击方向 · 击破补给释放超级武器 · 轻触开始'
    } else if (showGameOver) {
      this.promptLabel.fontSize = 20
      this.promptLabel.lineHeight = 24
      this.promptLabel.color = this.color('#d6ff4f')
      this.titleLabel.string = 'GRID\nCOLLAPSED'
      this.titleLabel.color = new Color(255, 92, 112, 255)
      this.subtitleLabel.string = `FINAL SCORE  ${this.scoreText(this.world.score)}`
      this.promptLabel.string = '触摸重新接入网格  /  TOUCH TO RESTART'
    } else if (this.world.state === 'paused') {
      this.promptLabel.fontSize = 20
      this.promptLabel.lineHeight = 24
      this.promptLabel.color = this.color('#d6ff4f')
      this.promptLabel.string = 'PAUSED  /  触摸 P 继续'
    } else {
      this.promptLabel.node.setPosition(0, -height * 0.5 + 170)
      this.promptLabel.fontSize = 14
      this.promptLabel.lineHeight = 18
      const tutorialAlpha = this.world.elapsed <= TUTORIAL_HOLD ? 210 : Math.floor(210 * (TUTORIAL_DURATION - this.world.elapsed) / (TUTORIAL_DURATION - TUTORIAL_HOLD))
      this.promptLabel.color = this.color('#45eaff', tutorialAlpha)
      this.promptLabel.string = '单指移动并射击 · 击破补给释放超级武器'
    }
  }

  private color(hex: string, alpha = 255): Color {
    const value = hex.startsWith('#') ? hex.slice(1) : hex
    const number = Number.parseInt(value, 16)
    return new Color((number >> 16) & 255, (number >> 8) & 255, number & 255, clamp(alpha, 0, 255))
  }

  private scoreText(value: number): string {
    return (`00000000${Math.floor(value)}`).slice(-8)
  }
}
