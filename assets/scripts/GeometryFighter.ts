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
  Bullet,
  ControlState,
  Enemy,
  EnemyKind,
  GeometryWorld,
  Vector,
  WorldEvent,
  clamp,
  length,
  normalized,
  weaponTier
} from './simulation'

const { ccclass } = _decorator

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
    bomb: false,
    start: false,
    pause: false
  }

  private readonly leftStick: StickState = this.makeStick()
  private readonly rightStick: StickState = this.makeStick()
  private readonly keys = new Set<KeyCode>()
  private readonly particles: Particle[] = []
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

  protected override onLoad(): void {
    view.setDesignResolutionSize(1280, 720, ResolutionPolicy.FIXED_HEIGHT)
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
    this.controls.bomb = false
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
    transform.setContentSize(1280, 720)
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
    camera.orthoHeight = 360
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
    transform.setContentSize(1280, 720)
    const graphics = layer.addComponent(Graphics)
    graphics.lineJoin = Graphics.LineJoin.ROUND
    graphics.lineCap = Graphics.LineCap.ROUND
    return graphics
  }

  private createInterface(): void {
    this.scoreLabel = this.createLabel('Score', 23, '#bcff49')
    this.scoreLabel.horizontalAlign = Label.HorizontalAlign.LEFT
    this.statusLabel = this.createLabel('Status', 18, '#fff36a')
    this.titleLabel = this.createLabel('Title', 74, '#eafbff')
    this.titleLabel.string = 'GEOMETRY\nFIGHTER'
    this.titleLabel.lineHeight = 72
    this.subtitleLabel = this.createLabel('Subtitle', 22, '#70ecff')
    this.subtitleLabel.string = '霓虹网格 · 双摇杆生存射击 · 保持倍率'
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
    for (const child of this.node.children) child.getComponent(UITransform)?.setContentSize(size.width, size.height)
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
    const bombY = -this.world.height * 0.5 + 58
    if (length(point.x, point.y - bombY) < 52) {
      this.controls.bomb = true
      return
    }
    const id = event.getID() ?? -1
    if (point.x < 0 && !this.leftStick.active) this.activateStick(this.leftStick, id, point)
    else if (!this.rightStick.active) this.activateStick(this.rightStick, id, point)
    this.syncSticks()
  }

  private onTouchMove(event: EventTouch): void {
    const point = this.touchPosition(event)
    const id = event.getID() ?? -1
    this.moveStick(this.leftStick, id, point)
    this.moveStick(this.rightStick, id, point)
    this.syncSticks()
  }

  private onTouchEnd(event: EventTouch): void {
    const id = event.getID() ?? -1
    if (this.leftStick.id === id) this.releaseStick(this.leftStick)
    if (this.rightStick.id === id) this.releaseStick(this.rightStick)
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
    this.controls.aim = this.stickVector(this.rightStick)
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
    if (event.keyCode === KeyCode.SPACE) this.controls.bomb = true
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
    else if (!this.rightStick.active) this.controls.aim = { x: 0, y: 0 }
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
      } else if (event.kind === 'bomb') {
        this.spawnBurst(event.x, event.y, '#e9ffff', 110, 430)
        this.ripples.push({ x: event.x, y: event.y, radius: 16, speed: 1050, life: 1, maxLife: 1, strength: 58, color: '#ffffff' })
        this.showMessage(event.text, '#ffffff', 1.2)
        this.synth.tone(58, 0.7, 0.12, 'sawtooth', 0.12)
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
      }
    }
  }

  private spawnBurst(x: number, y: number, color: string, count: number, speed: number): void {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2
      const velocity = speed * (0.25 + Math.random() * 0.75)
      const life = 0.25 + Math.random() * 0.75
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life,
        maxLife: life,
        size: 1.2 + Math.random() * 3.6,
        color,
        drag: 1.5 + Math.random() * 3
      })
    }
    if (this.particles.length > 850) this.particles.splice(0, this.particles.length - 850)
  }

  private showMessage(text: string, color: string, duration: number): void {
    this.messageLabel.string = text
    this.messageLabel.color = this.color(color)
    this.messageLabel.node.active = true
    this.messageTimer = duration
  }

  private updateVisualState(dt: number): void {
    for (const particle of this.particles) {
      particle.x += particle.vx * dt
      particle.y += particle.vy * dt
      const drag = Math.exp(-particle.drag * dt)
      particle.vx *= drag
      particle.vy *= drag
      particle.life -= dt
    }
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      if (this.particles[index].life <= 0) this.particles.splice(index, 1)
    }
    for (const ripple of this.ripples) {
      ripple.radius += ripple.speed * dt
      ripple.life -= dt
    }
    for (let index = this.ripples.length - 1; index >= 0; index -= 1) {
      if (this.ripples[index].life <= 0) this.ripples.splice(index, 1)
    }
    for (const text of this.floatingTexts) {
      text.y += 30 * dt
      text.life -= dt
    }
    for (let index = this.floatingTexts.length - 1; index >= 0; index -= 1) {
      if (this.floatingTexts[index].life <= 0) this.floatingTexts.splice(index, 1)
    }
    if (this.world.player.alive && this.world.state === 'playing') {
      const moved = length(this.world.player.x - this.lastPlayerPosition.x, this.world.player.y - this.lastPlayerPosition.y)
      if (moved > 2) this.playerTrail.push({ x: this.world.player.x, y: this.world.player.y, life: 0.34 })
      this.lastPlayerPosition = { x: this.world.player.x, y: this.world.player.y }
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
    return { x: warpedX, y: warpedY }
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
    const tail = 20
    const x2 = bullet.x - Math.cos(bullet.angle) * tail
    const y2 = bullet.y - Math.sin(bullet.angle) * tail
    glow.lineWidth = 12
    glow.strokeColor = new Color(255, 239, 73, 55)
    glow.moveTo(bullet.x, bullet.y)
    glow.lineTo(x2, y2)
    glow.stroke()
    sharp.lineWidth = 2.8
    sharp.strokeColor = new Color(255, 253, 215, 255)
    sharp.moveTo(bullet.x, bullet.y)
    sharp.lineTo(x2, y2)
    sharp.stroke()
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
    graphics.moveTo(player.x + forward.x * 19, player.y + forward.y * 19)
    graphics.lineTo(player.x - forward.x * 12 + side.x * 11, player.y - forward.y * 12 + side.y * 11)
    graphics.lineTo(player.x - forward.x * 6, player.y - forward.y * 6)
    graphics.lineTo(player.x - forward.x * 12 - side.x * 11, player.y - forward.y * 12 - side.y * 11)
    graphics.close()
    graphics.stroke()
    if (!glow) {
      graphics.strokeColor = new Color(93, 255, 186, 255)
      graphics.moveTo(player.x - forward.x * 8 + side.x * 5, player.y - forward.y * 8 + side.y * 5)
      graphics.lineTo(player.x - forward.x * 18, player.y - forward.y * 18)
      graphics.lineTo(player.x - forward.x * 8 - side.x * 5, player.y - forward.y * 8 - side.y * 5)
      graphics.stroke()
    }
  }

  private drawEnemy(graphics: Graphics, enemy: Enemy, glow: boolean, alpha: number): void {
    const colorHex = this.world.enemyColor(enemy.kind)
    graphics.strokeColor = this.color(colorHex, Math.floor(alpha * (glow ? 70 : 245)))
    graphics.fillColor = this.color(colorHex, Math.floor(alpha * (glow ? 22 : 35)))
    graphics.lineWidth = glow ? 12 : 2.4
    if (enemy.kind === 'wanderer') {
      this.polygon(graphics, enemy.x, enemy.y, enemy.radius, 4, enemy.angle + Math.PI * 0.25, true)
    } else if (enemy.kind === 'grunt') {
      this.polygon(graphics, enemy.x, enemy.y, enemy.radius, 4, enemy.angle, true)
      if (!glow) this.polygon(graphics, enemy.x, enemy.y, enemy.radius * 0.45, 4, -enemy.angle, false)
    } else if (enemy.kind === 'weaver') {
      this.polygon(graphics, enemy.x, enemy.y, enemy.radius, 3, enemy.angle, true)
      if (!glow) this.polygon(graphics, enemy.x, enemy.y, enemy.radius * 0.48, 3, enemy.angle + Math.PI, false)
    } else if (enemy.kind === 'spinner') {
      for (let arm = 0; arm < 4; arm += 1) {
        const angle = enemy.angle + arm * Math.PI * 0.5
        graphics.moveTo(enemy.x + Math.cos(angle) * 4, enemy.y + Math.sin(angle) * 4)
        graphics.lineTo(enemy.x + Math.cos(angle) * 19, enemy.y + Math.sin(angle) * 19)
      }
      graphics.stroke()
      graphics.circle(enemy.x, enemy.y, 6)
      graphics.stroke()
    } else if (enemy.kind === 'snake') {
      this.polygon(graphics, enemy.x, enemy.y, enemy.radius, 3, enemy.angle, true)
      for (let index = enemy.segments.length - 1; index >= 0; index -= 1) {
        const segment = enemy.segments[index]
        const radius = 7 + (enemy.segments.length - index) * 0.35
        this.polygon(graphics, segment.x, segment.y, radius, 4, segment.angle + Math.PI * 0.25, index % 2 === 0)
      }
    } else if (enemy.kind === 'repulsar') {
      this.polygon(graphics, enemy.x, enemy.y, enemy.radius, 6, enemy.angle, false)
      graphics.circle(enemy.x, enemy.y, enemy.radius * 0.52)
      graphics.stroke()
      if (!glow) {
        graphics.circle(enemy.x, enemy.y, enemy.radius * 1.55 + Math.sin(this.time * 5) * 4)
        graphics.stroke()
      }
    } else {
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
    const defaultY = -this.world.height * 0.5 + 78
    const defaultX = this.world.width * 0.5 - 90
    this.drawStick(graphics, this.leftStick, -defaultX, defaultY, '#45eaff')
    this.drawStick(graphics, this.rightStick, defaultX, defaultY, '#ff42d7')
    graphics.lineWidth = 2
    graphics.strokeColor = new Color(255, 239, 83, 125)
    graphics.fillColor = new Color(80, 42, 0, 58)
    graphics.circle(0, -this.world.height * 0.5 + 58, 28)
    graphics.fill()
    graphics.stroke()
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
    this.scoreLabel.node.setPosition(-width * 0.5 + 30, height * 0.5 - 34)
    this.scoreLabel.string = `SCORE  ${this.scoreText(this.world.score)}\nHIGH   ${this.scoreText(this.world.highScore)}`
    this.statusLabel.node.setPosition(0, height * 0.5 - 30)
    this.statusLabel.string = `×${this.world.multiplier}    ◇ ${this.world.lives}    ✦ ${this.world.bombs}    W${weaponTier(this.world.score)}`
    this.titleLabel.node.setPosition(0, 82)
    this.subtitleLabel.node.setPosition(0, -42)
    this.promptLabel.node.setPosition(0, -116)
    this.messageLabel.node.setPosition(0, 142)
    const showTitle = this.world.state === 'title'
    const showGameOver = this.world.state === 'gameover'
    this.titleLabel.node.active = showTitle || showGameOver
    this.subtitleLabel.node.active = showTitle || showGameOver
    this.promptLabel.node.active = showTitle || showGameOver || this.world.state === 'paused'
    if (showTitle) {
      this.titleLabel.string = 'GEOMETRY\nFIGHTER'
      this.titleLabel.color = new Color(231, 253, 255, 255)
      this.subtitleLabel.string = '霓虹网格 · 双摇杆生存射击 · 保持倍率'
      this.promptLabel.string = '触摸屏幕开始  /  TOUCH TO ENGAGE'
    } else if (showGameOver) {
      this.titleLabel.string = 'GRID\nCOLLAPSED'
      this.titleLabel.color = new Color(255, 92, 112, 255)
      this.subtitleLabel.string = `FINAL SCORE  ${this.scoreText(this.world.score)}`
      this.promptLabel.string = '触摸重新接入网格  /  TOUCH TO RESTART'
    } else if (this.world.state === 'paused') {
      this.promptLabel.string = 'PAUSED  /  触摸 P 继续'
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
