// allow: SIZE_OK — one scene-owned state surface keeps the frame loop flat.
// Standalone game shell: simulation, audio, and touch logic stay in their own
// engine-free modules; this class orchestrates them over the batched
// VectorRenderer, HUD text surfaces, and the platform seam. It replaces the
// former Cocos component with a zero-allocation frame loop.

import {
  AIM_ASSIST_HALF_ANGLE,
  GeometryWorld,
  clamp,
  length,
  weaponTier
} from './simulation.ts'
import type { Ally, Bullet, ControlState, Enemy, Geom, Supply, Vector, WorldEvent } from './simulation.ts'
import {
  DESIGN_WIDTH,
  GRID_SPACING,
  MAX_GRID_WARP_RIPPLES,
  MAX_PARTICLES,
  MAX_RIPPLES,
  ReactiveGridLattice,
  STAR_COUNT,
  gridBounds,
  gridPointIndex,
  hudLayout
} from './presentation.ts'
import type { GridBounds } from './presentation.ts'
import { ALLY_ART, COLORS, COMBAT_ART_SCALE, ENEMY_ART_RADIUS, GEOM_ART, GRID_LINES, LAYOUT, MISSILE_ART, PROJECTILE_ART, STROKES, SUPER_WEAPON_ART, TOUCH, TYPOGRAPHY } from './design-tokens.ts'
import type { GridLineStyle } from './design-tokens.ts'
import { Synth } from './synth.ts'
import { TouchControls } from './touch-controls.ts'
import type { StickState } from './touch-controls.ts'
import {
  FIGHTER_GLOW_ALPHA,
  FIGHTER_GLOW_COLOR,
  FIGHTER_HULL_COLOR,
  FIGHTER_INNER_GLOW_STROKE,
  FIGHTER_INNER_PATH,
  FIGHTER_INNER_STROKE,
  FIGHTER_OUTER_GLOW_STROKE,
  FIGHTER_OUTER_PATH,
  FIGHTER_OUTER_STROKE,
  FIGHTER_THRUSTER_COLOR,
  FIGHTER_THRUSTER_PATH
} from './fighter-shape.ts'
import { VectorRenderer } from './renderer.ts'
import { TextLabel } from './text-surface.ts'
import type { FrameCamera } from './gl-surface.ts'
import type { PlatformHost, TouchPoint } from './platform.ts'

const DEATH_SLOW_SECONDS = 0.9
const GRID_SPRING_STIFFNESS = 90
const GRID_SPRING_DAMPING = 7.5
const GRID_WAKE_RADIUS = 80
const GRID_WAKE_FORCE_SCALE = 0.12
const QUALITY_PARTICLE_BUDGETS = [Math.floor(MAX_PARTICLES * 0.4), Math.floor(MAX_PARTICLES * 0.7), MAX_PARTICLES]
const HIGH_SCORE_KEY = 'geometry-fighter-high-score'
const HIGH_SCORE_WRITE_INTERVAL = 2
const HUD_REFRESH_INTERVAL = 0.1
const BACKGROUND_RGB: readonly [number, number, number] = [0, 0, 6 / 255]
const OVERLOAD_ICON_FLAT: readonly number[] = [2, 11, -5, -1, 1, -1, -2, -11, 7, 3, 1, 3]
const REPULSAR_SHELL_FLAT: readonly number[] = [1, 0, 0.15, 0.62, -0.72, 0.42, -0.35, 0, -0.72, -0.42, 0.15, -0.62]
const REPULSAR_TAIL_FLAT: readonly number[] = [-0.72, 0.42, -1, 0, -0.72, -0.42]
const MISSILE_CONTRAIL_ALPHAS: readonly number[] = [0.35, 0.18, 0.11, 0.08]

export interface FrameSink {
  drawFrame(renderer: VectorRenderer, labels: readonly TextLabel[], options: { camera: FrameCamera; background: readonly [number, number, number] }): void
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

interface LabelSpec {
  readonly name: 'score' | 'status' | 'title' | 'subtitle' | 'prompt' | 'message'
  readonly width: number
  readonly height: number
  readonly fontSize: number
  readonly lineHeight: number
  readonly align: 'left' | 'center' | 'right'
  readonly monospace: boolean
  readonly display?: boolean
}

const LABEL_SPECS: readonly LabelSpec[] = [
  { name: 'score', width: LAYOUT.scoreWidth, height: LAYOUT.scoreHeight, fontSize: TYPOGRAPHY.hudPrimary, lineHeight: TYPOGRAPHY.hudPrimary + TYPOGRAPHY.lineHeightExtra, align: 'left', monospace: true },
  { name: 'status', width: 420, height: LAYOUT.scoreHeight, fontSize: TYPOGRAPHY.hudSecondary, lineHeight: TYPOGRAPHY.hudSecondary + TYPOGRAPHY.lineHeightExtra, align: 'right', monospace: true },
  { name: 'title', width: LAYOUT.labelWidth, height: LAYOUT.labelHeight, fontSize: TYPOGRAPHY.display, lineHeight: TYPOGRAPHY.displayLineHeight, align: 'center', monospace: false, display: true },
  { name: 'subtitle', width: LAYOUT.labelWidth, height: LAYOUT.labelHeight, fontSize: TYPOGRAPHY.subtitle, lineHeight: TYPOGRAPHY.subtitle + TYPOGRAPHY.lineHeightExtra, align: 'center', monospace: false },
  { name: 'prompt', width: LAYOUT.labelWidth, height: LAYOUT.labelHeight, fontSize: TYPOGRAPHY.prompt, lineHeight: TYPOGRAPHY.prompt + TYPOGRAPHY.lineHeightExtra, align: 'center', monospace: false },
  { name: 'message', width: LAYOUT.labelWidth, height: LAYOUT.labelHeight, fontSize: TYPOGRAPHY.message, lineHeight: TYPOGRAPHY.message + TYPOGRAPHY.lineHeightExtra, align: 'center', monospace: true }
]

function fighterFlat(points: readonly { forward: number; side: number }[]): number[] {
  const flat: number[] = []
  for (const point of points) flat.push(point.forward, point.side)
  return flat
}

const FIGHTER_OUTER_FLAT = fighterFlat(FIGHTER_OUTER_PATH)
const FIGHTER_INNER_FLAT = fighterFlat(FIGHTER_INNER_PATH)
const FIGHTER_THRUSTER_FLAT = fighterFlat(FIGHTER_THRUSTER_PATH)

// Missile silhouette in local frame: +forward is the nose, +side is one wing.
const MISSILE_HULL_FLAT: readonly number[] = [
  MISSILE_ART.noseForward, 0,
  MISSILE_ART.noseShoulderForward, MISSILE_ART.noseShoulderSide,
  MISSILE_ART.bodyForward, MISSILE_ART.bodySide,
  MISSILE_ART.tailForward, MISSILE_ART.tailSide,
  MISSILE_ART.capForward, MISSILE_ART.capSide,
  MISSILE_ART.capForward, -MISSILE_ART.capSide,
  MISSILE_ART.tailForward, -MISSILE_ART.tailSide,
  MISSILE_ART.bodyForward, -MISSILE_ART.bodySide,
  MISSILE_ART.noseShoulderForward, -MISSILE_ART.noseShoulderSide
]

const MISSILE_FIN_PORT: readonly number[] = [
  MISSILE_ART.finRootForward, MISSILE_ART.finRootSide,
  MISSILE_ART.finTipForward, MISSILE_ART.finTipSide,
  MISSILE_ART.finTrailForward, MISSILE_ART.finTrailSide
]

const MISSILE_FIN_STARBOARD: readonly number[] = [
  MISSILE_ART.finRootForward, -MISSILE_ART.finRootSide,
  MISSILE_ART.finTipForward, -MISSILE_ART.finTipSide,
  MISSILE_ART.finTrailForward, -MISSILE_ART.finTrailSide
]

function scoreText(value: number): string {
  return (`00000000${Math.floor(value)}`).slice(-8)
}

export class GameApp {
  readonly renderer = new VectorRenderer()
  private readonly world = new GeometryWorld()
  private readonly synth = new Synth()
  private readonly controls: ControlState = {
    move: { x: 0, y: 0 },
    aim: { x: 0, y: 0 },
    engaged: false,
    start: false,
    pause: false
  }

