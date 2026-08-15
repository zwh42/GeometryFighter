import { COLORS, ENEMY_ART_COLOR, SUPER_EVENT_ART, SUPER_WEAPON_ART } from './design-tokens.ts'
import { SpatialIndex } from './spatial-index.ts'

export type EnemyKind = 'wanderer' | 'grunt' | 'weaver' | 'spinner' | 'snake' | 'repulsar' | 'blackhole'
export type GameState = 'title' | 'playing' | 'paused' | 'gameover'
export type SuperWeaponKind = 'detonation' | 'overload' | 'allies'

export interface Vector {
  x: number
  y: number
}

export interface Player extends Vector {
  vx: number
  vy: number
  angle: number
  radius: number
  alive: boolean
  invulnerable: number
  respawnTimer: number
}

export interface Bullet extends Vector {
  vx: number
  vy: number
  angle: number
  life: number
  radius: number
  kind: 'bullet' | 'missile'
  source: 'player' | 'ally'
  target: Enemy | null
}

export interface SnakeSegment extends Vector {
  angle: number
}

export interface Enemy extends Vector {
  kind: EnemyKind
  vx: number
  vy: number
  angle: number
  radius: number
  speed: number
  health: number
  value: number
  age: number
  phase: number
  spawnTimer: number
  dead: boolean
  mass: number
  segments: SnakeSegment[]
  missileChargeUsed: boolean
  selfDestruct: number
}

export interface Supply extends Vector {
  radius: number
  health: number
  maxHealth: number
  effect: SuperWeaponKind
  spawnTimer: number
  age: number
  life: number
  dead: boolean
}

export interface Ally extends Vector {
  angle: number
  phase: number
  life: number
  fireTimer: number
  target: Enemy | null
}

export type WorldEventKind = 'shoot' | 'kill' | 'bomb' | 'death' | 'reward' | 'wave' | 'blackhole' | 'supply' | 'super'

export interface WorldEvent {
  kind: WorldEventKind
  x: number
  y: number
  color: string
  amount: number
  text: string
}

export interface ControlState {
  move: Vector
  aim: Vector
  engaged: boolean
  bomb: boolean
  start: boolean
  pause: boolean
}

const ENEMY_VALUE: Record<EnemyKind, number> = {
  wanderer: 25,
  grunt: 100,
  weaver: 150,
  spinner: 200,
  snake: 350,
  repulsar: 500,
  blackhole: 1000
}

const PLAYER_LOGICAL_RADIUS = 10
const ENEMY_LOGICAL_RADIUS: Record<EnemyKind, number> = {
  wanderer: 11,
  grunt: 12,
  weaver: 12,
  spinner: 13,
  snake: 10,
  repulsar: 15,
  blackhole: 18
}

const BOMB_KILL_EVENT_LIMIT = 6
const MAX_LIVE_ENEMIES = 100
export const MAX_BULLETS = 180
const MISSILE_DURATION = 5
const MISSILE_SPEED = 650
const MISSILE_TURN_RATE = 5.4
const SUPPLY_HITS = 8
const SUPPLY_LIFE = 18
const OVERLOAD_DURATION = 8
const ALLY_DURATION = 12
const ENEMY_INDEX_CELL_SIZE = 96
const COLLISION_QUERY_RADIUS = 64
const AIM_ASSIST_RANGE_SQUARED = 900 * 900
export const AIM_INPUT_THRESHOLD = 0.18
export const AIM_HEADING_RESPONSE = 14
export const AIM_ASSIST_HALF_ANGLE = Math.PI * 26 / 180
const AIM_ASSIST_CONE_TANGENT = Math.tan(AIM_ASSIST_HALF_ANGLE)
const BULLET_HIT_FORGIVENESS = 4

export function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value))
}

export function length(x: number, y: number): number {
  return Math.sqrt(x * x + y * y)
}

function angleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

export function normalized(x: number, y: number): Vector {
  return normalizeInto(x, y, { x: 0, y: 0 })
}

export function normalizeInto(x: number, y: number, output: Vector): Vector {
  const size = length(x, y)
  output.x = size < 0.0001 ? 0 : x / size
  output.y = size < 0.0001 ? 0 : y / size
  return output
}

export function weaponTier(score: number): number {
  if (score >= 60000) return 4
  if (score >= 30000) return 3
  if (score >= 10000) return 2
  return 1
}

