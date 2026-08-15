// allow: SIZE_OK — Cocos lifecycle and immediate-mode drawing share one scene-owned state surface.
import {
  _decorator,
  Camera,
  Canvas,
  Color,
  Component,
  director,
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
  screen,
  sys,
  UITransform,
  Vec2,
  view
} from 'cc'
import {
  AIM_ASSIST_HALF_ANGLE,
  GeometryWorld,
  clamp,
  length,
  normalized,
  weaponTier
} from './simulation'
import type { Ally, Bullet, ControlState, Enemy, Supply, Vector, WorldEvent } from './simulation'
import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  GRID_SPACING,
  MAX_GRID_WARP_RIPPLES,
  MAX_PARTICLES,
  MAX_RIPPLES,
  RENDER_PIXEL_RATIO,
  STAR_COUNT,
  gridBounds,
  scoreHudAnchor,
  gridPointCount,
  gridPointIndex
} from './presentation'
import type { GridBounds } from './presentation'
import { COLORS, GRID_LINES, LAYOUT, STROKES, TOUCH, TYPOGRAPHY } from './design-tokens.ts'
import type { GridLineStyle } from './design-tokens.ts'
import { Synth } from './synth'
import { TouchControls } from './touch-controls'
import type { StickState } from './touch-controls'
import {
  FIGHTER_GLOW_ALPHA,
  FIGHTER_GLOW_COLOR,
  FIGHTER_HULL_COLOR,
  FIGHTER_INNER_GLOW_STROKE,
  FIGHTER_INNER_PATH,
  FIGHTER_INNER_STROKE,
  FIGHTER_OUTER_GLOW_STROKE,
  FIGHTER_OUTER_PATH,
  FIGHTER_OUTER_STROKE
} from './fighter-shape'

const { ccclass } = _decorator

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

interface Burst {
  readonly x: number
  readonly y: number
  readonly color: string
  readonly count: number
  readonly speed: number
}

@ccclass('GeometryFighter')
export class GeometryFighter extends Component {
  private readonly world = new GeometryWorld()
  private readonly synth = new Synth()
  private readonly controls: ControlState = {
    move: { x: 0, y: 0 },
    aim: { x: 0, y: 0 },
    engaged: false,
    bomb: false,
    start: false,
    pause: false
  }

  private readonly touchControls = new TouchControls()
  private readonly leftStick = this.touchControls.left
  private readonly rightStick = this.touchControls.right
  private readonly keys = new Set<KeyCode>()
  private readonly particles: Particle[] = []
  private readonly ripples: Ripple[] = []
  private readonly playerTrail: TrailPoint[] = []
  private readonly floatingTexts: FloatingText[] = []
  private readonly stars: Star[] = []
  private readonly activeBlackholes: Enemy[] = []
  private readonly activeGridRipples: Ripple[] = []
  private readonly warpedGridPoints: Vector[] = []
  private readonly colorScratch = new Color()
  private readonly bombPositionScratch: Vector = { x: 0, y: 0 }
  private gridLayout: GridBounds = gridBounds(DESIGN_WIDTH, DESIGN_HEIGHT, GRID_SPACING)
  private particleReplaceCursor = 0
  private graphics!: Graphics
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
    const devicePixelRatio = Math.max(1, screen.devicePixelRatio)
    const pipeline = director.root?.pipeline
    if (pipeline) pipeline.shadingScale = Math.min(1, RENDER_PIXEL_RATIO / devicePixelRatio)
    view.setDesignResolutionSize(DESIGN_WIDTH, DESIGN_HEIGHT, ResolutionPolicy.FIXED_WIDTH)
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
    this.synth.update(this.time, this.world.state === 'playing')
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