  private readonly touchControls = new TouchControls()
  private readonly leftStick = this.touchControls.left
  private readonly rightStick = this.touchControls.right
  private readonly keys = new Set<string>()
  private readonly particles: Particle[] = []
  private readonly ripples: Ripple[] = []
  private readonly playerTrail: TrailPoint[] = []
  private readonly stars: Star[] = []
  private readonly activeBlackholes: Enemy[] = []
  private readonly activeGridRipples: Ripple[] = []
  private readonly gridLattice = new ReactiveGridLattice(GRID_SPRING_STIFFNESS, GRID_SPRING_DAMPING)
  private readonly labels: TextLabel[] = []
  private readonly labelsByName = new Map<string, TextLabel>()
  private readonly pathScratch: number[] = []
  private readonly platform: PlatformHost
  private readonly sink: FrameSink
  private readonly glCanvas: { width: number; height: number }
  private gridLayout: GridBounds = gridBounds(DESIGN_WIDTH, 1280, GRID_SPACING)
  private particleReplaceCursor = 0
  private frameDt = 0.016
  private shakeIntensity = 0
  private flashIntensity = 0
  private slowMotion = 0
  private qualityTier = 2
  private qualityHold = 0
  private frameCost = 16.7
  private particleBudget = MAX_PARTICLES
  private messageTimer = 0
  private time = 0
  private highScoreClock = 0
  private storedHighScore = 0
  private hudClock = 0
  private hudState = ''
  private lastFrameAt = 0
  private running = false
  private unitsPerCssPixel = 1
  private metricsWidth = 390
  private metricsHeight = 844
  private safeAreaBottomWorld = 0
  private safeAreaHeightWorld = 0
  private safeLeft = 0
  private safeRight = 0
  private safeTop = 0
  private menuBottomWorld = 0
  private lastPlayerPosition: Vector = { x: 0, y: 0 }
  private wasPlayerAlive = false
  private demoMode: 'play' | 'missile' | null = null
  private demoElapsed = 0

  constructor(platform: PlatformHost, sink: FrameSink) {
    this.platform = platform
    this.sink = sink
    this.glCanvas = platform.glCanvas as { width: number; height: number }
    for (const spec of LABEL_SPECS) {
      const label = new TextLabel({ ...spec, outlineWidth: TYPOGRAPHY.outlineWidth }, platform.createRaster)
      this.labels.push(label)
      this.labelsByName.set(spec.name, label)
    }
    this.labelOf('message').visible = false
    this.platform.onFontLoaded?.(() => {
      for (const label of this.labels) label.dirty = true
    })
    this.populateStars()
    this.storedHighScore = Number(platform.storageGet(HIGH_SCORE_KEY) || 0)
    this.world.highScore = this.storedHighScore
    this.resizeWorld()
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.bindInput()
    this.lastFrameAt = this.platform.now()
    this.platform.requestFrame(this.frame)
  }

  // Browser-preview art QA hook: a hands-free run that moves and fires on its
  // own so combat frames can be captured without touch input.
  runHandsFreeDemo(missiles: boolean): void {
    this.world.reset()
    this.demoMode = missiles ? 'missile' : 'play'
    if (missiles) this.world.missileTimer = Number.POSITIVE_INFINITY
  }

  private labelOf(name: LabelSpec['name']): TextLabel {
    return this.labelsByName.get(name) as TextLabel
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
    this.platform.onTouch({
      start: (point) => this.onTouchStart(point),
      move: (point) => this.onTouchMove(point),
      end: (id) => this.onTouchEnd(id)
    })
    this.platform.onKey({
      down: (event) => this.onKeyDown(event.key.toLowerCase()),
      up: (event) => this.keys.delete(event.key.toLowerCase())
    })
    this.platform.onVisibility((visible) => {
      if (!visible) {
        this.touchControls.end(this.leftStick.id)
        this.touchControls.end(this.rightStick.id)
        this.syncSticks()
      }
    })
    this.platform.onResize(() => this.resizeWorld())
  }

  private resizeWorld(): void {
    const metrics = this.platform.metrics()
    this.metricsWidth = metrics.width
    this.metricsHeight = metrics.height
    this.glCanvas.width = metrics.width
    this.glCanvas.height = metrics.height
    this.unitsPerCssPixel = DESIGN_WIDTH / metrics.width
    const worldHeight = Math.max(360, DESIGN_WIDTH * metrics.height / metrics.width)
    this.touchControls.resize(DESIGN_WIDTH, worldHeight, this.unitsPerCssPixel)
    this.world.resize(DESIGN_WIDTH, worldHeight, this.unitsPerCssPixel)
    this.safeLeft = metrics.safeLeft * this.unitsPerCssPixel
    this.safeRight = metrics.safeRight * this.unitsPerCssPixel
    this.safeTop = metrics.safeTop * this.unitsPerCssPixel
    this.safeAreaBottomWorld = worldHeight - metrics.safeBottom * this.unitsPerCssPixel
    this.safeAreaHeightWorld = Math.max(0, (metrics.height - metrics.safeTop - metrics.safeBottom) * this.unitsPerCssPixel)
    this.menuBottomWorld = metrics.menuBottom * this.unitsPerCssPixel
    this.gridLayout = gridBounds(this.world.width, this.world.height, GRID_SPACING)
    this.syncSticks()
  }

  private touchToWorld(point: TouchPoint): TouchPoint {
    return {
      id: point.id,
      x: (point.x - this.metricsWidth * 0.5) * this.unitsPerCssPixel,
      y: -(point.y - this.metricsHeight * 0.5) * this.unitsPerCssPixel
    }
  }

  private onTouchStart(point: TouchPoint): void {
    this.synth.unlock()
    this.controls.start = true
    this.touchControls.start(this.touchToWorld(point))
    this.syncSticks()
  }

  private onTouchMove(point: TouchPoint): void {
    this.touchControls.move(this.touchToWorld(point))
    this.syncSticks()
  }

  private onTouchEnd(id: number): void {
    this.touchControls.end(id)
    this.syncSticks()
  }

  private syncSticks(): void {
    const vectors = this.touchControls.vectors()
    this.controls.move = vectors.move
    this.controls.aim = vectors.aim
    this.controls.engaged = vectors.engaged
  }

  private onKeyDown(key: string): void {
    this.keys.add(key)
    if (key === 'enter') {
      this.synth.unlock()
      this.controls.start = true
    }
    if (key === 'p' || key === 'escape') this.controls.pause = true
  }

  private updateKeyboard(): void {
    const keys = this.keys
    const moveX = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'))
    const moveY = Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown'))
    const aimX = Number(keys.has('l')) - Number(keys.has('j'))
    const aimY = Number(keys.has('i')) - Number(keys.has('k'))
    if (moveX || moveY) {
      const size = length(moveX, moveY)
      this.controls.move = { x: moveX / size, y: moveY / size }
    } else if (!this.leftStick.active) this.controls.move = { x: 0, y: 0 }
    if (aimX || aimY) {
      const size = length(aimX, aimY)
      this.controls.aim = { x: aimX / size, y: aimY / size }
    } else if (!this.rightStick.active && !(this.touchControls.singleHanded && this.leftStick.active)) this.controls.aim = { x: 0, y: 0 }
    this.controls.engaged = this.leftStick.active || (this.touchControls.singleHanded && Boolean(moveX || moveY))
  }