// allow: SIZE_OK — deterministic world state stays contiguous so frame-step ordering remains auditable.
export class GeometryWorld {
  width = 720
  height = 1280
  state: GameState = 'title'
  elapsed = 0
  score = 0
  highScore = 0
  lives = 3
  bombs = 3
  multiplier = 1
  kills = 0
  wave = 1
  nextLife = 75000
  nextSupply = 100000
  spawnClock = 0
  supplyClock = 12
  fireClock = 0
  fireHeading = 0
  hasFireHeading = false
  missileTimer = 0
  overloadTimer = 0
  seed = 0x7219af13
  private unitsPerPixel = 1
  player: Player = this.makePlayer()
  bullets: Bullet[] = []
  enemies: Enemy[] = []
  supplies: Supply[] = []
  allies: Ally[] = []
  events: WorldEvent[] = []
  private readonly enemyIndex = new SpatialIndex<Enemy>()
  private readonly activeEnemies: Enemy[] = []
  private readonly activeRepulsars: Enemy[] = []
  private readonly collisionCandidates: Enemy[] = []
  private readonly directionalTargets: Array<Enemy | Supply> = []
  private readonly normalizationScratch: Vector = { x: 0, y: 0 }
  private enemyIndexDirty = true

  resize(width: number, height: number, unitsPerPixel = 1): void {
    const nextUnitsPerPixel = Math.max(0.01, unitsPerPixel)
    const radiusScale = nextUnitsPerPixel / this.unitsPerPixel
    this.unitsPerPixel = nextUnitsPerPixel
    this.player.radius *= radiusScale
    for (const bullet of this.bullets) bullet.radius *= radiusScale
    for (const enemy of this.enemies) enemy.radius *= radiusScale
    for (const supply of this.supplies) supply.radius *= radiusScale
    this.width = Math.max(640, width)
    this.height = Math.max(360, height)
    this.player.x = clamp(this.player.x, -this.width * 0.48, this.width * 0.48)
    this.player.y = clamp(this.player.y, -this.height * 0.48, this.height * 0.48)
    this.enemyIndexDirty = true
  }

  makePlayer(): Player {
    return {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      radius: PLAYER_LOGICAL_RADIUS * this.unitsPerPixel,
      alive: true,
      invulnerable: 1.8,
      respawnTimer: 0
    }
  }

  random(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0
    return this.seed / 0x100000000
  }

  reset(): void {
    this.state = 'playing'
    this.elapsed = 0
    this.score = 0
    this.lives = 3
    this.bombs = 3
    this.multiplier = 1
    this.kills = 0
    this.wave = 1
    this.nextLife = 75000
    this.nextSupply = 100000
    this.spawnClock = 0.7
    this.supplyClock = 12 + this.random() * 6
    this.fireClock = 0
    this.fireHeading = 0
    this.hasFireHeading = false
    this.missileTimer = 0
    this.overloadTimer = 0
    this.player = this.makePlayer()
    this.bullets.length = 0
    this.enemies.length = 0
    this.supplies.length = 0
    this.allies.length = 0
    this.events.length = 0
    this.enemyIndexDirty = true
    this.pushEvent('wave', 0, 0, COLORS.gridHot, 1, 'GRID LEVEL 1')
  }

  update(dt: number, controls: ControlState): void {
    if (controls.start && (this.state === 'title' || this.state === 'gameover')) this.reset()
    if (controls.pause && (this.state === 'playing' || this.state === 'paused')) {
      this.state = this.state === 'playing' ? 'paused' : 'playing'
    }
    if (this.state !== 'playing') return

    const step = Math.min(dt, 0.034)
    this.elapsed += step
    this.missileTimer = Math.max(0, this.missileTimer - step)
    this.overloadTimer = Math.max(0, this.overloadTimer - step)
    this.updatePlayer(step, controls)
    this.updateSupplies(step)
    this.updateEnemies(step)
    this.updateBullets(step)
    this.updateAllies(step)
    this.resolveCollisions()
    this.spawnClock -= step
    if (this.spawnClock <= 0) this.spawnWave()
    this.supplyClock -= step
    if (this.supplyClock <= 0 && !this.supplies.some((supply) => !supply.dead)) {
      this.spawnSupply()
      this.supplyClock = 18 + this.random() * 10
    }
    if (controls.bomb) this.useBomb()
    this.cleanup()
  }