  private ensureSceneCamera(): void {
    if (!this.node.getComponent(Canvas)) this.node.addComponent(Canvas)
    const transform = this.node.getComponent(UITransform) || this.node.addComponent(UITransform)
    transform.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT)
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
    camera.orthoHeight = DESIGN_HEIGHT * 0.5
    camera.visibility = Layers.Enum.UI_2D
    camera.clearColor = this.color(COLORS.background)
  }

  private createRenderLayers(): void {
    this.graphics = this.createGraphics('Game Graphics')
  }

  private createGraphics(name: string): Graphics {
    const layer = new Node(name)
    layer.layer = Layers.Enum.UI_2D
    this.node.addChild(layer)
    const transform = layer.addComponent(UITransform)
    transform.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT)
    const graphics = layer.addComponent(Graphics)
    graphics.lineJoin = Graphics.LineJoin.ROUND
    graphics.lineCap = Graphics.LineCap.ROUND
    return graphics
  }

  private createInterface(): void {
    this.scoreLabel = this.createLabel('Score', TYPOGRAPHY.hudPrimary, COLORS.hud)
    this.scoreLabel.horizontalAlign = Label.HorizontalAlign.LEFT
    const scoreTransform = this.scoreLabel.node.getComponent(UITransform)
    scoreTransform?.setContentSize(LAYOUT.scoreWidth, LAYOUT.scoreHeight)
    scoreTransform?.setAnchorPoint(0, 0.5)
    this.statusLabel = this.createLabel('Status', TYPOGRAPHY.hudSecondary, COLORS.yellow)
    this.statusLabel.horizontalAlign = Label.HorizontalAlign.RIGHT
    this.statusLabel.node.getComponent(UITransform)?.setAnchorPoint(1, 0.5)
    this.titleLabel = this.createLabel('Title', TYPOGRAPHY.display, COLORS.white)
    this.titleLabel.string = 'GEOMETRY\nFIGHTER'
    this.titleLabel.lineHeight = TYPOGRAPHY.displayLineHeight
    this.subtitleLabel = this.createLabel('Subtitle', TYPOGRAPHY.subtitle, COLORS.cyan)
    this.subtitleLabel.string = '竖屏单手 · 拖动方向自动射击 · 保持倍率'
    this.promptLabel = this.createLabel('Prompt', TYPOGRAPHY.prompt, COLORS.hud)
    this.messageLabel = this.createLabel('Message', TYPOGRAPHY.message, COLORS.white)
    this.messageLabel.node.active = false
  }

  private createLabel(name: string, fontSize: number, hex: string): Label {
    const node = new Node(name)
    node.layer = Layers.Enum.UI_2D
    this.node.addChild(node)
    const transform = node.addComponent(UITransform)
    transform.setContentSize(LAYOUT.labelWidth, LAYOUT.labelHeight)
    const label = node.addComponent(Label)
    label.fontSize = fontSize
    label.lineHeight = fontSize + TYPOGRAPHY.lineHeightExtra
    label.color = this.color(hex)
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    label.enableOutline = true
    label.outlineColor = this.color(COLORS.background)
    label.outlineWidth = TYPOGRAPHY.outlineWidth
    return label
  }

  private populateStars(): void {
    let value = 0x1836ef91
    for (let index = 0; index < STAR_COUNT; index += 1) {
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
    const unitsPerPixel = Math.max(1, screen.devicePixelRatio) / Math.max(0.01, view.getScaleX())
    this.touchControls.resize(size.width, size.height, unitsPerPixel)
    this.world.resize(size.width, size.height, unitsPerPixel)
    this.gridLayout = gridBounds(this.world.width, this.world.height, GRID_SPACING)
    this.syncSticks()
    const transform = this.node.getComponent(UITransform)
    transform?.setContentSize(size.width, size.height)
    this.graphics.node.getComponent(UITransform)?.setContentSize(size.width, size.height)
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
    const bomb = this.bombPosition()
    if (length(point.x - bomb.x, point.y - bomb.y) < TOUCH.bombHitRadius * this.touchControls.unitsPerPixel) {
      this.controls.bomb = true
      return
    }
    const id = event.getID() ?? -1
    this.touchControls.start({ id, ...point })
    this.syncSticks()
  }

  private onTouchMove(event: EventTouch): void {
    const point = this.touchPosition(event)
    const id = event.getID() ?? -1
    this.touchControls.move({ id, ...point })
    this.syncSticks()
  }

  private onTouchEnd(event: EventTouch): void {
    const id = event.getID() ?? -1
    this.touchControls.end(id)
    this.syncSticks()
  }

  private syncSticks(): void {
    const vectors = this.touchControls.vectors()
    this.controls.move = vectors.move
    this.controls.aim = vectors.aim
    this.controls.engaged = vectors.engaged
  }

  private onKeyDown(event: EventKeyboard): void {
    this.keys.add(event.keyCode)
    if (event.keyCode === KeyCode.ENTER) {
      this.synth.unlock()
      this.controls.start = true
    }
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
    else if (!this.rightStick.active && !(this.touchControls.singleHanded && this.leftStick.active)) this.controls.aim = { x: 0, y: 0 }
    this.controls.engaged = this.leftStick.active || (this.touchControls.singleHanded && Boolean(moveX || moveY))
  }

  private processWorldEvents(events: WorldEvent[]): void {
    for (const event of events) {
      if (event.kind === 'shoot') {
        this.spawnBurst({ x: event.x, y: event.y, color: COLORS.yellow, count: Math.min(4, event.amount), speed: 70 })
        this.addRipple({ x: event.x, y: event.y, radius: 6, speed: 120, life: 0.22, maxLife: 0.22, strength: 5, color: event.color })
        this.synth.tone(360 + event.amount * 65, 0.035, 0.018, 'square', 1.7)
      } else if (event.kind === 'kill') {
        this.spawnBurst({ x: event.x, y: event.y, color: event.color, count: 26, speed: 235 })
        this.addRipple({ x: event.x, y: event.y, radius: 10, speed: 270, life: 0.65, maxLife: 0.65, strength: 24, color: event.color })
        this.floatingTexts.push({ x: event.x, y: event.y, text: event.text, color: event.color, life: 0.72 })
        this.synth.tone(90, 0.1, 0.04, 'sawtooth', 0.42)
      } else if (event.kind === 'bomb') {
        this.spawnBurst({ x: event.x, y: event.y, color: COLORS.white, count: 110, speed: 430 })
        this.addRipple({ x: event.x, y: event.y, radius: 16, speed: 1050, life: 1, maxLife: 1, strength: 58, color: COLORS.white })
        this.showMessage(event.text, COLORS.white, 1.2)
        this.synth.tone(58, 0.7, 0.12, 'sawtooth', 0.12)
      } else if (event.kind === 'death') {
        this.spawnBurst({ x: event.x, y: event.y, color: COLORS.white, count: 90, speed: 360 })
        this.addRipple({ x: event.x, y: event.y, radius: 15, speed: 560, life: 0.9, maxLife: 0.9, strength: 44, color: COLORS.red })
        this.showMessage(event.text, COLORS.red, 1)
        this.synth.tone(210, 0.42, 0.1, 'sawtooth', 0.08)
      } else if (event.kind === 'reward' || event.kind === 'wave') {
        this.showMessage(event.text, event.color, 1.1)
        this.synth.tone(event.kind === 'reward' ? 760 : 430, 0.18, 0.05, 'sine', 1.7)
      } else if (event.kind === 'blackhole') {
        this.spawnBurst({ x: event.x, y: event.y, color: COLORS.magenta, count: 4, speed: 100 })
      } else if (event.kind === 'supply') {
        if (event.text) this.showMessage(event.text, event.color, 1.15)
        this.spawnBurst({ x: event.x, y: event.y, color: event.color, count: event.text ? 18 : 6, speed: event.text ? 160 : 90 })
      } else if (event.kind === 'super') {
        this.showMessage(event.text, event.color, 1.4)
        this.spawnBurst({ x: event.x, y: event.y, color: event.color, count: 56, speed: 310 })
        this.addRipple({ x: event.x, y: event.y, radius: 10, speed: 360, life: 0.75, maxLife: 0.75, strength: 30, color: event.color })
        this.synth.tone(620, 0.24, 0.06, 'square', 1.85)
      }
    }
  }

  private addRipple(ripple: Ripple): void {
    if (this.ripples.length >= MAX_RIPPLES) this.ripples.shift()
    this.ripples.push(ripple)
  }

  private spawnBurst(burst: Burst): void {
    for (let index = 0; index < burst.count; index += 1) {
      const angle = Math.random() * Math.PI * 2
      const velocity = burst.speed * (0.25 + Math.random() * 0.75)
      const life = 0.25 + Math.random() * 0.75
      if (this.particles.length < MAX_PARTICLES) {
        this.particles.push({ x: burst.x, y: burst.y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, life, maxLife: life, size: 1.2 + Math.random() * 3.6, color: burst.color, drag: 1.5 + Math.random() * 3 })
        continue
      }
      const particle = this.particles[this.particleReplaceCursor]
      particle.x = burst.x
      particle.y = burst.y
      particle.vx = Math.cos(angle) * velocity
      particle.vy = Math.sin(angle) * velocity
      particle.life = life
      particle.maxLife = life
      particle.size = 1.2 + Math.random() * 3.6
      particle.color = burst.color
      particle.drag = 1.5 + Math.random() * 3
      this.particleReplaceCursor = (this.particleReplaceCursor + 1) % MAX_PARTICLES
    }
  }

  private showMessage(text: string, color: string, duration: number): void {
    this.messageLabel.string = text
    this.messageLabel.color = this.color(color)
    this.messageLabel.node.active = true
    this.messageTimer = duration
  }

  private updateVisualState(dt: number): void {
    let particleCount = 0
    for (const particle of this.particles) {
      particle.x += particle.vx * dt
      particle.y += particle.vy * dt
      const drag = Math.exp(-particle.drag * dt)
      particle.vx *= drag
      particle.vy *= drag
      particle.life -= dt
      if (particle.life <= 0) continue
      this.particles[particleCount] = particle
      particleCount += 1
    }
    this.particles.length = particleCount

    let rippleCount = 0
    for (const ripple of this.ripples) {
      ripple.radius += ripple.speed * dt
      ripple.life -= dt
      if (ripple.life <= 0) continue
      this.ripples[rippleCount] = ripple
      rippleCount += 1
    }
    this.ripples.length = rippleCount

    let textCount = 0
    for (const text of this.floatingTexts) {
      text.y += 30 * dt
      text.life -= dt
      if (text.life <= 0) continue
      this.floatingTexts[textCount] = text
      textCount += 1
    }
    this.floatingTexts.length = textCount
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
    this.graphics.clear()
    this.renderGrid(this.graphics)
    this.renderEffects(this.graphics)
    this.renderEntities(this.graphics)
    this.renderControls(this.graphics)
  }

  private renderGrid(graphics: Graphics): void {
    const width = this.world.width
    const height = this.world.height
    graphics.fillColor = this.color(COLORS.background)
    graphics.rect(-width * 0.5, -height * 0.5, width, height)
    graphics.fill()
    this.prepareWarpedGrid(GRID_SPACING)
    this.drawGridLines(graphics, GRID_LINES.glow)
    graphics.lineWidth = STROKES.gridBoundaryGlow
    graphics.strokeColor = this.color(COLORS.gridHot, 44)
    graphics.rect(-width * 0.5 + LAYOUT.arenaInset, -height * 0.5 + LAYOUT.arenaInset, width - LAYOUT.arenaInset * 2, height - LAYOUT.arenaInset * 2)
    graphics.stroke()
    for (const star of this.stars) {
      const alpha = 32 + Math.floor((Math.sin(this.time * 1.8 + star.phase) * 0.5 + 0.5) * 70)
      graphics.fillColor = this.color(COLORS.grid, alpha)
      graphics.circle(star.x * width, star.y * height, star.size)
      graphics.fill()
    }
    this.drawGridLines(graphics, GRID_LINES.main)
    graphics.lineWidth = STROKES.gridBoundary
    graphics.strokeColor = this.color(COLORS.white, 230)
    graphics.rect(-width * 0.5 + LAYOUT.arenaInset, -height * 0.5 + LAYOUT.arenaInset, width - LAYOUT.arenaInset * 2, height - LAYOUT.arenaInset * 2)
    graphics.stroke()
  }

  private prepareWarpedGrid(spacing: number): void {
    const layout = this.gridLayout
    this.activeBlackholes.length = 0
    for (const enemy of this.world.enemies) {
      if (!enemy.dead && enemy.kind === 'blackhole') this.activeBlackholes.push(enemy)
    }
    this.activeGridRipples.length = 0
    const firstRipple = Math.max(0, this.ripples.length - MAX_GRID_WARP_RIPPLES)
    for (let index = firstRipple; index < this.ripples.length; index += 1) {
      this.activeGridRipples.push(this.ripples[index])
    }

    for (let column = layout.minimumColumn; column <= layout.maximumColumn; column += 1) {
      for (let row = layout.minimumRow; row <= layout.maximumRow; row += 1) {
        const pointIndex = gridPointIndex(layout, column, row)
        let point = this.warpedGridPoints[pointIndex]
        if (!point) {
          point = { x: 0, y: 0 }
          this.warpedGridPoints[pointIndex] = point
        }
        this.warpPoint(column * spacing, row * spacing, point)
      }
    }
    this.warpedGridPoints.length = gridPointCount(layout)
  }

  private drawGridLines(graphics: Graphics, style: GridLineStyle): void {
    const halfWidth = this.world.width * 0.5
    const halfHeight = this.world.height * 0.5
    graphics.lineWidth = style.lineWidth
    graphics.strokeColor = this.color(style.color, style.alpha)
    const layout = this.gridLayout
    for (let column = layout.minimumColumn; column <= layout.maximumColumn; column += 1) {
      for (let row = layout.minimumRow; row <= layout.maximumRow; row += 1) {
        const point = this.warpedGridPoints[gridPointIndex(layout, column, row)]
        if (row === layout.minimumRow) graphics.moveTo(point.x, point.y)
        else graphics.lineTo(point.x, point.y)
      }
    }
    for (let row = layout.minimumRow; row <= layout.maximumRow; row += 1) {
      for (let column = layout.minimumColumn; column <= layout.maximumColumn; column += 1) {
        const point = this.warpedGridPoints[gridPointIndex(layout, column, row)]
        if (column === layout.minimumColumn) graphics.moveTo(point.x, point.y)
        else graphics.lineTo(point.x, point.y)
      }
    }
    graphics.stroke()
    graphics.lineWidth = style.lineWidth * 0.8
    graphics.strokeColor = this.color(style.color, Math.min(255, style.alpha * 1.35))
    graphics.rect(-halfWidth, -halfHeight, this.world.width, this.world.height)
    graphics.stroke()
  }

  private warpPoint(x: number, y: number, output: Vector): void {
    output.x = x
    output.y = y
    for (const ripple of this.activeGridRipples) {
      const dx = x - ripple.x
      const dy = y - ripple.y
      const reach = ripple.radius + 90
      if (Math.abs(dx) > reach || Math.abs(dy) > reach) continue
      const distance = Math.max(1, length(dx, dy))
      const band = Math.abs(distance - ripple.radius)
      if (band < 90) {
        const fade = ripple.life / ripple.maxLife
        const force = Math.sin((1 - band / 90) * Math.PI) * ripple.strength * fade
        output.x += dx / distance * force
        output.y += dy / distance * force
      }
    }
    for (const enemy of this.activeBlackholes) {
      const dx = enemy.x - x
      const dy = enemy.y - y
      if (Math.abs(dx) > 290 || Math.abs(dy) > 290) continue
      const distance = Math.max(20, length(dx, dy))
      if (distance < 290) {
        const force = (1 - distance / 290) * 38 * enemy.mass
        output.x += dx / distance * force
        output.y += dy / distance * force
      }
    }
  }

  private renderEffects(graphics: Graphics): void {
    for (const point of this.playerTrail) {
      const alpha = clamp(point.life / 0.34, 0, 1)
      graphics.fillColor = this.color(COLORS.cyan, Math.floor(alpha * 55))
      graphics.circle(point.x, point.y, 10 * alpha)
      graphics.fill()
    }
    for (const particle of this.particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1)
      const tailScale = 0.035
      graphics.lineWidth = particle.size * STROKES.particleGlow
      graphics.strokeColor = this.color(particle.color, Math.floor(alpha * 42))
      graphics.moveTo(particle.x, particle.y)
      graphics.lineTo(particle.x - particle.vx * tailScale, particle.y - particle.vy * tailScale)
      graphics.stroke()
    }
    for (const ripple of this.ripples) {
      const alpha = clamp(ripple.life / ripple.maxLife, 0, 1)
      graphics.lineWidth = STROKES.rippleGlow * alpha
      graphics.strokeColor = this.color(ripple.color, Math.floor(alpha * 70))
      graphics.circle(ripple.x, ripple.y, ripple.radius)
      graphics.stroke()
    }
    for (const bullet of this.world.bullets) this.drawBullet(graphics, bullet, true)
    for (const particle of this.particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1)
      const tailScale = 0.035
      graphics.lineWidth = Math.max(1, particle.size * alpha)
      graphics.strokeColor = this.color(particle.color, Math.floor(alpha * 210))
      graphics.moveTo(particle.x, particle.y)
      graphics.lineTo(particle.x - particle.vx * tailScale, particle.y - particle.vy * tailScale)
      graphics.stroke()
    }
    for (const ripple of this.ripples) {
      const alpha = clamp(ripple.life / ripple.maxLife, 0, 1)
      graphics.lineWidth = STROKES.rippleMain
      graphics.strokeColor = this.color(ripple.color, Math.floor(alpha * 230))
      graphics.circle(ripple.x, ripple.y, ripple.radius)
      graphics.stroke()
    }
    for (const bullet of this.world.bullets) this.drawBullet(graphics, bullet, false)
  }

  private drawBullet(graphics: Graphics, bullet: Bullet, glow: boolean): void {
    const tail = bullet.kind === 'missile' ? 30 : 20
    const x2 = bullet.x - Math.cos(bullet.angle) * tail
    const y2 = bullet.y - Math.sin(bullet.angle) * tail
    graphics.lineWidth = glow ? STROKES.bulletGlow : STROKES.bulletMain
    graphics.strokeColor = glow
      ? this.color(bullet.kind === 'missile' ? COLORS.orange : COLORS.yellow, bullet.kind === 'missile' ? 70 : 55)
      : this.color(COLORS.white)
    graphics.moveTo(bullet.x, bullet.y)
    graphics.lineTo(x2, y2)
    graphics.stroke()
    if (!glow && bullet.kind === 'missile') {
      graphics.fillColor = this.color(COLORS.white)
      this.polygon(graphics, bullet.x, bullet.y, 7 * this.touchControls.unitsPerPixel, 3, bullet.angle, true)
    }
  }

  private renderEntities(graphics: Graphics): void {
    for (const enemy of this.world.enemies) {
      if (enemy.dead) continue
      const spawnAlpha = enemy.spawnTimer > 0 ? 1 - enemy.spawnTimer / 0.45 : 1
      this.drawEnemy(graphics, enemy, true, spawnAlpha)
    }
    for (const supply of this.world.supplies) if (!supply.dead) this.drawSupply(graphics, supply, true)
    for (const ally of this.world.allies) if (ally.life > 0) this.drawAlly(graphics, ally, true)
    if (this.world.player.alive) {
      const flicker = this.world.player.invulnerable > 0 && Math.floor(this.time * 14) % 2 === 0
      if (!flicker) this.drawPlayer(graphics, true)
    }
    for (const enemy of this.world.enemies) {
      if (enemy.dead) continue
      const spawnAlpha = enemy.spawnTimer > 0 ? 1 - enemy.spawnTimer / 0.45 : 1
      this.drawEnemy(graphics, enemy, false, spawnAlpha)
    }
    for (const supply of this.world.supplies) if (!supply.dead) this.drawSupply(graphics, supply, false)
    for (const ally of this.world.allies) if (ally.life > 0) this.drawAlly(graphics, ally, false)
    if (this.world.player.alive) {
      const flicker = this.world.player.invulnerable > 0 && Math.floor(this.time * 14) % 2 === 0
      if (!flicker) this.drawPlayer(graphics, false)
    }
  }

  private drawPlayer(graphics: Graphics, glow: boolean): void {
    const player = this.world.player
    const scale = this.touchControls.unitsPerPixel
    const forwardX = Math.cos(player.angle)
    const forwardY = Math.sin(player.angle)
    const sideX = -forwardY
    const sideY = forwardX
    graphics.strokeColor = this.color(glow ? FIGHTER_GLOW_COLOR : FIGHTER_HULL_COLOR, glow ? FIGHTER_GLOW_ALPHA : 255)
    this.drawPlayerPath(graphics, FIGHTER_OUTER_PATH, glow ? FIGHTER_OUTER_GLOW_STROKE : FIGHTER_OUTER_STROKE, scale, player.x, player.y, forwardX, forwardY, sideX, sideY)
    this.drawPlayerPath(graphics, FIGHTER_INNER_PATH, glow ? FIGHTER_INNER_GLOW_STROKE : FIGHTER_INNER_STROKE, scale, player.x, player.y, forwardX, forwardY, sideX, sideY)
  }

  private drawPlayerPath(graphics: Graphics, points: readonly { forward: number; side: number }[], stroke: number, scale: number, playerX: number, playerY: number, forwardX: number, forwardY: number, sideX: number, sideY: number): void {
    graphics.lineWidth = stroke * scale
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index]
      const x = playerX + (forwardX * point.forward + sideX * point.side) * scale
      const y = playerY + (forwardY * point.forward + sideY * point.side) * scale
      if (index === 0) graphics.moveTo(x, y)
      else graphics.lineTo(x, y)
    }
    graphics.stroke()
  }

  private drawAlly(graphics: Graphics, ally: Ally, glow: boolean): void {
    const scale = this.touchControls.unitsPerPixel
    const forwardX = Math.cos(ally.angle)
    const forwardY = Math.sin(ally.angle)
    const sideX = -forwardY
    const sideY = forwardX
    graphics.lineWidth = (glow ? 10 : 1.8) * scale
    graphics.strokeColor = this.color(COLORS.cyan, glow ? 62 : 255)
    graphics.circle(ally.x, ally.y, 5.5 * scale)
    graphics.stroke()
    graphics.moveTo(ally.x + forwardX * 12 * scale, ally.y + forwardY * 12 * scale)
    graphics.lineTo(ally.x + (forwardX * 3 + sideX * 7) * scale, ally.y + (forwardY * 3 + sideY * 7) * scale)
    graphics.lineTo(ally.x + (-forwardX * 7 + sideX * 4) * scale, ally.y + (-forwardY * 7 + sideY * 4) * scale)
    graphics.moveTo(ally.x + (forwardX * 3 - sideX * 7) * scale, ally.y + (forwardY * 3 - sideY * 7) * scale)
    graphics.lineTo(ally.x + forwardX * 12 * scale, ally.y + forwardY * 12 * scale)
    graphics.lineTo(ally.x + (-forwardX * 7 - sideX * 4) * scale, ally.y + (-forwardY * 7 - sideY * 4) * scale)
    graphics.stroke()
  }

  private drawSupply(graphics: Graphics, supply: Supply, glow: boolean): void {
    const scale = this.touchControls.unitsPerPixel
    const alpha = supply.spawnTimer > 0 ? 1 - supply.spawnTimer / 0.6 : 1
    const rotation = this.time * (glow ? 0.65 : -0.85)
    graphics.lineWidth = (glow ? 13 : 2.2) * scale
    graphics.strokeColor = this.color(COLORS.hud, Math.floor(alpha * (glow ? 68 : 255)))
    graphics.circle(supply.x, supply.y, supply.radius + 4 * scale)
    graphics.stroke()
    for (let orbit = 0; orbit < 2; orbit += 1) {
      const orbitRadius = supply.radius - (3 + orbit * 6) * scale
      const orbitStart = rotation * (orbit === 0 ? -1.8 : 2.1) + orbit * Math.PI * 0.5
      graphics.arc(supply.x, supply.y, orbitRadius, orbitStart, orbitStart + Math.PI * 1.25, false)
      graphics.stroke()
    }
    for (let ray = 0; ray < 4; ray += 1) {
      const rayAngle = ray * Math.PI * 0.5 - rotation * 0.4
      graphics.moveTo(supply.x + Math.cos(rayAngle) * (supply.radius + 8 * scale), supply.y + Math.sin(rayAngle) * (supply.radius + 8 * scale))
      graphics.lineTo(supply.x + Math.cos(rayAngle) * (supply.radius + 16 * scale), supply.y + Math.sin(rayAngle) * (supply.radius + 16 * scale))
    }
    graphics.stroke()
    graphics.strokeColor = this.color(COLORS.white, Math.floor(alpha * (glow ? 62 : 255)))
    if (supply.effect === 'detonation') {
      for (let spoke = 0; spoke < 6; spoke += 1) {
        const spokeAngle = rotation + spoke / 6 * Math.PI * 2
        graphics.moveTo(supply.x + Math.cos(spokeAngle) * 3 * scale, supply.y + Math.sin(spokeAngle) * 3 * scale)
        graphics.lineTo(supply.x + Math.cos(spokeAngle) * 11 * scale, supply.y + Math.sin(spokeAngle) * 11 * scale)
      }
      graphics.stroke()
    } else if (supply.effect === 'overload') {
      graphics.moveTo(supply.x + 2 * scale, supply.y + 11 * scale)
      graphics.lineTo(supply.x - 5 * scale, supply.y - scale)
      graphics.lineTo(supply.x + scale, supply.y - scale)
      graphics.lineTo(supply.x - 2 * scale, supply.y - 11 * scale)
      graphics.lineTo(supply.x + 7 * scale, supply.y + 3 * scale)
      graphics.lineTo(supply.x + scale, supply.y + 3 * scale)
      graphics.stroke()
    } else {
      this.polygon(graphics, supply.x, supply.y, 9 * scale, 3, rotation, false)
      graphics.fillColor = this.color(COLORS.white, Math.floor(alpha * 255))
      graphics.circle(supply.x, supply.y, 2.6 * scale)
      graphics.fill()
    }
    if (glow) return
    for (let index = 0; index < supply.maxHealth; index += 1) {
      const angle = index / supply.maxHealth * Math.PI * 2 - Math.PI * 0.5
      graphics.fillColor = this.color(COLORS.white, index < supply.health ? 255 : 50)
      graphics.circle(supply.x + Math.cos(angle) * (supply.radius + 8 * scale), supply.y + Math.sin(angle) * (supply.radius + 8 * scale), 2 * scale)
      graphics.fill()
    }
  }

  private drawEnemy(graphics: Graphics, enemy: Enemy, glow: boolean, alpha: number): void {
    const colorHex = this.world.enemyColor(enemy.kind)
    graphics.strokeColor = this.color(colorHex, Math.floor(alpha * (glow ? 70 : 245)))
    graphics.fillColor = this.color(colorHex, Math.floor(alpha * (glow ? 22 : 35)))
    graphics.lineWidth = glow ? STROKES.enemyGlow : STROKES.enemyMain
    if (enemy.kind === 'wanderer') {
      for (let arm = 0; arm < 4; arm += 1) {
        const angle = enemy.angle + arm * Math.PI * 0.5
        const sideAngle = angle - Math.PI * 0.5
        graphics.moveTo(enemy.x + Math.cos(angle) * 2 * this.touchControls.unitsPerPixel, enemy.y + Math.sin(angle) * 2 * this.touchControls.unitsPerPixel)
        graphics.lineTo(
          enemy.x + Math.cos(angle) * enemy.radius * 0.42 + Math.cos(sideAngle) * enemy.radius * 0.32,
          enemy.y + Math.sin(angle) * enemy.radius * 0.42 + Math.sin(sideAngle) * enemy.radius * 0.32
        )
        graphics.lineTo(
          enemy.x + Math.cos(angle) * enemy.radius + Math.cos(sideAngle) * enemy.radius * 0.08,
          enemy.y + Math.sin(angle) * enemy.radius + Math.sin(sideAngle) * enemy.radius * 0.08
        )
        graphics.lineTo(
          enemy.x + Math.cos(angle) * enemy.radius * 0.58 - Math.cos(sideAngle) * enemy.radius * 0.2,
          enemy.y + Math.sin(angle) * enemy.radius * 0.58 - Math.sin(sideAngle) * enemy.radius * 0.2
        )
      }
      graphics.stroke()
    } else if (enemy.kind === 'grunt') {
      this.polygon(graphics, enemy.x, enemy.y, enemy.radius, 4, enemy.angle + Math.PI * 0.25, true)
      if (!glow) {
        const forwardX = Math.cos(enemy.angle)
        const forwardY = Math.sin(enemy.angle)
        const sideX = -forwardY
        const sideY = forwardX
        graphics.moveTo(enemy.x - forwardX * enemy.radius * 0.7, enemy.y - forwardY * enemy.radius * 0.7)
        graphics.lineTo(enemy.x + forwardX * enemy.radius * 0.7, enemy.y + forwardY * enemy.radius * 0.7)
        graphics.moveTo(enemy.x - sideX * enemy.radius * 0.7, enemy.y - sideY * enemy.radius * 0.7)
        graphics.lineTo(enemy.x + sideX * enemy.radius * 0.7, enemy.y + sideY * enemy.radius * 0.7)
        graphics.stroke()
      }
    } else if (enemy.kind === 'weaver') {
      this.polygon(graphics, enemy.x, enemy.y, enemy.radius, 4, enemy.angle, true)
      if (!glow) this.polygon(graphics, enemy.x, enemy.y, enemy.radius * 0.72, 4, enemy.angle + Math.PI * 0.25, false)
    } else if (enemy.kind === 'spinner') {
      this.polygon(graphics, enemy.x, enemy.y, enemy.radius, 4, enemy.angle, true)
      if (!glow) {
        const diagonalX = Math.cos(enemy.angle + Math.PI * 0.25)
        const diagonalY = Math.sin(enemy.angle + Math.PI * 0.25)
        const crossX = -diagonalY
        const crossY = diagonalX
        graphics.moveTo(enemy.x - diagonalX * enemy.radius, enemy.y - diagonalY * enemy.radius)
        graphics.lineTo(enemy.x + diagonalX * enemy.radius, enemy.y + diagonalY * enemy.radius)
        graphics.moveTo(enemy.x - crossX * enemy.radius, enemy.y - crossY * enemy.radius)
        graphics.lineTo(enemy.x + crossX * enemy.radius, enemy.y + crossY * enemy.radius)
        graphics.stroke()
      }
    } else if (enemy.kind === 'snake') {
      graphics.strokeColor = this.color(COLORS.cyan, Math.floor(alpha * (glow ? 70 : 245)))
      this.polygon(graphics, enemy.x, enemy.y, enemy.radius, 3, enemy.angle, true)
      graphics.strokeColor = this.color(colorHex, Math.floor(alpha * (glow ? 70 : 245)))
      for (let index = enemy.segments.length - 1; index >= 0; index -= 1) {
        const segment = enemy.segments[index]
        const radius = (7 + (enemy.segments.length - index) * 0.35) * this.touchControls.unitsPerPixel
        this.polygon(graphics, segment.x, segment.y, radius, 4, segment.angle + Math.PI * 0.25, index % 2 === 0)
      }
    } else if (enemy.kind === 'repulsar') {
      const forwardX = Math.cos(enemy.angle)
      const forwardY = Math.sin(enemy.angle)
      const sideX = -forwardY
      const sideY = forwardX
      graphics.moveTo(enemy.x + forwardX * enemy.radius, enemy.y + forwardY * enemy.radius)
      graphics.lineTo(enemy.x + forwardX * enemy.radius * 0.15 + sideX * enemy.radius * 0.62, enemy.y + forwardY * enemy.radius * 0.15 + sideY * enemy.radius * 0.62)
      graphics.lineTo(enemy.x - forwardX * enemy.radius * 0.72 + sideX * enemy.radius * 0.42, enemy.y - forwardY * enemy.radius * 0.72 + sideY * enemy.radius * 0.42)
      graphics.lineTo(enemy.x - forwardX * enemy.radius * 0.35, enemy.y - forwardY * enemy.radius * 0.35)
      graphics.lineTo(enemy.x - forwardX * enemy.radius * 0.72 - sideX * enemy.radius * 0.42, enemy.y - forwardY * enemy.radius * 0.72 - sideY * enemy.radius * 0.42)
      graphics.lineTo(enemy.x + forwardX * enemy.radius * 0.15 - sideX * enemy.radius * 0.62, enemy.y + forwardY * enemy.radius * 0.15 - sideY * enemy.radius * 0.62)
      graphics.close()
      graphics.stroke()
      graphics.strokeColor = this.color(COLORS.cyan, Math.floor(alpha * (glow ? 70 : 245)))
      graphics.moveTo(enemy.x - forwardX * enemy.radius * 0.72 + sideX * enemy.radius * 0.42, enemy.y - forwardY * enemy.radius * 0.72 + sideY * enemy.radius * 0.42)
      graphics.lineTo(enemy.x - forwardX * enemy.radius, enemy.y - forwardY * enemy.radius)
      graphics.lineTo(enemy.x - forwardX * enemy.radius * 0.72 - sideX * enemy.radius * 0.42, enemy.y - forwardY * enemy.radius * 0.72 - sideY * enemy.radius * 0.42)
      graphics.stroke()
    } else {
      const pulse = Math.sin(this.time * 4 + enemy.phase) * 3
      graphics.circle(enemy.x, enemy.y, enemy.radius + pulse)
      graphics.stroke()
      graphics.circle(enemy.x, enemy.y, enemy.radius * 0.63)
      if (!glow) {
        graphics.fillColor = this.color(COLORS.background, 235)
        graphics.fill()
        graphics.strokeColor = this.color(COLORS.orange, 230)
        graphics.circle(enemy.x, enemy.y, enemy.radius * 1.22 + pulse)
        graphics.stroke()
        graphics.strokeColor = this.color(COLORS.violet, 220)
        graphics.arc(enemy.x, enemy.y, enemy.radius * 0.48, -this.time * 1.7, -this.time * 1.7 + Math.PI * 1.35, false)
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

  private renderControls(graphics: Graphics): void {
    if (this.world.state !== 'playing') return
    const scale = this.touchControls.unitsPerPixel
    const defaultY = -this.world.height * 0.5 + TOUCH.defaultBottom * scale
    const defaultX = this.world.width * 0.5 - TOUCH.defaultSide * scale
    const heading = this.touchControls.singleHanded && this.world.hasFireHeading ? this.world.fireHeading : null
    this.drawStick(graphics, this.leftStick, this.touchControls.singleHanded ? 0 : -defaultX, defaultY, COLORS.cyan, heading, scale)
    if (!this.touchControls.singleHanded) this.drawStick(graphics, this.rightStick, defaultX, defaultY, COLORS.magenta, null, scale)
    const bomb = this.bombPosition()
    graphics.lineWidth = STROKES.controlRing * scale
    graphics.strokeColor = this.color(COLORS.yellow, 125)
    graphics.fillColor = this.color(COLORS.orange, 58)
    graphics.circle(bomb.x, bomb.y, TOUCH.bombRadius * scale)
    graphics.fill()
    graphics.stroke()
  }

  private bombPosition(): Vector {
    const scale = this.touchControls.unitsPerPixel
    this.bombPositionScratch.x = this.touchControls.singleHanded ? this.world.width * 0.5 - TOUCH.bombOffset * scale : 0
    this.bombPositionScratch.y = -this.world.height * 0.5 + TOUCH.bombOffset * scale
    return this.bombPositionScratch
  }

  private drawStick(graphics: Graphics, stick: StickState, defaultX: number, defaultY: number, hex: string, heading: number | null, scale: number): void {
    const baseX = stick.active ? stick.base.x : defaultX
    const baseY = stick.active ? stick.base.y : defaultY
    const knobX = stick.active ? stick.knob.x : baseX
    const knobY = stick.active ? stick.knob.y : baseY
    if (stick.active && heading !== null) {
      const sectorRadius = TOUCH.sectorRadius * scale
      graphics.lineWidth = STROKES.control * scale
      graphics.strokeColor = this.color(hex, 88)
      graphics.moveTo(baseX, baseY)
      graphics.lineTo(baseX + Math.cos(heading - AIM_ASSIST_HALF_ANGLE) * sectorRadius, baseY + Math.sin(heading - AIM_ASSIST_HALF_ANGLE) * sectorRadius)
      graphics.moveTo(baseX, baseY)
      graphics.lineTo(baseX + Math.cos(heading + AIM_ASSIST_HALF_ANGLE) * sectorRadius, baseY + Math.sin(heading + AIM_ASSIST_HALF_ANGLE) * sectorRadius)
      graphics.stroke()
      graphics.arc(baseX, baseY, sectorRadius, heading - AIM_ASSIST_HALF_ANGLE, heading + AIM_ASSIST_HALF_ANGLE, false)
      graphics.stroke()
      graphics.strokeColor = this.color(hex, 142)
      graphics.moveTo(baseX, baseY)
      graphics.lineTo(baseX + Math.cos(heading) * TOUCH.headingRay * scale, baseY + Math.sin(heading) * TOUCH.headingRay * scale)
      graphics.stroke()
    }
    graphics.lineWidth = STROKES.controlRing * scale
    graphics.strokeColor = this.color(hex, stick.active ? 155 : 58)
    graphics.fillColor = this.color(hex, stick.active ? 28 : 12)
    graphics.circle(baseX, baseY, TOUCH.ringRadius * scale)
    graphics.fill()
    graphics.stroke()
    graphics.fillColor = this.color(hex, stick.active ? 82 : 25)
    graphics.circle(knobX, knobY, TOUCH.knobRadius * scale)
    graphics.fill()
    graphics.stroke()
  }

  private updateInterface(): void {
    const width = this.world.width
    const height = this.world.height
    const hud = scoreHudAnchor({ width, height }, sys.getSafeAreaRect(false), LAYOUT.scoreHeight)
    this.scoreLabel.node.setPosition(hud.x, hud.y)
    this.setLabelText(this.scoreLabel, `SCORE  ${this.scoreText(this.world.score)}\nHIGH   ${this.scoreText(this.world.highScore)}`)
    const statusWidth = width - LAYOUT.scoreWidth - LAYOUT.scoreEdge * 3
    this.statusLabel.node.getComponent(UITransform)?.setContentSize(statusWidth, LAYOUT.scoreHeight)
    this.statusLabel.node.setPosition(width * 0.5 - LAYOUT.scoreEdge, hud.y)
    const specialStatus: string[] = []
    if (this.world.missileTimer > 0) specialStatus.push(`MISSILE ${this.world.missileTimer.toFixed(1)}`)
    if (this.world.overloadTimer > 0) specialStatus.push(`OVERDRIVE ${this.world.overloadTimer.toFixed(1)}`)
    if (this.world.allies.length > 0) specialStatus.push(`ALLY ×${this.world.allies.length}`)
    const specialLine = specialStatus.length > 0 ? `\n${specialStatus.join('  ')}` : ''
    const supplyLine = this.world.supplies.some((supply) => !supply.dead) ? 'SUPER ACTIVE' : `SUPER ${Math.max(0, Math.ceil(this.world.supplyClock))}s`
    this.setLabelText(this.statusLabel, `×${this.world.multiplier}   ◇ ${this.world.lives}   ✦ ${this.world.bombs}   W${weaponTier(this.world.score)}${specialLine}\n${supplyLine}`)
    this.titleLabel.node.setPosition(0, LAYOUT.titleY)
    this.subtitleLabel.node.setPosition(0, LAYOUT.subtitleY)
    this.promptLabel.node.setPosition(0, LAYOUT.promptY)
    this.messageLabel.node.setPosition(0, LAYOUT.messageY)
    const showTitle = this.world.state === 'title'
    const showGameOver = this.world.state === 'gameover'
    this.titleLabel.node.active = showTitle || showGameOver
    this.subtitleLabel.node.active = showTitle || showGameOver
    this.promptLabel.node.active = showTitle || showGameOver || this.world.state === 'paused'
    if (showTitle) {
      this.setLabelText(this.titleLabel, 'GEOMETRY\nFIGHTER')
      this.titleLabel.color = this.color(COLORS.white)
      this.setLabelText(this.subtitleLabel, '竖屏单手 · 拖动方向自动射击 · 保持倍率')
      this.setLabelText(this.promptLabel, '下半屏单指拖动  /  ONE THUMB TO ENGAGE')
    } else if (showGameOver) {
      this.setLabelText(this.titleLabel, 'GRID\nCOLLAPSED')
      this.titleLabel.color = this.color(COLORS.red)
      this.setLabelText(this.subtitleLabel, `FINAL SCORE  ${this.scoreText(this.world.score)}`)
      this.setLabelText(this.promptLabel, '触摸重新接入网格  /  TOUCH TO RESTART')
    } else if (this.world.state === 'paused') {
      this.setLabelText(this.promptLabel, 'PAUSED  /  触摸 P 继续')
    }
  }

  private setLabelText(label: Label, value: string): void {
    if (label.string !== value) label.string = value
  }

  private rgb(red: number, green: number, blue: number, alpha: number): Color {
    return this.colorScratch.set(red, green, blue, clamp(alpha, 0, 255))
  }

  private color(hex: string, alpha = 255): Color {
    const value = hex.startsWith('#') ? hex.slice(1) : hex
    const number = Number.parseInt(value, 16)
    return this.rgb((number >> 16) & 255, (number >> 8) & 255, number & 255, alpha)
  }

  private scoreText(value: number): string {
    return (`00000000${Math.floor(value)}`).slice(-8)
  }
}