  private readonly frame = (): void => {
    if (!this.running) return
    const now = this.platform.now()
    const dt = clamp((now - this.lastFrameAt) / 1000, 0, 0.05)
    this.lastFrameAt = now
    this.update(dt)
    this.platform.requestFrame(this.frame)
  }

  update(dt: number): void {
    const frameMs = Math.min(50, dt * 1000)
    this.frameCost += (frameMs - this.frameCost) * 0.08
    this.frameDt = Math.min(dt, 0.034)
    this.evaluateQuality(dt)
    this.time += dt
    this.updateKeyboard()
    if (this.demoMode) {
      this.demoElapsed += dt
      this.controls.move = { x: Math.cos(this.demoElapsed * 0.6) * 0.5, y: Math.sin(this.demoElapsed * 0.8) * 0.6 }
      this.controls.engaged = true
      if (this.demoMode === 'missile') this.world.missileTimer = Number.POSITIVE_INFINITY
    }
    this.slowMotion = Math.max(0, this.slowMotion - dt)
    const timeScale = this.slowMotion > 0 ? 0.32 + 0.68 * (1 - this.slowMotion / DEATH_SLOW_SECONDS) : 1
    const scaledDt = dt * timeScale
    this.world.update(scaledDt, this.controls)
    this.synth.update(this.time, this.world.state === 'playing')
    this.controls.start = false
    this.controls.pause = false
    this.processWorldEvents(this.world.consumeEvents())
    this.updateVisualState(Math.min(scaledDt, 0.034))
    this.updateFeedback(dt)
    this.render()
    this.updateInterface(dt)
    this.persistHighScore(dt)
  }

  private evaluateQuality(dt: number): void {
    this.qualityHold += dt
    if (this.qualityHold < 0.75) return
    if (this.frameCost > 21.5 && this.qualityTier > 0) {
      this.qualityTier -= 1
      this.particleBudget = QUALITY_PARTICLE_BUDGETS[this.qualityTier]
      this.qualityHold = 0
    } else if (this.frameCost < 15.2 && this.qualityTier < 2) {
      this.qualityTier += 1
      this.particleBudget = QUALITY_PARTICLE_BUDGETS[this.qualityTier]
      this.qualityHold = 0
    }
  }

  private addShake(amount: number): void {
    this.shakeIntensity = Math.min(30, this.shakeIntensity + amount)
  }

  private updateFeedback(dt: number): void {
    this.shakeIntensity *= Math.exp(-5.5 * dt)
    if (this.shakeIntensity < 0.05) this.shakeIntensity = 0
    this.flashIntensity = Math.max(0, this.flashIntensity - dt * 2.4)
  }