  updatePlayer(dt: number, controls: ControlState): void {
    const player = this.player
    player.invulnerable = Math.max(0, player.invulnerable - dt)
    if (!player.alive) {
      player.respawnTimer -= dt
      if (player.respawnTimer <= 0) {
        if (this.lives <= 0) {
          this.state = 'gameover'
          this.highScore = Math.max(this.highScore, this.score)
        } else {
          player.alive = true
          player.invulnerable = 2.2
          player.x = 0
          player.y = 0
          player.vx = 0
          player.vy = 0
        }
      }
      return
    }

    const acceleration = 1420
    player.vx += controls.move.x * acceleration * dt
    player.vy += controls.move.y * acceleration * dt
    const drag = Math.pow(0.0008, dt)
    player.vx *= drag
    player.vy *= drag
    const velocity = length(player.vx, player.vy)
    if (velocity > 320) {
      player.vx = player.vx / velocity * 320
      player.vy = player.vy / velocity * 320
    }

    player.x += player.vx * dt
    player.y += player.vy * dt
    const inset = 28
    player.x = clamp(player.x, -this.width * 0.5 + inset, this.width * 0.5 - inset)
    player.y = clamp(player.y, -this.height * 0.5 + inset, this.height * 0.5 - inset)

    const portrait = this.height >= this.width
    const moveStrength = length(controls.move.x, controls.move.y)
    if (portrait) {
      if (moveStrength > AIM_INPUT_THRESHOLD) {
        const desiredHeading = Math.atan2(controls.move.y, controls.move.x)
        if (this.hasFireHeading) {
          this.fireHeading += angleDelta(this.fireHeading, desiredHeading) * clamp(dt * AIM_HEADING_RESPONSE, 0, 1)
        } else {
          this.fireHeading = desiredHeading
          this.hasFireHeading = true
        }
      }
      if (this.hasFireHeading && (controls.engaged || moveStrength > AIM_INPUT_THRESHOLD)) {
        player.angle += angleDelta(player.angle, this.fireHeading) * clamp(dt * AIM_HEADING_RESPONSE, 0, 1)
        this.fireClock -= dt
        if (this.fireClock <= 0) this.fire(this.fireHeading)
      } else {
        this.fireClock = Math.min(this.fireClock, 0.04)
      }
      if (!controls.engaged && moveStrength <= AIM_INPUT_THRESHOLD) this.hasFireHeading = false
    } else if (length(controls.aim.x, controls.aim.y) > 0.22) {
      player.angle = Math.atan2(controls.aim.y, controls.aim.x)
      this.fireClock -= dt
      if (this.fireClock <= 0) this.fire(player.angle)
    } else {
      this.fireClock = Math.min(this.fireClock, 0.04)
    }
  }

  fire(angle: number): void {
    const tier = weaponTier(this.score)
    const patterns = this.overloadTimer > 0
      ? [-0.28, -0.21, -0.14, -0.07, 0, 0.07, 0.14, 0.21, 0.28]
      : tier === 1 ? [0] : tier === 2 ? [-0.055, 0.055] : tier === 3 ? [-0.105, 0, 0.105] : [-0.17, -0.08, 0, 0.08, 0.17]
    const aimX = Math.cos(angle)
    const aimY = Math.sin(angle)
    let firingAngle = angle
    let bestAlignment = -1
    let bestDistanceSquared = Number.POSITIVE_INFINITY
    this.directionalTargets.length = 0
    for (const enemy of this.enemies) if (!enemy.dead && enemy.spawnTimer <= 0) this.directionalTargets.push(enemy)
    for (const supply of this.supplies) if (!supply.dead && supply.spawnTimer <= 0) this.directionalTargets.push(supply)
    for (const target of this.directionalTargets) {
      const dx = target.x - this.player.x
      const dy = target.y - this.player.y
      const distanceSquared = dx * dx + dy * dy
      if (distanceSquared > AIM_ASSIST_RANGE_SQUARED) continue
      const forwardDistance = dx * aimX + dy * aimY
      if (forwardDistance <= 0) continue
      const sideDistance = Math.abs(dx * aimY - dy * aimX)
      if (sideDistance > forwardDistance * AIM_ASSIST_CONE_TANGENT) continue
      const alignment = forwardDistance * forwardDistance / distanceSquared
      if (alignment < bestAlignment || (alignment === bestAlignment && distanceSquared >= bestDistanceSquared)) continue
      firingAngle = Math.atan2(dy, dx)
      bestAlignment = alignment
      bestDistanceSquared = distanceSquared
    }
    const missile = this.missileTimer > 0
    const missileTarget = missile ? this.nearestEnemy(this.player) : null
    for (const offset of patterns) {
      if (this.bullets.length >= MAX_BULLETS) break
      const shotAngle = firingAngle + offset
      const dx = Math.cos(shotAngle)
      const dy = Math.sin(shotAngle)
      this.bullets.push({
        x: this.player.x + dx * 19 * this.unitsPerPixel,
        y: this.player.y + dy * 19 * this.unitsPerPixel,
        vx: dx * (missile ? MISSILE_SPEED : 790),
        vy: dy * (missile ? MISSILE_SPEED : 790),
        angle: shotAngle,
        life: missile ? 2.2 : 1.2,
        radius: (missile ? 4.2 : tier >= 4 ? 4 : 3) * this.unitsPerPixel,
        kind: missile ? 'missile' : 'bullet',
        source: 'player',
        target: missileTarget
      })
    }
    this.fireClock = this.overloadTimer > 0 ? 0.042 : tier >= 3 ? 0.075 : 0.09
    this.pushEvent('shoot', this.player.x, this.player.y, COLORS.yellow, tier, '')
  }