  private processWorldEvents(events: WorldEvent[]): void {
    for (const event of events) {
      if (event.kind === 'shoot') {
        this.spawnBurst({ x: event.x, y: event.y, color: COLORS.yellow, count: Math.min(4, event.amount), speed: 70 })
        this.addRipple({ x: event.x, y: event.y, radius: 6, speed: 120, life: 0.22, maxLife: 0.22, strength: 5, color: event.color })
        this.synth.tone(360 + event.amount * 65, 0.035, 0.018, 'square', 1.7)
      } else if (event.kind === 'kill') {
        const count = event.weight > 0 ? event.weight : 26
        this.spawnBurst({ x: event.x, y: event.y, color: event.color, count, speed: 235 })
        this.addRipple({ x: event.x, y: event.y, radius: 10, speed: 270, life: 0.65, maxLife: 0.65, strength: Math.min(40, 14 + count * 0.28), color: event.color })
        this.addShake(Math.min(7, 1.2 + count * 0.06))
        this.synth.tone(90, 0.1, 0.04, 'sawtooth', 0.42)
      } else if (event.kind === 'geom') {
        this.spawnBurst({ x: event.x, y: event.y, color: GEOM_ART.core, count: 3, speed: 95 })
        this.synth.tone(860 + event.amount * 18, 0.05, 0.03, 'sine', 1.45)
      } else if (event.kind === 'death') {
        this.spawnBurst({ x: event.x, y: event.y, color: COLORS.white, count: 220, speed: 360 })
        this.addRipple({ x: event.x, y: event.y, radius: 15, speed: 560, life: 0.9, maxLife: 0.9, strength: 44, color: COLORS.red })
        this.addRipple({ x: event.x, y: event.y, radius: 8, speed: 300, life: 0.7, maxLife: 0.7, strength: 30, color: COLORS.white })
        this.addShake(18)
        this.flashIntensity = 1
        this.slowMotion = DEATH_SLOW_SECONDS
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
        this.addShake(13)
        if (event.amount === 2) this.flashIntensity = Math.max(this.flashIntensity, 0.7)
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
      const color = index % 3 === 2 ? COLORS.white : burst.color
      if (this.particles.length < this.particleBudget) {
        this.particles.push({ x: burst.x, y: burst.y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, life, maxLife: life, size: 1.2 + Math.random() * 3.6, color, drag: 1.5 + Math.random() * 3 })
        continue
      }
      if (this.particles.length === 0) return
      const particle = this.particles[this.particleReplaceCursor % this.particles.length]
      particle.x = burst.x
      particle.y = burst.y
      particle.vx = Math.cos(angle) * velocity
      particle.vy = Math.sin(angle) * velocity
      particle.life = life
      particle.maxLife = life
      particle.size = 1.2 + Math.random() * 3.6
      particle.color = color
      particle.drag = 1.5 + Math.random() * 3
      this.particleReplaceCursor = (this.particleReplaceCursor + 1) % this.particles.length
    }
  }

  private showMessage(text: string, color: string, duration: number): void {
    const label = this.labelOf('message')
    label.setText(text)
    label.setColor(color)
    label.visible = true
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

    if (this.world.player.alive && this.world.state === 'playing') {
      if (!this.wasPlayerAlive) {
        this.addRipple({ x: this.world.player.x, y: this.world.player.y, radius: 6, speed: 480, life: 0.8, maxLife: 0.8, strength: 34, color: COLORS.cyan })
        this.spawnBurst({ x: this.world.player.x, y: this.world.player.y, color: COLORS.cyan, count: 24, speed: 260 })
        this.synth.tone(520, 0.2, 0.05, 'triangle', 1.2)
      }
      const moved = length(this.world.player.x - this.lastPlayerPosition.x, this.world.player.y - this.lastPlayerPosition.y)
      if (moved > 2) this.playerTrail.push({ x: this.world.player.x, y: this.world.player.y, life: 0.34 })
      this.lastPlayerPosition.x = this.world.player.x
      this.lastPlayerPosition.y = this.world.player.y
    }
    this.wasPlayerAlive = this.world.player.alive && this.world.state === 'playing'
    for (const point of this.playerTrail) point.life -= dt
    while (this.playerTrail.length > 30 || (this.playerTrail.length > 0 && this.playerTrail[0].life <= 0)) this.playerTrail.shift()
    this.messageTimer -= dt
    if (this.messageTimer <= 0) this.labelOf('message').visible = false
  }

  private render(): void {
    const renderer = this.renderer
    renderer.begin()
    this.renderGrid(renderer)
    this.renderEffects(renderer)
    this.renderEntities(renderer)
    this.renderControls(renderer)
    if (this.flashIntensity > 0.01) {
      const width = this.world.width
      const height = this.world.height
      renderer.setColor(COLORS.white, Math.floor(this.flashIntensity * 80))
      renderer.rectFill(-width * 0.5, -height * 0.5, width, height)
    }
    for (const label of this.labels) {
      if (label.dirty) this.platform.rasterizeLabel(label)
    }
    const jitterX = this.shakeIntensity > 0 ? (Math.random() - 0.5) * this.shakeIntensity : 0
    const jitterY = this.shakeIntensity > 0 ? (Math.random() - 0.5) * this.shakeIntensity : 0
    this.sink.drawFrame(renderer, this.labels, {
      camera: {
        halfWidth: this.world.width * 0.5,
        halfHeight: this.world.height * 0.5,
        offsetX: -jitterX,
        offsetY: -jitterY
      },
      background: BACKGROUND_RGB
    })
  }

  private renderGrid(renderer: VectorRenderer): void {
    const width = this.world.width
    const height = this.world.height
    this.prepareWarpedGrid(GRID_SPACING)
    if (this.qualityTier === 2) this.drawGridLines(renderer, GRID_LINES.glow)
    renderer.setWidth(STROKES.gridBoundaryGlow)
    renderer.setColor(COLORS.gridHot, 44)
    renderer.rectStroke(-width * 0.5 + LAYOUT.arenaInset, -height * 0.5 + LAYOUT.arenaInset, width - LAYOUT.arenaInset * 2, height - LAYOUT.arenaInset * 2)
    for (const star of this.stars) {
      const alpha = 32 + Math.floor((Math.sin(this.time * 1.8 + star.phase) * 0.5 + 0.5) * 70)
      renderer.setColor(COLORS.grid, alpha)
      renderer.disc(star.x * width, star.y * height, star.size, 8)
    }
    this.drawGridLines(renderer, GRID_LINES.main)
    renderer.setWidth(STROKES.gridBoundary)
    renderer.setColor(COLORS.white, 230)
    renderer.rectStroke(-width * 0.5 + LAYOUT.arenaInset, -height * 0.5 + LAYOUT.arenaInset, width - LAYOUT.arenaInset * 2, height - LAYOUT.arenaInset * 2)
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

    const dt = this.frameDt
    this.gridLattice.advance(layout, spacing, dt, (x, y, output) => this.warpTarget(x, y, output))
    for (const bullet of this.world.bullets) {
      if (bullet.life <= 0) continue
      const speed = length(bullet.vx, bullet.vy)
      if (speed < 1) continue
      this.gridLattice.kick(layout, spacing, bullet.x, bullet.y, GRID_WAKE_RADIUS, speed * GRID_WAKE_FORCE_SCALE * dt)
    }
  }

  private warpTarget(x: number, y: number, output: Vector): void {
    output.x = 0
    output.y = 0
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
    const player = this.world.player
    if (player.alive) {
      const dx = x - player.x
      const dy = y - player.y
      if (Math.abs(dx) < 180 && Math.abs(dy) < 180) {
        const distance = Math.max(1, length(dx, dy))
        if (distance < 180) {
          const speed = length(player.vx, player.vy)
          const force = (1 - distance / 180) * (7 + Math.min(1, speed / 320) * 9)
          output.x += dx / distance * force
          output.y += dy / distance * force
        }
      }
    }
  }

  private drawGridLines(renderer: VectorRenderer, style: GridLineStyle): void {
    const layout = this.gridLayout
    const points = this.gridLattice.points
    const minimumRow = layout.minimumRow
    renderer.setWidth(style.lineWidth)
    renderer.setColor(style.color, style.alpha)
    for (let column = layout.minimumColumn; column <= layout.maximumColumn; column += 1) {
      const base = (column - layout.minimumColumn) * layout.rowCount
      for (let row = 0; row < layout.rowCount - 1; row += 1) {
        const current = points[base + row]
        const next = points[base + row + 1]
        renderer.segment(current.x, current.y, next.x, next.y)
      }
    }
    for (let row = minimumRow; row <= layout.maximumRow; row += 1) {
      for (let column = layout.minimumColumn; column < layout.maximumColumn; column += 1) {
        const current = points[gridPointIndex(layout, column, row)]
        const next = points[gridPointIndex(layout, column + 1, row)]
        renderer.segment(current.x, current.y, next.x, next.y)
      }
    }
    const halfWidth = this.world.width * 0.5
    const halfHeight = this.world.height * 0.5
    renderer.setWidth(style.lineWidth * 0.8)
    renderer.setColor(style.color, Math.min(255, Math.floor(style.alpha * 1.35)))
    renderer.rectStroke(-halfWidth, -halfHeight, this.world.width, this.world.height)
  }

  private renderEffects(renderer: VectorRenderer): void {
    for (const point of this.playerTrail) {
      const alpha = clamp(point.life / 0.34, 0, 1)
      renderer.setColor(COLORS.cyan, Math.floor(alpha * 55))
      renderer.disc(point.x, point.y, 10 * alpha, 8)
    }
    const tailScale = 0.035
    if (this.qualityTier === 2) {
      for (const particle of this.particles) {
        const alpha = clamp(particle.life / particle.maxLife, 0, 1)
        renderer.setWidth(particle.size * STROKES.particleGlow)
        renderer.setColor(particle.color, Math.floor(alpha * 42))
        renderer.segment(particle.x, particle.y, particle.x - particle.vx * tailScale, particle.y - particle.vy * tailScale)
      }
    }
    if (this.qualityTier === 2) {
      for (const ripple of this.ripples) {
        const alpha = clamp(ripple.life / ripple.maxLife, 0, 1)
        renderer.setWidth(STROKES.rippleGlow * alpha)
        renderer.setColor(ripple.color, Math.floor(alpha * 70))
        renderer.ring(ripple.x, ripple.y, ripple.radius)
      }
    }
    if (this.qualityTier >= 1) for (const bullet of this.world.bullets) this.drawBullet(renderer, bullet, true)
    for (const particle of this.particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1)
      const speed = length(particle.vx, particle.vy)
      const brightness = Math.min(1, 0.35 + speed / 420)
      renderer.setWidth(Math.max(1, particle.size * alpha))
      renderer.setColor(particle.color, Math.floor(alpha * brightness * 235))
      renderer.segment(particle.x, particle.y, particle.x - particle.vx * tailScale, particle.y - particle.vy * tailScale)
    }
    for (const ripple of this.ripples) {
      const alpha = clamp(ripple.life / ripple.maxLife, 0, 1)
      renderer.setWidth(STROKES.rippleMain)
      renderer.setColor(ripple.color, Math.floor(alpha * 230))
      renderer.ring(ripple.x, ripple.y, ripple.radius)
    }
    for (const bullet of this.world.bullets) this.drawBullet(renderer, bullet, false)
  }

  private drawBullet(renderer: VectorRenderer, bullet: Bullet, glow: boolean): void {
    if (bullet.kind === 'missile') {
      this.drawMissile(renderer, bullet, glow)
      return
    }
    if (bullet.kind === 'overload') {
      const forwardX = Math.cos(bullet.angle)
      const forwardY = Math.sin(bullet.angle)
      const sideX = -forwardY
      const sideY = forwardX
      const tailX = bullet.x - forwardX * PROJECTILE_ART.overloadTail
      const tailY = bullet.y - forwardY * PROJECTILE_ART.overloadTail
      if (glow) {
        renderer.setWidth(PROJECTILE_ART.overloadGlowWidth)
        renderer.setColor(PROJECTILE_ART.overloadGlow, 62)
        renderer.segment(tailX, tailY, bullet.x, bullet.y)
        renderer.setColor(PROJECTILE_ART.overloadGlow, 52)
        renderer.disc(bullet.x, bullet.y, PROJECTILE_ART.overloadRingRadius)
        return
      }
      const railEndX = bullet.x - forwardX * PROJECTILE_ART.overloadCoreRadius
      const railEndY = bullet.y - forwardY * PROJECTILE_ART.overloadCoreRadius
      const railStartX = bullet.x - forwardX * PROJECTILE_ART.overloadRailLength
      const railStartY = bullet.y - forwardY * PROJECTILE_ART.overloadRailLength
      renderer.setWidth(PROJECTILE_ART.overloadRailWidth)
      renderer.setColor(PROJECTILE_ART.overloadAccent)
      renderer.segment(railStartX + sideX * PROJECTILE_ART.overloadRailOffset, railStartY + sideY * PROJECTILE_ART.overloadRailOffset, railEndX + sideX * PROJECTILE_ART.overloadRailOffset, railEndY + sideY * PROJECTILE_ART.overloadRailOffset)
      renderer.segment(railStartX - sideX * PROJECTILE_ART.overloadRailOffset, railStartY - sideY * PROJECTILE_ART.overloadRailOffset, railEndX - sideX * PROJECTILE_ART.overloadRailOffset, railEndY - sideY * PROJECTILE_ART.overloadRailOffset)
      renderer.setWidth(PROJECTILE_ART.coreWidth)
      renderer.setColor(PROJECTILE_ART.overloadGlow)
      renderer.ring(bullet.x, bullet.y, PROJECTILE_ART.overloadRingRadius, 12)
      renderer.setColor(PROJECTILE_ART.overloadCore)
      renderer.disc(bullet.x, bullet.y, PROJECTILE_ART.overloadCoreRadius, 10)
      return
    }
    const tail = PROJECTILE_ART.bulletTail
    const x2 = bullet.x - Math.cos(bullet.angle) * tail
    const y2 = bullet.y - Math.sin(bullet.angle) * tail
    renderer.setWidth(glow ? PROJECTILE_ART.glowWidth : PROJECTILE_ART.coreWidth)
    if (glow) renderer.setColor(PROJECTILE_ART.bulletGlow, 55)
    else renderer.setColor(PROJECTILE_ART.core)
    renderer.segment(bullet.x, bullet.y, x2, y2)
    if (!glow) {
      renderer.setColor(PROJECTILE_ART.core)
      renderer.disc(bullet.x, bullet.y, PROJECTILE_ART.coreWidth * 0.6, 6)
    }
  }

  // A homing missile drawn as a real missile: fading smoke contrail,
  // flickering exhaust flame, swept fins, and a slender hull with a rounded
  // nose — an unmistakable missile silhouette rather than an arrow.
  private drawMissile(renderer: VectorRenderer, bullet: Bullet, glow: boolean): void {
    const forwardX = Math.cos(bullet.angle)
    const forwardY = Math.sin(bullet.angle)
    const x = bullet.x
    const y = bullet.y
    const phase = (x * 0.37 + y * 0.73) % (Math.PI * 2)
    const flame = MISSILE_ART.flameLength + Math.sin(this.time * 46 + phase) * MISSILE_ART.flameFlicker
    if (glow) {
      renderer.setWidth(MISSILE_ART.glowStroke)
      renderer.setColor(MISSILE_ART.glow, 70)
      renderer.segment(x - forwardX * MISSILE_ART.flameBaseForward, y - forwardY * MISSILE_ART.flameBaseForward, x + forwardX * MISSILE_ART.noseForward, y + forwardY * MISSILE_ART.noseForward)
      renderer.setColor(MISSILE_ART.glow, 62)
      renderer.disc(x - forwardX * (MISSILE_ART.flameBaseForward + flame * 0.45), y - forwardY * (MISSILE_ART.flameBaseForward + flame * 0.45), 4.6, 10)
      return
    }
    const sideX = -forwardY
    const sideY = forwardX
    const sway = Math.sin(this.time * 31 + phase)
    renderer.setColor(MISSILE_ART.glow)
    const segments = MISSILE_ART.contrailSegments
    for (let index = 0; index < segments; index += 1) {
      const start = MISSILE_ART.contrailStart + MISSILE_ART.contrailSpan * index / segments
      const end = MISSILE_ART.contrailStart + MISSILE_ART.contrailSpan * (index + 1) / segments
      const swayStart = sway * MISSILE_ART.contrailSway * index / segments
      const swayEnd = sway * MISSILE_ART.contrailSway * (index + 1) / segments
      renderer.setWidth(MISSILE_ART.contrailWidth * (1 - index / segments))
      renderer.setAlpha(MISSILE_CONTRAIL_ALPHAS[index])
      renderer.segment(x - forwardX * start + sideX * swayStart, y - forwardY * start + sideY * swayStart, x - forwardX * end + sideX * swayEnd, y - forwardY * end + sideY * swayEnd)
    }
    renderer.setAlpha(1)

    const flameScratch = this.pathScratch
    flameScratch.length = 0
    flameScratch.push(
      MISSILE_ART.flameBaseForward, MISSILE_ART.flameBaseSide,
      MISSILE_ART.flameBaseForward - flame, 0,
      MISSILE_ART.flameBaseForward, -MISSILE_ART.flameBaseSide
    )
    renderer.setColor(MISSILE_ART.flame, 205)
    renderer.polygon(flameScratch, x, y, 1, bullet.angle, true, false)
    flameScratch.length = 0
    flameScratch.push(
      MISSILE_ART.flameBaseForward, MISSILE_ART.flameCoreSide,
      MISSILE_ART.flameBaseForward - flame * MISSILE_ART.flameCoreLength / MISSILE_ART.flameLength, 0,
      MISSILE_ART.flameBaseForward, -MISSILE_ART.flameCoreSide
    )
    renderer.setColor(MISSILE_ART.flameCore, 235)
    renderer.polygon(flameScratch, x, y, 1, bullet.angle, true, false)

    renderer.setColor(MISSILE_ART.glow, 235)
    renderer.setWidth(2.4)
    renderer.segment(
      x + forwardX * MISSILE_ART.nozzleForward + sideX * MISSILE_ART.nozzleSide,
      y + forwardY * MISSILE_ART.nozzleForward + sideY * MISSILE_ART.nozzleSide,
      x + forwardX * MISSILE_ART.nozzleForward - sideX * MISSILE_ART.nozzleSide,
      y + forwardY * MISSILE_ART.nozzleForward - sideY * MISSILE_ART.nozzleSide
    )

    renderer.setColor(MISSILE_ART.hull, 60)
    renderer.polygon(MISSILE_HULL_FLAT, x, y, 1, bullet.angle, true, false)
    renderer.setColor(MISSILE_ART.hull)
    renderer.setWidth(MISSILE_ART.hullStroke)
    renderer.polygon(MISSILE_HULL_FLAT, x, y, 1, bullet.angle, false, true)
    renderer.setColor(MISSILE_ART.hull, 150)
    renderer.polygon(MISSILE_FIN_PORT, x, y, 1, bullet.angle, true, true)
    renderer.polygon(MISSILE_FIN_STARBOARD, x, y, 1, bullet.angle, true, true)
    renderer.setColor(MISSILE_ART.flameCore)
    renderer.disc(x + forwardX * (MISSILE_ART.noseForward - 1.6), y + forwardY * (MISSILE_ART.noseForward - 1.6), 1.15, 6)
  }