  updateBullets(dt: number): void {
    this.prepareEnemyIndex()
    for (const bullet of this.bullets) {
      if (bullet.kind === 'missile') {
        if (!bullet.target || bullet.target.dead || bullet.target.spawnTimer > 0) bullet.target = this.nearestEnemy(bullet)
        if (bullet.target) {
          const desiredAngle = Math.atan2(bullet.target.y - bullet.y, bullet.target.x - bullet.x)
          bullet.angle += angleDelta(bullet.angle, desiredAngle) * clamp(MISSILE_TURN_RATE * dt, 0, 1)
          bullet.vx = Math.cos(bullet.angle) * MISSILE_SPEED
          bullet.vy = Math.sin(bullet.angle) * MISSILE_SPEED
        }
      }
      for (const enemy of this.activeRepulsars) {
        const dx = bullet.x - enemy.x
        const dy = bullet.y - enemy.y
        const distance = Math.max(1, length(dx, dy))
        if (distance < 155) {
          const force = (155 - distance) * 9.5
          bullet.vx += dx / distance * force * dt
          bullet.vy += dy / distance * force * dt
        }
      }
      bullet.x += bullet.vx * dt
      bullet.y += bullet.vy * dt
      bullet.angle = Math.atan2(bullet.vy, bullet.vx)
      bullet.life -= dt
      if (Math.abs(bullet.x) > this.width * 0.56 || Math.abs(bullet.y) > this.height * 0.6) bullet.life = 0
    }
  }