  private renderEntities(renderer: VectorRenderer): void {
    if (this.qualityTier >= 1) {
      for (const enemy of this.world.enemies) {
        if (enemy.dead) continue
        const spawnAlpha = enemy.spawnTimer > 0 ? 1 - enemy.spawnTimer / 0.45 : 1
        this.drawEnemy(renderer, enemy, true, spawnAlpha)
      }
      for (const geom of this.world.geoms) if (!geom.dead) this.drawGeom(renderer, geom, true)
    }
    for (const supply of this.world.supplies) if (!supply.dead) this.drawSupply(renderer, supply, true)
    for (const ally of this.world.allies) if (ally.life > 0) this.drawAlly(renderer, ally, true)
    if (this.world.player.alive) {
      const flicker = this.world.player.invulnerable > 0 && Math.floor(this.time * 14) % 2 === 0
      if (!flicker) this.drawPlayer(renderer, true)
    }
    for (const enemy of this.world.enemies) {
      if (enemy.dead) continue
      const spawnAlpha = enemy.spawnTimer > 0 ? 1 - enemy.spawnTimer / 0.45 : 1
      this.drawEnemy(renderer, enemy, false, spawnAlpha)
    }
    for (const geom of this.world.geoms) if (!geom.dead) this.drawGeom(renderer, geom, false)
    for (const supply of this.world.supplies) if (!supply.dead) this.drawSupply(renderer, supply, false)
    for (const ally of this.world.allies) if (ally.life > 0) this.drawAlly(renderer, ally, false)
    if (this.world.player.alive) {
      const flicker = this.world.player.invulnerable > 0 && Math.floor(this.time * 14) % 2 === 0
      if (!flicker) this.drawPlayer(renderer, false)
    }
  }

  private drawGeom(renderer: VectorRenderer, geom: Geom, glow: boolean): void {
    const blink = geom.life < 2 ? 0.35 + Math.abs(Math.sin(geom.phase * 2.2)) * 0.65 : 1
    const hex = glow ? GEOM_ART.glow : GEOM_ART.core
    const alpha = Math.floor(blink * (glow ? GEOM_ART.glowAlpha : 240))
    renderer.setWidth(glow ? GEOM_ART.glowWidth : GEOM_ART.coreWidth)
    this.polygonPath(renderer, geom.x, geom.y, GEOM_ART.radius, 4, geom.phase * 0.6, true, hex, alpha)
  }

  private drawPlayer(renderer: VectorRenderer, glow: boolean): void {
    const player = this.world.player
    renderer.setColor(glow ? FIGHTER_GLOW_COLOR : FIGHTER_HULL_COLOR, glow ? FIGHTER_GLOW_ALPHA : 255)
    this.drawPlayerPath(renderer, FIGHTER_OUTER_FLAT, glow ? FIGHTER_OUTER_GLOW_STROKE : FIGHTER_OUTER_STROKE, player)
    this.drawPlayerPath(renderer, FIGHTER_INNER_FLAT, glow ? FIGHTER_INNER_GLOW_STROKE : FIGHTER_INNER_STROKE, player)
    if (!glow) {
      renderer.setColor(FIGHTER_THRUSTER_COLOR)
      this.drawPlayerPath(renderer, FIGHTER_THRUSTER_FLAT, FIGHTER_INNER_STROKE, player)
    }
  }

  private drawPlayerPath(renderer: VectorRenderer, flat: readonly number[], stroke: number, player: { x: number; y: number; angle: number }): void {
    renderer.setWidth(stroke * COMBAT_ART_SCALE)
    renderer.polyline(this.rotateFlat(flat, player.x, player.y, player.angle, COMBAT_ART_SCALE), true)
  }

  private rotateFlat(flat: readonly number[], x: number, y: number, angle: number, scale: number): number[] {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const output = this.pathScratch
    output.length = flat.length
    for (let index = 0; index < flat.length; index += 2) {
      const px = flat[index] * scale
      const py = flat[index + 1] * scale
      output[index] = x + px * cos - py * sin
      output[index + 1] = y + px * sin + py * cos
    }
    return output
  }

  private drawAlly(renderer: VectorRenderer, ally: Ally, glow: boolean): void {
    const forwardX = Math.cos(ally.angle)
    const forwardY = Math.sin(ally.angle)
    const sideX = -forwardY
    const sideY = forwardX
    renderer.setWidth(glow ? ALLY_ART.glowWidth : ALLY_ART.coreWidth)
    renderer.setColor(glow ? ALLY_ART.glow : ALLY_ART.core, glow ? ALLY_ART.glowAlpha : 255)
    renderer.ring(ally.x, ally.y, ALLY_ART.coreRadius, 12)
    const noseX = ally.x + forwardX * ALLY_ART.nose
    const noseY = ally.y + forwardY * ALLY_ART.nose
    renderer.segment(noseX, noseY, ally.x + forwardX * ALLY_ART.wingForward + sideX * ALLY_ART.wingSide, ally.y + forwardY * ALLY_ART.wingForward + sideY * ALLY_ART.wingSide)
    renderer.segment(ally.x + forwardX * ALLY_ART.wingForward + sideX * ALLY_ART.wingSide, ally.y + forwardY * ALLY_ART.wingForward + sideY * ALLY_ART.wingSide, ally.x + forwardX * ALLY_ART.tailForward + sideX * ALLY_ART.tailSide, ally.y + forwardY * ALLY_ART.tailForward + sideY * ALLY_ART.tailSide)
    renderer.segment(ally.x + forwardX * ALLY_ART.wingForward - sideX * ALLY_ART.wingSide, ally.y + forwardY * ALLY_ART.wingForward - sideY * ALLY_ART.wingSide, noseX, noseY)
    renderer.segment(noseX, noseY, ally.x + forwardX * ALLY_ART.tailForward - sideX * ALLY_ART.tailSide, ally.y + forwardY * ALLY_ART.tailForward - sideY * ALLY_ART.tailSide)
  }

  private drawSupply(renderer: VectorRenderer, supply: Supply, glow: boolean): void {
    const alpha = supply.spawnTimer > 0 ? 1 - supply.spawnTimer / 0.6 : 1
    const rotation = this.time * (glow ? 0.65 : -0.85)
    const radius = SUPER_WEAPON_ART.radius
    renderer.setWidth(glow ? SUPER_WEAPON_ART.glowWidth : SUPER_WEAPON_ART.coreWidth)
    renderer.setColor(glow ? SUPER_WEAPON_ART.glow : SUPER_WEAPON_ART.core, Math.floor(alpha * (glow ? SUPER_WEAPON_ART.glowAlpha : 255)))
    renderer.ring(supply.x, supply.y, radius + SUPER_WEAPON_ART.shellPadding)
    for (let orbit = 0; orbit < 2; orbit += 1) {
      const orbitRadius = radius - SUPER_WEAPON_ART.orbitInset - orbit * SUPER_WEAPON_ART.orbitGap
      const orbitStart = rotation * (orbit === 0 ? -1.8 : 2.1) + orbit * Math.PI * 0.5
      renderer.arc(supply.x, supply.y, orbitRadius, orbitStart, orbitStart + Math.PI * 1.25)
    }
    for (let ray = 0; ray < 4; ray += 1) {
      const rayAngle = ray * Math.PI * 0.5 - rotation * 0.4
      renderer.segment(
        supply.x + Math.cos(rayAngle) * (radius + SUPER_WEAPON_ART.rayStart),
        supply.y + Math.sin(rayAngle) * (radius + SUPER_WEAPON_ART.rayStart),
        supply.x + Math.cos(rayAngle) * (radius + SUPER_WEAPON_ART.rayEnd),
        supply.y + Math.sin(rayAngle) * (radius + SUPER_WEAPON_ART.rayEnd)
      )
    }
    renderer.setColor(SUPER_WEAPON_ART.icon, Math.floor(alpha * (glow ? SUPER_WEAPON_ART.iconGlowAlpha : 255)))
    if (supply.effect === 'detonation') {
      for (let spoke = 0; spoke < SUPER_WEAPON_ART.detonationSpokes; spoke += 1) {
        const spokeAngle = rotation + spoke / SUPER_WEAPON_ART.detonationSpokes * Math.PI * 2
        renderer.segment(
          supply.x + Math.cos(spokeAngle) * SUPER_WEAPON_ART.detonationInner,
          supply.y + Math.sin(spokeAngle) * SUPER_WEAPON_ART.detonationInner,
          supply.x + Math.cos(spokeAngle) * SUPER_WEAPON_ART.detonationOuter,
          supply.y + Math.sin(spokeAngle) * SUPER_WEAPON_ART.detonationOuter
        )
      }
    } else if (supply.effect === 'overload') {
      renderer.polyline(this.rotateFlat(OVERLOAD_ICON_FLAT, supply.x, supply.y, 0, 1))
    } else {
      this.polygonPath(renderer, supply.x, supply.y, SUPER_WEAPON_ART.alliesRadius, 3, rotation, false, SUPER_WEAPON_ART.icon, Math.floor(alpha * (glow ? SUPER_WEAPON_ART.iconGlowAlpha : 255)))
      renderer.setColor(SUPER_WEAPON_ART.icon, Math.floor(alpha * 255))
      renderer.disc(supply.x, supply.y, SUPER_WEAPON_ART.iconRadius, 8)
    }
    if (glow) return
    for (let index = 0; index < supply.maxHealth; index += 1) {
      const angle = index / supply.maxHealth * Math.PI * 2 - Math.PI * 0.5
      renderer.setColor(SUPER_WEAPON_ART.icon, index < supply.health ? 255 : 50)
      renderer.disc(supply.x + Math.cos(angle) * (radius + SUPER_WEAPON_ART.durabilityOrbit), supply.y + Math.sin(angle) * (radius + SUPER_WEAPON_ART.durabilityOrbit), SUPER_WEAPON_ART.durabilityRadius, 6)
    }
  }

  private drawEnemy(renderer: VectorRenderer, enemy: Enemy, glow: boolean, alpha: number): void {
    const colorHex = this.world.enemyColor(enemy.kind)
    const radius = ENEMY_ART_RADIUS[enemy.kind] * COMBAT_ART_SCALE * (enemy.kind === 'blackhole' ? enemy.mass : 1)
    const alphaValue = Math.floor(alpha * (glow ? 70 : 245))
    renderer.setWidth((glow ? STROKES.enemyGlow : STROKES.enemyMain) * COMBAT_ART_SCALE)
    if (enemy.kind === 'wanderer') {
      renderer.setColor(colorHex, alphaValue)
      for (let arm = 0; arm < 4; arm += 1) {
        const angle = enemy.angle + arm * Math.PI * 0.5
        const sideAngle = angle - Math.PI * 0.5
        const path = this.pathScratch
        path.length = 0
        path.push(
          enemy.x + Math.cos(angle) * 2, enemy.y + Math.sin(angle) * 2,
          enemy.x + Math.cos(angle) * radius * 0.42 + Math.cos(sideAngle) * radius * 0.32,
          enemy.y + Math.sin(angle) * radius * 0.42 + Math.sin(sideAngle) * radius * 0.32,
          enemy.x + Math.cos(angle) * radius + Math.cos(sideAngle) * radius * 0.08,
          enemy.y + Math.sin(angle) * radius + Math.sin(sideAngle) * radius * 0.08,
          enemy.x + Math.cos(angle) * radius * 0.58 - Math.cos(sideAngle) * radius * 0.2,
          enemy.y + Math.sin(angle) * radius * 0.58 - Math.sin(sideAngle) * radius * 0.2
        )
        renderer.polyline(path)
      }
    } else if (enemy.kind === 'grunt') {
      this.polygonPath(renderer, enemy.x, enemy.y, radius, 4, enemy.angle + Math.PI * 0.25, true, colorHex, alphaValue)
      if (!glow) {
        const forwardX = Math.cos(enemy.angle)
        const forwardY = Math.sin(enemy.angle)
        const sideX = -forwardY
        const sideY = forwardX
        renderer.setColor(colorHex, alphaValue)
        renderer.segment(enemy.x - forwardX * radius * 0.7, enemy.y - forwardY * radius * 0.7, enemy.x + forwardX * radius * 0.7, enemy.y + forwardY * radius * 0.7)
        renderer.segment(enemy.x - sideX * radius * 0.7, enemy.y - sideY * radius * 0.7, enemy.x + sideX * radius * 0.7, enemy.y + sideY * radius * 0.7)
      }
    } else if (enemy.kind === 'weaver') {
      this.polygonPath(renderer, enemy.x, enemy.y, radius, 4, enemy.angle, true, colorHex, alphaValue)
      if (!glow) this.polygonPath(renderer, enemy.x, enemy.y, radius * 0.72, 4, enemy.angle + Math.PI * 0.25, false, colorHex, alphaValue)
    } else if (enemy.kind === 'spinner') {
      this.polygonPath(renderer, enemy.x, enemy.y, radius, 4, enemy.angle, true, colorHex, alphaValue)
      if (!glow) {
        const diagonalX = Math.cos(enemy.angle + Math.PI * 0.25)
        const diagonalY = Math.sin(enemy.angle + Math.PI * 0.25)
        const crossX = -diagonalY
        const crossY = diagonalX
        renderer.setColor(colorHex, alphaValue)
        renderer.segment(enemy.x - diagonalX * radius, enemy.y - diagonalY * radius, enemy.x + diagonalX * radius, enemy.y + diagonalY * radius)
        renderer.segment(enemy.x - crossX * radius, enemy.y - crossY * radius, enemy.x + crossX * radius, enemy.y + crossY * radius)
      }
    } else if (enemy.kind === 'snake') {
      this.polygonPath(renderer, enemy.x, enemy.y, radius, 3, enemy.angle, true, COLORS.cyan, alphaValue)
      for (let index = enemy.segments.length - 1; index >= 0; index -= 1) {
        const segment = enemy.segments[index]
        const segmentRadius = 7 + (enemy.segments.length - index) * 0.35
        this.polygonPath(renderer, segment.x, segment.y, segmentRadius, 4, segment.angle + Math.PI * 0.25, index % 2 === 0, colorHex, alphaValue)
      }
    } else if (enemy.kind === 'repulsar') {
      this.polygonLocal(renderer, REPULSAR_SHELL_FLAT, enemy.x, enemy.y, enemy.angle, colorHex, alphaValue, radius)
      renderer.setColor(COLORS.cyan, alphaValue)
      renderer.polyline(this.rotateFlat(REPULSAR_TAIL_FLAT, enemy.x, enemy.y, enemy.angle, radius), true)
    } else {
      const pulse = Math.sin(this.time * 4 + enemy.phase) * 3
      renderer.setColor(colorHex, alphaValue)
      renderer.ring(enemy.x, enemy.y, radius + pulse)
      if (!glow) {
        renderer.setColor(COLORS.background, 235)
        renderer.disc(enemy.x, enemy.y, radius * 0.63)
        renderer.setColor(COLORS.orange, 230)
        renderer.ring(enemy.x, enemy.y, radius * 1.22 + pulse)
        renderer.setColor(COLORS.violet, 220)
        renderer.arc(enemy.x, enemy.y, radius * 0.48, -this.time * 1.7, -this.time * 1.7 + Math.PI * 1.35)
      }
    }
  }