  private nearestEnemy(point: Vector): Enemy | null {
    this.prepareEnemyIndex()
    let nearest: Enemy | null = null
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const enemy of this.activeEnemies) {
      if (enemy.dead || enemy.spawnTimer > 0) continue
      const dx = enemy.x - point.x
      const dy = enemy.y - point.y
      const distance = dx * dx + dy * dy
      if (distance >= nearestDistance) continue
      nearest = enemy
      nearestDistance = distance
    }
    return nearest
  }

  private prepareEnemyIndex(): void {
    if (!this.enemyIndexDirty) return
    this.activeEnemies.length = 0
    this.activeRepulsars.length = 0
    for (const enemy of this.enemies) {
      if (enemy.dead || enemy.spawnTimer > 0) continue
      this.activeEnemies.push(enemy)
      if (enemy.kind === 'repulsar') this.activeRepulsars.push(enemy)
    }
    this.enemyIndex.rebuild(this.activeEnemies, ENEMY_INDEX_CELL_SIZE * this.unitsPerPixel)
    this.enemyIndexDirty = false
  }

  updateEnemies(dt: number): void {
    this.enemyIndexDirty = true
    const player = this.player
    for (const enemy of this.enemies) {
      if (enemy.dead) continue
      if (enemy.selfDestruct > 0) {
        enemy.selfDestruct -= dt
        if (enemy.selfDestruct <= 0) {
          this.killEnemy(enemy)
          continue
        }
      }
      enemy.age += dt
      enemy.spawnTimer = Math.max(0, enemy.spawnTimer - dt)
      if (enemy.spawnTimer > 0) continue

      const dx = player.x - enemy.x
      const dy = player.y - enemy.y
      const direction = normalizeInto(dx, dy, this.normalizationScratch)
      let targetX = direction.x
      let targetY = direction.y

      if (enemy.kind === 'wanderer') {
        targetX = Math.cos(enemy.phase + enemy.age * 0.72) * 0.7 + direction.x * 0.35
        targetY = Math.sin(enemy.phase + enemy.age * 0.64) * 0.7 + direction.y * 0.35
      } else if (enemy.kind === 'weaver') {
        const weave = Math.sin(enemy.age * 5.2 + enemy.phase) * 0.95
        targetX = direction.x - direction.y * weave
        targetY = direction.y + direction.x * weave
      } else if (enemy.kind === 'spinner') {
        const orbit = Math.sin(enemy.age * 2.8 + enemy.phase)
        targetX = direction.x - direction.y * orbit * 0.7
        targetY = direction.y + direction.x * orbit * 0.7
        enemy.angle += dt * 4.8
      } else if (enemy.kind === 'repulsar') {
        const distance = length(dx, dy)
        const sign = distance < 230 ? -1 : 1
        targetX = direction.x * sign - direction.y * 0.45
        targetY = direction.y * sign + direction.x * 0.45
        enemy.angle += dt * 2.2
      } else if (enemy.kind === 'blackhole') {
        enemy.angle += dt * 1.5
        targetX *= 0.18
        targetY *= 0.18
        this.applyBlackhole(enemy, dt)
      }

      const steer = normalizeInto(targetX, targetY, this.normalizationScratch)
      const response = enemy.kind === 'grunt' ? 5.2 : 2.8
      enemy.vx += (steer.x * enemy.speed - enemy.vx) * response * dt
      enemy.vy += (steer.y * enemy.speed - enemy.vy) * response * dt
      enemy.x += enemy.vx * dt
      enemy.y += enemy.vy * dt
      if (enemy.kind !== 'spinner' && enemy.kind !== 'blackhole') enemy.angle = Math.atan2(enemy.vy, enemy.vx)
      if (enemy.kind === 'snake') this.updateSnake(enemy, dt)
    }
  }

  applyBlackhole(enemy: Enemy, dt: number): void {
    const player = this.player
    if (player.alive) {
      const dx = enemy.x - player.x
      const dy = enemy.y - player.y
      const distance = Math.max(34, length(dx, dy))
      if (distance < 300) {
        const force = enemy.mass * 7200 / (distance * distance)
        player.vx += dx / distance * force * dt
        player.vy += dy / distance * force * dt
      }
    }
    for (const bullet of this.bullets) {
      if (bullet.life <= 0) continue
      const dx = enemy.x - bullet.x
      const dy = enemy.y - bullet.y
      const distance = Math.max(8, length(dx, dy))
      if (distance < 260) {
        const force = enemy.mass * 52000 / (distance * distance)
        bullet.vx += dx / distance * force * dt
        bullet.vy += dy / distance * force * dt
      }
      if (distance < enemy.radius * 0.72) {
        bullet.life = 0
        enemy.mass = Math.min(2.3, enemy.mass + 0.025)
        enemy.radius = ENEMY_LOGICAL_RADIUS.blackhole * this.unitsPerPixel * enemy.mass
        this.pushEvent('blackhole', enemy.x, enemy.y, COLORS.magenta, 1, '')
      }
    }
  }

  updateSnake(enemy: Enemy, dt: number): void {
    let leaderX = enemy.x
    let leaderY = enemy.y
    for (const segment of enemy.segments) {
      const dx = leaderX - segment.x
      const dy = leaderY - segment.y
      const distance = Math.max(0.001, length(dx, dy))
      const desired = 19
      const correction = Math.max(0, distance - desired) * Math.min(1, dt * 18)
      segment.x += dx / distance * correction
      segment.y += dy / distance * correction
      segment.angle = Math.atan2(dy, dx)
      leaderX = segment.x
      leaderY = segment.y
    }
  }

  spawnSupply(x?: number, y?: number, effect?: SuperWeaponKind): Supply {
    const spawnX = x ?? (this.random() - 0.5) * Math.max(120, this.width - 136)
    const spawnY = y ?? (this.random() - 0.5) * Math.max(220, this.height - 210)
    const effects: readonly SuperWeaponKind[] = ['detonation', 'overload', 'allies']
    const selectedEffect = effect ?? effects[Math.min(effects.length - 1, Math.floor(this.random() * effects.length))]
    const supply: Supply = {
      x: spawnX,
      y: spawnY,
      radius: 22 * this.unitsPerPixel,
      health: SUPPLY_HITS,
      maxHealth: SUPPLY_HITS,
      effect: selectedEffect,
      spawnTimer: 0.6,
      age: 0,
      life: SUPPLY_LIFE,
      dead: false
    }
    this.supplies.push(supply)
    this.pushEvent('supply', supply.x, supply.y, COLORS.green, supply.maxHealth, 'SUPER SUPPLY INBOUND')
    return supply
  }

  updateSupplies(dt: number): void {
    for (const supply of this.supplies) {
      if (supply.dead) continue
      supply.age += dt
      supply.spawnTimer = Math.max(0, supply.spawnTimer - dt)
      supply.life -= dt
      if (supply.life <= 0) supply.dead = true
    }
  }

  collectSupply(supply: Supply): void {
    if (supply.dead) return
    supply.dead = true
    this.activateSuperWeapon(supply.effect)
  }

  activateSuperWeapon(effect: SuperWeaponKind): void {
    if (effect === 'detonation') {
      let delay = 0.1
      for (const enemy of this.enemies) {
        if (enemy.dead) continue
        enemy.selfDestruct = delay
        delay += 0.065
      }
      this.pushEvent('super', this.player.x, this.player.y, SUPER_EVENT_ART.detonation, 1, 'CHAIN DETONATION')
      return
    }
    if (effect === 'overload') {
      this.overloadTimer = OVERLOAD_DURATION
      this.pushEvent('super', this.player.x, this.player.y, SUPER_EVENT_ART.overload, 1, 'WEAPON OVERDRIVE 8S')
      return
    }
    this.spawnAllies(3 + Math.floor(this.random() * 3))
    this.pushEvent('super', this.player.x, this.player.y, SUPER_EVENT_ART.allies, this.allies.length, 'ALLY WING DEPLOYED')
  }

  private spawnAllies(count: number): void {
    this.allies.length = 0
    const amount = Math.min(5, count)
    for (let index = 0; index < amount; index += 1) {
      const phase = index / amount * Math.PI * 2
      this.allies.push({
        x: this.player.x + Math.cos(phase) * 46 * this.unitsPerPixel,
        y: this.player.y + Math.sin(phase) * 46 * this.unitsPerPixel,
        angle: phase,
        phase,
        life: ALLY_DURATION,
        fireTimer: index * 0.07,
        target: null
      })
    }
  }

  updateAllies(dt: number): void {
    for (let index = 0; index < this.allies.length; index += 1) {
      const ally = this.allies[index]
      ally.life -= dt
      if (ally.life <= 0) continue
      ally.phase += dt * (0.72 + index * 0.035)
      const orbit = (48 + index * 13) * this.unitsPerPixel
      const targetX = this.player.x + Math.cos(ally.phase) * orbit
      const targetY = this.player.y + Math.sin(ally.phase) * orbit
      const follow = clamp(dt * 5, 0, 1)
      ally.x += (targetX - ally.x) * follow
      ally.y += (targetY - ally.y) * follow
      ally.fireTimer -= dt
      if (!ally.target || ally.target.dead || ally.target.spawnTimer > 0) ally.target = this.nearestEnemy(ally)
      if (ally.target) ally.angle = Math.atan2(ally.target.y - ally.y, ally.target.x - ally.x)
      if (ally.target && ally.fireTimer <= 0) {
        this.spawnAllyBullet(ally)
        ally.fireTimer = 0.24 + index * 0.018
      }
    }
  }

  private spawnAllyBullet(ally: Ally): void {
    if (this.bullets.length >= MAX_BULLETS) return
    const dx = Math.cos(ally.angle)
    const dy = Math.sin(ally.angle)
    this.bullets.push({
      x: ally.x + dx * 11 * this.unitsPerPixel,
      y: ally.y + dy * 11 * this.unitsPerPixel,
      vx: dx * 820,
      vy: dy * 820,
      angle: ally.angle,
      life: 1.15,
      radius: 2.4 * this.unitsPerPixel,
      kind: 'bullet',
      source: 'ally',
      target: null
    })
  }

  resolveCollisions(): void {
    this.prepareEnemyIndex()
    for (const bullet of this.bullets) {
      if (bullet.life <= 0) continue
      for (const supply of this.supplies) {
        if (supply.dead || supply.spawnTimer > 0) continue
        const hitRadius = supply.radius + bullet.radius
        const dx = bullet.x - supply.x
        const dy = bullet.y - supply.y
        if (dx * dx + dy * dy > hitRadius * hitRadius) continue
        bullet.life = 0
        supply.health -= 1
        this.pushEvent('supply', supply.x, supply.y, SUPER_WEAPON_ART.glow, supply.health, '')
        if (supply.health <= 0) this.collectSupply(supply)
        break
      }
      if (bullet.life <= 0) continue
      this.enemyIndex.queryInto(bullet, COLLISION_QUERY_RADIUS * this.unitsPerPixel, this.collisionCandidates)
      for (const enemy of this.collisionCandidates) {
        if (enemy.dead || enemy.spawnTimer > 0) continue
        const hitRadius = enemy.radius + bullet.radius + BULLET_HIT_FORGIVENESS * this.unitsPerPixel
        const dx = bullet.x - enemy.x
        const dy = bullet.y - enemy.y
        if (dx * dx + dy * dy > hitRadius * hitRadius) continue
        bullet.life = 0
        enemy.health -= 1
        if (enemy.kind === 'spinner' && !enemy.missileChargeUsed) {
          enemy.missileChargeUsed = true
          this.missileTimer = MISSILE_DURATION
          this.pushEvent('super', enemy.x, enemy.y, COLORS.orange, 1, 'MISSILE LOCK 5S')
        }
        if (enemy.health <= 0) this.killEnemy(enemy)
        break
      }
    }

    const player = this.player
    if (!player.alive || player.invulnerable > 0) return
    for (const enemy of this.enemies) {
      if (enemy.dead || enemy.spawnTimer > 0) continue
      const dx = player.x - enemy.x
      const dy = player.y - enemy.y
      if (dx * dx + dy * dy < (player.radius + enemy.radius * 0.78) ** 2) {
        this.loseLife()
        return
      }
    }
  }

  killEnemy(enemy: Enemy, emitPresentation = true): void {
    enemy.dead = true
    this.enemyIndexDirty = true
    const gained = enemy.value * this.multiplier
    this.score += gained
    this.highScore = Math.max(this.highScore, this.score)
    this.kills += 1
    this.multiplier = Math.min(10, 1 + Math.floor(this.kills / 10))
    if (emitPresentation) this.pushEvent('kill', enemy.x, enemy.y, this.enemyColor(enemy.kind), gained, `+${gained}`)
    while (this.score >= this.nextLife) {
      this.lives += 1
      this.nextLife += 75000
      this.pushEvent('reward', 0, 64, COLORS.green, 1, 'EXTRA LIFE')
    }
    while (this.score >= this.nextSupply) {
      this.spawnSupply()
      this.nextSupply += 100000
      this.supplyClock = 18 + this.random() * 10
    }
  }

  loseLife(): void {
    if (!this.player.alive || this.player.invulnerable > 0) return
    this.lives -= 1
    this.multiplier = 1
    this.kills = 0
    this.player.alive = false
    this.player.respawnTimer = 1.15
    this.pushEvent('death', this.player.x, this.player.y, COLORS.white, 1, this.lives > 0 ? 'GRID BREACH' : 'GRID COLLAPSED')
  }

  useBomb(): void {
    if (this.bombs <= 0 || !this.player.alive) return
    this.bombs -= 1
    let presentationEvents = 0
    for (const enemy of this.enemies) {
      if (enemy.dead) continue
      if (enemy.kind === 'blackhole') {
        enemy.health -= 5
        enemy.mass *= 0.7
        enemy.radius = Math.max(ENEMY_LOGICAL_RADIUS.blackhole * this.unitsPerPixel * 0.85, enemy.radius * 0.7)
        if (enemy.health <= 0) {
          this.killEnemy(enemy, presentationEvents < BOMB_KILL_EVENT_LIMIT)
          presentationEvents += 1
        }
      } else {
        this.killEnemy(enemy, presentationEvents < BOMB_KILL_EVENT_LIMIT)
        presentationEvents += 1
      }
    }
    this.pushEvent('bomb', this.player.x, this.player.y, COLORS.cyan, 1, 'SMART BOMB')
  }

  spawnWave(): void {
    const nextWave = 1 + Math.floor(this.elapsed / 20)
    if (nextWave !== this.wave) {
      this.wave = nextWave
      this.pushEvent('wave', 0, 88, COLORS.gridHot, this.wave, `GRID LEVEL ${this.wave}`)
    }
    const cap = Math.min(MAX_LIVE_ENEMIES, 24 + this.wave * 4)
    const living = this.enemies.reduce((count, enemy) => count + (enemy.dead ? 0 : 1), 0)
    const batch = Math.min(7, 1 + Math.floor(this.elapsed / 32))
    for (let index = 0; index < batch && living + index < cap; index += 1) this.spawnEnemy(this.pickEnemy())
    this.spawnClock = Math.max(0.2, 1.08 - this.elapsed * 0.0055) * (0.78 + this.random() * 0.46)
  }

  pickEnemy(): EnemyKind {
    const pool: EnemyKind[] = ['wanderer', 'grunt', 'grunt']
    if (this.elapsed > 10) pool.push('weaver')
    if (this.elapsed > 22) pool.push('spinner')
    if (this.elapsed > 36) pool.push('snake')
    if (this.elapsed > 52) pool.push('repulsar')
    if (this.elapsed > 72 && this.random() < 0.15) return 'blackhole'
    return pool[Math.floor(this.random() * pool.length)]
  }

  spawnEnemy(kind: EnemyKind, x?: number, y?: number): Enemy {
    const side = Math.floor(this.random() * 4)
    const halfWidth = this.width * 0.5
    const halfHeight = this.height * 0.5
    const padding = 34
    let spawnX = x ?? 0
    let spawnY = y ?? 0
    if (x === undefined || y === undefined) {
      if (side === 0) {
        spawnX = -halfWidth - padding
        spawnY = (this.random() - 0.5) * this.height
      } else if (side === 1) {
        spawnX = halfWidth + padding
        spawnY = (this.random() - 0.5) * this.height
      } else if (side === 2) {
        spawnX = (this.random() - 0.5) * this.width
        spawnY = halfHeight + padding
      } else {
        spawnX = (this.random() - 0.5) * this.width
        spawnY = -halfHeight - padding
      }
    }
    const speedScale = Math.min(1.75, 1 + this.elapsed / 210)
    const baseSpeed = kind === 'wanderer' ? 84 : kind === 'grunt' ? 116 : kind === 'snake' ? 105 : kind === 'blackhole' ? 22 : 96
    const health = kind === 'blackhole' ? 14 : kind === 'repulsar' ? 3 : kind === 'snake' ? 2 : 1
    const segments: SnakeSegment[] = []
    if (kind === 'snake') {
      for (let index = 0; index < 9; index += 1) segments.push({ x: spawnX - index * 18, y: spawnY, angle: 0 })
    }
    const enemy: Enemy = {
      kind,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      angle: 0,
      radius: ENEMY_LOGICAL_RADIUS[kind] * this.unitsPerPixel,
      speed: baseSpeed * speedScale,
      health,
      value: ENEMY_VALUE[kind],
      age: 0,
      phase: this.random() * Math.PI * 2,
      spawnTimer: 0.45,
      dead: false,
      mass: 1,
      segments,
      missileChargeUsed: false,
      selfDestruct: 0
    }
    this.enemies.push(enemy)
    this.enemyIndexDirty = true
    return enemy
  }

  enemyColor(kind: EnemyKind): string {
    return ENEMY_ART_COLOR[kind]
  }

  cleanup(): void {
    let bulletCount = 0
    for (const bullet of this.bullets) {
      if (bullet.life <= 0) continue
      this.bullets[bulletCount] = bullet
      bulletCount += 1
    }
    this.bullets.length = bulletCount

    let enemyCount = 0
    for (const enemy of this.enemies) {
      if (enemy.dead || Math.abs(enemy.x) >= this.width * 0.72 || Math.abs(enemy.y) >= this.height * 0.78) continue
      this.enemies[enemyCount] = enemy
      enemyCount += 1
    }
    this.enemies.length = enemyCount
    this.enemyIndexDirty = true

    let supplyCount = 0
    for (const supply of this.supplies) {
      if (supply.dead) continue
      this.supplies[supplyCount] = supply
      supplyCount += 1
    }
    this.supplies.length = supplyCount

    let allyCount = 0
    for (const ally of this.allies) {
      if (ally.life <= 0) continue
      this.allies[allyCount] = ally
      allyCount += 1
    }
    this.allies.length = allyCount
  }

  pushEvent(kind: WorldEventKind, x: number, y: number, color: string, amount: number, text: string): void {
    this.events.push({ kind, x, y, color, amount, text })
  }

  consumeEvents(): WorldEvent[] {
    const result = this.events
    this.events = []
    return result
  }
}