  private polygonPath(renderer: VectorRenderer, x: number, y: number, radius: number, sides: number, rotation: number, fill: boolean, hex: string, alpha: number): void {
    const path = this.pathScratch
    path.length = sides * 2
    for (let index = 0; index < sides; index += 1) {
      const angle = rotation + index / sides * Math.PI * 2
      path[index * 2] = Math.cos(angle)
      path[index * 2 + 1] = Math.sin(angle)
    }
    this.polygonLocal(renderer, path, x, y, 0, hex, alpha, radius, fill)
  }

  private polygonLocal(renderer: VectorRenderer, flat: readonly number[], x: number, y: number, rotation: number, hex: string, alpha: number, scale = 1, fill = true): void {
    if (fill) {
      renderer.setColor(hex, Math.floor(alpha * 0.16))
      renderer.polygon(flat, x, y, scale, rotation, true, false)
    }
    renderer.setColor(hex, alpha)
    renderer.polygon(flat, x, y, scale, rotation, false, true)
  }

  private renderControls(renderer: VectorRenderer): void {
    if (this.world.state !== 'playing') return
    const scale = this.touchControls.unitsPerPixel
    const defaultY = -this.world.height * 0.5 + TOUCH.defaultBottom * scale
    const defaultX = this.world.width * 0.5 - TOUCH.defaultSide * scale
    const heading = this.touchControls.singleHanded && this.world.hasFireHeading ? this.world.fireHeading : null
    this.drawStick(renderer, this.leftStick, this.touchControls.singleHanded ? 0 : -defaultX, defaultY, COLORS.cyan, heading, scale)
    if (!this.touchControls.singleHanded) this.drawStick(renderer, this.rightStick, defaultX, defaultY, COLORS.magenta, null, scale)
  }

  private drawStick(renderer: VectorRenderer, stick: StickState, defaultX: number, defaultY: number, hex: string, heading: number | null, scale: number): void {
    const baseX = stick.active ? stick.base.x : defaultX
    const baseY = stick.active ? stick.base.y : defaultY
    const knobX = stick.active ? stick.knob.x : baseX
    const knobY = stick.active ? stick.knob.y : baseY
    if (stick.active && heading !== null) {
      const sectorRadius = TOUCH.sectorRadius * scale
      renderer.setWidth(STROKES.control * scale)
      renderer.setColor(hex, 88)
      renderer.segment(baseX, baseY, baseX + Math.cos(heading - AIM_ASSIST_HALF_ANGLE) * sectorRadius, baseY + Math.sin(heading - AIM_ASSIST_HALF_ANGLE) * sectorRadius)
      renderer.segment(baseX, baseY, baseX + Math.cos(heading + AIM_ASSIST_HALF_ANGLE) * sectorRadius, baseY + Math.sin(heading + AIM_ASSIST_HALF_ANGLE) * sectorRadius)
      renderer.arc(baseX, baseY, sectorRadius, heading - AIM_ASSIST_HALF_ANGLE, heading + AIM_ASSIST_HALF_ANGLE)
      renderer.setColor(hex, 142)
      renderer.segment(baseX, baseY, baseX + Math.cos(heading) * TOUCH.headingRay * scale, baseY + Math.sin(heading) * TOUCH.headingRay * scale)
    }
    renderer.setWidth(STROKES.controlRing * scale)
    renderer.setColor(hex, stick.active ? 155 : 58)
    renderer.ring(baseX, baseY, TOUCH.ringRadius * scale)
    renderer.setColor(hex, stick.active ? 28 : 12)
    renderer.disc(baseX, baseY, TOUCH.ringRadius * scale, 20)
    renderer.setColor(hex, stick.active ? 82 : 25)
    renderer.disc(knobX, knobY, TOUCH.knobRadius * scale, 14)
    renderer.setColor(hex, stick.active ? 155 : 58)
    renderer.ring(knobX, knobY, TOUCH.knobRadius * scale, 14)
  }

  private updateInterface(dt: number): void {
    this.hudClock -= dt
    const state = `${this.world.state}:${this.touchControls.singleHanded ? 1 : 0}:${this.world.width}x${this.world.height}`
    if (this.hudClock > 0 && state === this.hudState) return
    this.hudClock = HUD_REFRESH_INTERVAL
    this.hudState = state

    const hud = hudLayout({
      viewport: { width: this.world.width, height: this.world.height },
      safeArea: {
        x: this.safeLeft,
        y: this.safeAreaBottomWorld,
        width: this.world.width - this.safeLeft - this.safeRight,
        height: this.safeAreaHeightWorld
      },
      labelHeight: LAYOUT.scoreHeight,
      obstructionTop: this.menuBottomWorld
    })
    const score = this.labelOf('score')
    score.x = hud.leftX + score.config.width * 0.5
    score.y = hud.y
    score.setText(`SCORE  ${scoreText(this.world.score)}\nHIGH   ${scoreText(this.world.highScore)}`)
    const status = this.labelOf('status')
    status.x = hud.rightX - status.config.width * 0.5
    status.y = hud.y
    const specialStatus: string[] = []
    if (this.world.missileTimer > 0) specialStatus.push(`MISSILE ${this.world.missileTimer.toFixed(1)}`)
    if (this.world.overloadTimer > 0) specialStatus.push(`OVERDRIVE ${this.world.overloadTimer.toFixed(1)}`)
    if (this.world.allies.length > 0) specialStatus.push(`ALLY ×${this.world.allies.length}`)
    const specialLine = specialStatus.length > 0 ? `\n${specialStatus.join('  ')}` : ''
    const supplyLine = this.world.supplies.some((supply) => !supply.dead) ? 'SUPER ACTIVE' : `SUPER ${Math.max(0, Math.ceil(this.world.supplyClock))}s`
    status.setText(`×${this.world.multiplier}   ◇ ${this.world.lives}   W${weaponTier(this.world.score)}${specialLine}\n${supplyLine}`)
    this.labelOf('title').y = LAYOUT.titleY
    this.labelOf('subtitle').y = LAYOUT.subtitleY
    this.labelOf('prompt').y = LAYOUT.promptY
    this.labelOf('message').y = LAYOUT.messageY
    const showTitle = this.world.state === 'title'
    const showGameOver = this.world.state === 'gameover'
    this.labelOf('title').visible = showTitle || showGameOver
    this.labelOf('subtitle').visible = showTitle || showGameOver
    this.labelOf('prompt').visible = showTitle || showGameOver || this.world.state === 'paused'
    if (showTitle) {
      const title = this.labelOf('title')
      title.setText('几何空战')
      title.setColor(COLORS.white)
      this.labelOf('subtitle').setText('竖屏单手 · 拖动方向自动射击 · 保持倍率')
      this.labelOf('prompt').setText('下半屏单指拖动  /  ONE THUMB TO ENGAGE')
    } else if (showGameOver) {
      const title = this.labelOf('title')
      title.setText('网格崩塌')
      title.setColor(COLORS.red)
      this.labelOf('subtitle').setText(`FINAL SCORE  ${scoreText(this.world.score)}`)
      this.labelOf('prompt').setText('触摸重新接入网格  /  TOUCH TO RESTART')
    } else if (this.world.state === 'paused') {
      this.labelOf('prompt').setText('PAUSED  /  触摸 P 继续')
    }
  }

  private persistHighScore(dt: number): void {
    this.highScoreClock -= dt
    if (this.world.highScore <= this.storedHighScore) return
    this.storedHighScore = this.world.highScore
    if (this.highScoreClock > 0) return
    this.platform.storageSet(HIGH_SCORE_KEY, String(this.storedHighScore))
    this.highScoreClock = HIGH_SCORE_WRITE_INTERVAL
  }
}
