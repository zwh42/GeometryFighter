// allow: SIZE_OK — cohesive deterministic gameplay state machine mirrored by the WeChat runtime.
export type EnemyKind = 'wanderer' | 'grunt' | 'weaver' | 'spinner' | 'snake' | 'repulsar' | 'blackhole' | 'dart' | 'orbiter' | 'crusher' | 'splitter' | 'shard'
export type GameState = 'title' | 'playing' | 'paused' | 'gameover'
export type SuperWeaponKind = 'detonation' | 'overload' | 'allies'
export type AssaultKind = 'swarm' | 'flank' | 'spiral' | 'siege'

export interface AssaultProfile {
  phase: number
  wave: number
  kind: AssaultKind
  label: string
  batchBonus: number
  active: boolean
  timeLeft: number
}

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
  fragmentsOnDeath: boolean
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
}

export type WorldEventKind = 'shoot' | 'kill' | 'death' | 'reward' | 'wave' | 'blackhole' | 'supply' | 'super'

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
  start: boolean
  pause: boolean
}

export type DirectionalTarget = Vector & {
  readonly radius: number
}

const ENEMY_VALUE: Record<EnemyKind, number> = {
  wanderer: 25,
  grunt: 100,
  weaver: 150,
  spinner: 200,
  snake: 350,
  repulsar: 500,
  blackhole: 1000,
  dart: 180,
  orbiter: 240,
  crusher: 650,
  splitter: 420,
  shard: 60
}

const ENEMY_RADIUS: Record<EnemyKind, number> = {
  wanderer: 9,
  grunt: 13,
  weaver: 14,
  spinner: 15,
  snake: 15,
  repulsar: 18,
  blackhole: 26,
  dart: 10,
  orbiter: 13,
  crusher: 20,
  splitter: 17,
  shard: 7
}

const ENEMY_SPEED: Record<EnemyKind, number> = {
  wanderer: 84,
  grunt: 116,
  weaver: 96,
  spinner: 96,
  snake: 105,
  repulsar: 96,
  blackhole: 22,
  dart: 154,
  orbiter: 104,
  crusher: 62,
  splitter: 82,
  shard: 166
}

const ENEMY_HEALTH: Record<EnemyKind, number> = {
  wanderer: 1,
  grunt: 1,
  weaver: 1,
  spinner: 1,
  snake: 2,
  repulsar: 3,
  blackhole: 14,
  dart: 1,
  orbiter: 2,
  crusher: 7,
  splitter: 3,
  shard: 1
}

const MISSILE_DURATION = 5
const MISSILE_SPEED = 460
const MISSILE_TURN_RATE = 5.4
const PLAYER_BULLET_SPEED = 570
const PLAYER_FIRE_RATE = 0.105
const MAX_BULLETS = 320
export const AIM_INPUT_THRESHOLD = 0.18
export const AIM_HEADING_RESPONSE = 14
export const AIM_ASSIST_HALF_ANGLE = Math.PI * 26 / 180
export const AIM_ASSIST_RANGE_RATIO = 0.62
const SUPPLY_HITS = 8
const OVERLOAD_DURATION = 8
const ALLY_DURATION = 12
const ASSAULT_DURATION = 18
const ASSAULT_ACTIVE_DURATION = 15.5
const ASSAULTS: readonly Pick<AssaultProfile, 'kind' | 'label' | 'batchBonus'>[] = [
  { kind: 'swarm', label: 'SWARM', batchBonus: 2 },
  { kind: 'flank', label: 'FLANK', batchBonus: 1 },
  { kind: 'spiral', label: 'SPIRAL', batchBonus: 1 },
  { kind: 'siege', label: 'SIEGE', batchBonus: 0 }
]

export function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value))
}

export function length(x: number, y: number): number {
  return Math.hypot(x, y)
}

export function normalized(x: number, y: number): Vector {
  const size = length(x, y)
  if (size < 0.0001) return { x: 0, y: 0 }
  return { x: x / size, y: y / size }
}

export function angleDelta(current: number, target: number): number {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current))
}

export function directionalTargetAngle(origin: Vector, heading: number, targets: readonly DirectionalTarget[], halfAngle: number, maxRange: number): number {
  let selectedAngle = heading
  let selectedScore = Number.POSITIVE_INFINITY
  for (const target of targets) {
    const dx = target.x - origin.x
    const dy = target.y - origin.y
    const distance = length(dx, dy)
    if (distance < 0.0001 || distance > maxRange) continue
    const angle = Math.atan2(dy, dx)
    const error = Math.abs(angleDelta(heading, angle))
    if (error > halfAngle) continue
    const missDistance = Math.max(0, Math.sin(error) * distance - target.radius)
    const score = missDistance + distance * 0.06
    if (score < selectedScore) {
      selectedAngle = angle
      selectedScore = score
    }
  }
  return selectedAngle
}

export function weaponTier(score: number): number {
  if (score >= 60000) return 4
  if (score >= 30000) return 3
  if (score >= 10000) return 2
  return 1
}

export function assaultAt(seconds: number): AssaultProfile {
  const safeSeconds = Math.max(0, seconds)
  const phase = Math.floor(safeSeconds / ASSAULT_DURATION)
  const profile = ASSAULTS[phase % ASSAULTS.length]
  const localTime = safeSeconds - phase * ASSAULT_DURATION
  return {
    phase,
    wave: phase + 1,
    kind: profile.kind,
    label: profile.label,
    batchBonus: profile.batchBonus,
    active: localTime < ASSAULT_ACTIVE_DURATION,
    timeLeft: ASSAULT_DURATION - localTime
  }
}

export class GeometryWorld {
  width = 720
  height = 1280
  state: GameState = 'title'
  elapsed = 0
  score = 0
  highScore = 0
  lives = 3
  multiplier = 1
  kills = 0
  wave = 1
  assault = assaultAt(0)
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
  player: Player = this.makePlayer()
  bullets: Bullet[] = []
  enemies: Enemy[] = []
  supplies: Supply[] = []
  allies: Ally[] = []
  events: WorldEvent[] = []
  private readonly directionalTargets: DirectionalTarget[] = []

  resize(width: number, height: number): void {
    this.width = Math.max(320, width)
    this.height = Math.max(568, height)
    this.player.x = clamp(this.player.x, -this.width * 0.48, this.width * 0.48)
    this.player.y = clamp(this.player.y, -this.height * 0.48, this.height * 0.48)
  }

  makePlayer(): Player {
    return {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      radius: 11,
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
    this.multiplier = 1
    this.kills = 0
    this.wave = 1
    this.assault = assaultAt(0)
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
    this.directionalTargets.length = 0
    this.pushEvent('wave', 0, 0, '#6ffcff', 1, 'ASSAULT 01 // SWARM')
  }

  update(dt: number, controls: ControlState): void {
    if (controls.start && (this.state === 'title' || this.state === 'gameover')) this.reset()
    if (controls.pause && (this.state === 'playing' || this.state === 'paused')) {
      this.state = this.state === 'playing' ? 'paused' : 'playing'
    }
    if (this.state !== 'playing') return

    const step = Math.min(dt, 0.034)
    this.elapsed += step
    const nextAssault = assaultAt(this.elapsed)
    if (nextAssault.wave !== this.wave) {
      this.wave = nextAssault.wave
      this.spawnClock = Math.min(this.spawnClock, 0.18)
      this.pushEvent('wave', 0, 88, '#6ffcff', this.wave, `ASSAULT ${this.waveText()} // ${nextAssault.label}`)
    }
    this.assault = nextAssault
    this.updateSpecialTimers(step)
    this.updatePlayer(step, controls)
    this.updateSupplies(step)
    this.updateBullets(step)
    this.updateEnemies(step)
    this.updateAllies(step)
    this.resolveCollisions()
    this.spawnClock -= step
    if (this.spawnClock <= 0) {
      if (this.assault.active) this.spawnWave()
      else this.spawnClock = 0.15
    }
    this.supplyClock -= step
    if (this.supplyClock <= 0 && !this.supplies.some((supply) => !supply.dead)) {
      this.spawnSupply()
      this.supplyClock = 18 + this.random() * 10
    }
    this.cleanup()
  }

  updateSpecialTimers(dt: number): void {
    this.missileTimer = Math.max(0, this.missileTimer - dt)
    this.overloadTimer = Math.max(0, this.overloadTimer - dt)
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
        if (this.fireClock <= 0) {
          const launchAngle = this.directionalFireAngle(this.fireHeading)
          player.angle += angleDelta(player.angle, launchAngle) * clamp(dt * AIM_HEADING_RESPONSE, 0, 1)
          this.fire(launchAngle)
        }
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

  private directionalFireAngle(heading: number): number {
    this.directionalTargets.length = 0
    for (const enemy of this.enemies) {
      if (!enemy.dead && enemy.spawnTimer <= 0) this.directionalTargets.push(enemy)
    }
    for (const supply of this.supplies) {
      if (!supply.dead && supply.spawnTimer <= 0) this.directionalTargets.push(supply)
    }
    return directionalTargetAngle(
      this.player,
      heading,
      this.directionalTargets,
      AIM_ASSIST_HALF_ANGLE,
      Math.max(this.width, this.height) * AIM_ASSIST_RANGE_RATIO
    )
  }

  private nearestEnemy(x: number, y: number): Enemy | null {
    let nearest: Enemy | null = null
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const enemy of this.enemies) {
      if (enemy.dead || enemy.spawnTimer > 0) continue
      const dx = enemy.x - x
      const dy = enemy.y - y
      const distance = dx * dx + dy * dy
      if (distance < nearestDistance) {
        nearest = enemy
        nearestDistance = distance
      }
    }
    return nearest
  }

  fire(angle: number): void {
    const tier = weaponTier(this.score)
    const missile = this.missileTimer > 0
    if (this.overloadTimer > 0) {
      for (let spread = -4; spread <= 4; spread += 1) this.spawnPlayerBullet(angle + spread * 0.07, spread * 1.4, missile)
    } else if (tier === 1) {
      this.spawnPlayerBullet(angle, 0, missile)
    } else if (tier === 2) {
      this.spawnPlayerBullet(angle, -4.5, missile)
      this.spawnPlayerBullet(angle, 4.5, missile)
    } else if (tier === 3) {
      this.spawnPlayerBullet(angle - 0.105, 0, missile)
      this.spawnPlayerBullet(angle, 0, missile)
      this.spawnPlayerBullet(angle + 0.105, 0, missile)
    } else {
      this.spawnPlayerBullet(angle - 0.15, -3, missile)
      this.spawnPlayerBullet(angle - 0.045, -3, missile)
      this.spawnPlayerBullet(angle + 0.045, 3, missile)
      this.spawnPlayerBullet(angle + 0.15, 3, missile)
    }
    this.fireClock = this.overloadTimer > 0 ? 0.042 : PLAYER_FIRE_RATE
    this.pushEvent('shoot', this.player.x, this.player.y, '#fff36a', tier, '')
  }

  private spawnPlayerBullet(angle: number, sideOffset: number, missile: boolean): void {
    if (this.bullets.length >= MAX_BULLETS) return
    const sideX = Math.cos(angle + Math.PI * 0.5) * sideOffset
    const sideY = Math.sin(angle + Math.PI * 0.5) * sideOffset
    const x = this.player.x + Math.cos(angle) * 14 + sideX
    const y = this.player.y + Math.sin(angle) * 14 + sideY
    this.bullets.push({
      x,
      y,
      vx: Math.cos(angle) * (missile ? MISSILE_SPEED : PLAYER_BULLET_SPEED),
      vy: Math.sin(angle) * (missile ? MISSILE_SPEED : PLAYER_BULLET_SPEED),
      angle,
      life: missile ? 2.2 : 1.25,
      radius: missile ? 4.2 : 2.8,
      kind: missile ? 'missile' : 'bullet',
      source: 'player'
    })
  }

  updateBullets(dt: number): void {
    for (const bullet of this.bullets) {
      if (bullet.kind === 'missile') {
        const target = this.nearestEnemy(bullet.x, bullet.y)
        if (target) {
          const desiredAngle = Math.atan2(target.y - bullet.y, target.x - bullet.x)
          const turn = angleDelta(bullet.angle, desiredAngle) * clamp(MISSILE_TURN_RATE * dt, 0, 1)
          bullet.angle += turn
          bullet.vx = Math.cos(bullet.angle) * MISSILE_SPEED
          bullet.vy = Math.sin(bullet.angle) * MISSILE_SPEED
        }
      }
      for (const enemy of this.enemies) {
        if (enemy.dead || enemy.kind !== 'repulsar' || enemy.spawnTimer > 0) continue
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

  spawnSupply(x?: number, y?: number, effect?: SuperWeaponKind): Supply {
    const spawnX = x ?? (this.random() - 0.5) * Math.max(120, this.width - 136)
    const spawnY = y ?? (this.random() - 0.5) * Math.max(220, this.height - 210)
    const effects: readonly SuperWeaponKind[] = ['detonation', 'overload', 'allies']
    const selectedEffect = effect ?? effects[Math.min(effects.length - 1, Math.floor(this.random() * effects.length))]
    const supply: Supply = {
      x: spawnX,
      y: spawnY,
      radius: 22,
      health: SUPPLY_HITS,
      maxHealth: SUPPLY_HITS,
      effect: selectedEffect,
      spawnTimer: 0.6,
      age: 0,
      life: 18,
      dead: false
    }
    this.supplies.push(supply)
    this.pushEvent('supply', supply.x, supply.y, '#bcff49', supply.maxHealth, 'SUPER SUPPLY INBOUND')
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
    switch (effect) {
      case 'detonation': {
        let delay = 0.1
        for (const enemy of this.enemies) {
          if (enemy.dead) continue
          if (enemy.kind === 'splitter') enemy.fragmentsOnDeath = false
          enemy.selfDestruct = delay
          delay += 0.065
        }
        this.pushEvent('super', this.player.x, this.player.y, '#ff6d77', 1, 'CHAIN DETONATION')
        return
      }
      case 'overload':
        this.overloadTimer = OVERLOAD_DURATION
        this.pushEvent('super', this.player.x, this.player.y, '#fff36a', 1, 'WEAPON OVERDRIVE 8S')
        return
      case 'allies':
        this.spawnAllies(3 + Math.floor(this.random() * 3))
        this.pushEvent('super', this.player.x, this.player.y, '#43f6ff', this.allies.length, 'ALLY WING DEPLOYED')
        return
      default: {
        const unreachable: never = effect
        return unreachable
      }
    }
  }

  private spawnAllies(count: number): void {
    this.allies.length = 0
    const amount = Math.min(5, count)
    for (let index = 0; index < amount; index += 1) {
      const phase = index / amount * Math.PI * 2
      this.allies.push({
        x: this.player.x + Math.cos(phase) * 46,
        y: this.player.y + Math.sin(phase) * 46,
        angle: phase,
        phase,
        life: ALLY_DURATION,
        fireTimer: index * 0.07
      })
    }
  }

  updateAllies(dt: number): void {
    for (let index = 0; index < this.allies.length; index += 1) {
      const ally = this.allies[index]
      ally.life -= dt
      if (ally.life <= 0) continue
      ally.phase += dt * (0.72 + index * 0.035)
      const orbit = 48 + index * 13
      const targetX = this.player.x + Math.cos(ally.phase) * orbit
      const targetY = this.player.y + Math.sin(ally.phase) * orbit
      const follow = clamp(dt * 5, 0, 1)
      ally.x += (targetX - ally.x) * follow
      ally.y += (targetY - ally.y) * follow
      ally.fireTimer -= dt
      const target = this.nearestEnemy(ally.x, ally.y)
      if (target) ally.angle = Math.atan2(target.y - ally.y, target.x - ally.x)
      if (target && ally.fireTimer <= 0) {
        this.spawnAllyBullet(ally)
        ally.fireTimer = 0.24 + index * 0.018
      }
    }
  }

  private spawnAllyBullet(ally: Ally): void {
    const dx = Math.cos(ally.angle)
    const dy = Math.sin(ally.angle)
    this.bullets.push({
      x: ally.x + dx * 11,
      y: ally.y + dy * 11,
      vx: dx * 820,
      vy: dy * 820,
      angle: ally.angle,
      life: 1.15,
      radius: 2.4,
      kind: 'bullet',
      source: 'ally'
    })
  }

  updateEnemies(dt: number): void {
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
      const direction = normalized(dx, dy)
      let targetX = direction.x
      let targetY = direction.y
      let response = 2.8
      let speedScale = 1
      let faceVelocity = true

      switch (enemy.kind) {
        case 'wanderer':
          targetX = Math.cos(enemy.phase + enemy.age * 0.72) * 0.7 + direction.x * 0.35
          targetY = Math.sin(enemy.phase + enemy.age * 0.64) * 0.7 + direction.y * 0.35
          break
        case 'grunt':
          response = 5.2
          break
        case 'weaver': {
          const weave = Math.sin(enemy.age * 5.2 + enemy.phase) * 0.95
          targetX = direction.x - direction.y * weave
          targetY = direction.y + direction.x * weave
          break
        }
        case 'spinner': {
          const orbit = Math.sin(enemy.age * 2.8 + enemy.phase)
          targetX = direction.x - direction.y * orbit * 0.7
          targetY = direction.y + direction.x * orbit * 0.7
          enemy.angle += dt * 4.8
          faceVelocity = false
          break
        }
        case 'snake':
          break
        case 'repulsar': {
          const distance = length(dx, dy)
          const sign = distance < 230 ? -1 : 1
          targetX = direction.x * sign - direction.y * 0.45
          targetY = direction.y * sign + direction.x * 0.45
          enemy.angle += dt * 2.2
          faceVelocity = false
          break
        }
        case 'blackhole':
          enemy.angle += dt * 1.5
          speedScale = 0.18
          faceVelocity = false
          this.applyBlackhole(enemy, dt)
          break
        case 'dart': {
          const charging = enemy.age % 1.35 < 0.45
          speedScale = charging ? 1.85 : 0.45
          response = charging ? 8 : 3
          break
        }
        case 'orbiter': {
          const distance = length(dx, dy)
          const radial = distance > 260 ? 0.8 : distance < 180 ? -0.8 : 0
          const orbitDirection = Math.sin(enemy.phase) >= 0 ? 1 : -1
          targetX = direction.x * radial - direction.y * orbitDirection
          targetY = direction.y * radial + direction.x * orbitDirection
          response = 3.4
          enemy.angle += dt * orbitDirection * 2.8
          faceVelocity = false
          break
        }
        case 'crusher':
          response = 0.7
          enemy.angle += dt * 0.55
          faceVelocity = false
          break
        case 'splitter': {
          const wave = Math.sin(enemy.age * 2.6 + enemy.phase) * 0.35
          targetX = direction.x - direction.y * wave
          targetY = direction.y + direction.x * wave
          response = 1.4
          enemy.angle += dt * 1.6
          faceVelocity = false
          break
        }
        case 'shard': {
          const curve = Math.sin(enemy.age * 7 + enemy.phase) * 0.32
          targetX = direction.x - direction.y * curve
          targetY = direction.y + direction.x * curve
          response = 5.5
          break
        }
        default: {
          const unreachable: never = enemy.kind
          return unreachable
        }
      }

      const steer = normalized(targetX, targetY)
      enemy.vx += (steer.x * enemy.speed * speedScale - enemy.vx) * response * dt
      enemy.vy += (steer.y * enemy.speed * speedScale - enemy.vy) * response * dt
      enemy.x += enemy.vx * dt
      enemy.y += enemy.vy * dt
      if (faceVelocity) enemy.angle = Math.atan2(enemy.vy, enemy.vx)
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
        enemy.radius = 26 * enemy.mass
        this.pushEvent('blackhole', enemy.x, enemy.y, '#ff5be7', 1, '')
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

  resolveCollisions(): void {
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
        this.pushEvent('supply', supply.x, supply.y, '#bcff49', supply.health, '')
        if (supply.health <= 0) this.collectSupply(supply)
        break
      }
      if (bullet.life <= 0) continue
      for (const enemy of this.enemies) {
        if (enemy.dead || enemy.spawnTimer > 0) continue
        const hitRadius = enemy.radius + bullet.radius
        const dx = bullet.x - enemy.x
        const dy = bullet.y - enemy.y
        if (dx * dx + dy * dy > hitRadius * hitRadius) continue
        bullet.life = 0
        enemy.health -= 1
        if (enemy.kind === 'spinner' && !enemy.missileChargeUsed) {
          enemy.missileChargeUsed = true
          this.missileTimer = MISSILE_DURATION
          this.pushEvent('super', enemy.x, enemy.y, '#ff9f2f', 1, 'MISSILE LOCK 5S')
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

  killEnemy(enemy: Enemy): void {
    enemy.dead = true
    if (enemy.fragmentsOnDeath) this.spawnSplitterShards(enemy)
    const gained = enemy.value * this.multiplier
    this.score += gained
    this.highScore = Math.max(this.highScore, this.score)
    this.kills += 1
    this.multiplier = Math.min(10, 1 + Math.floor(this.kills / 10))
    this.pushEvent('kill', enemy.x, enemy.y, this.enemyColor(enemy.kind), gained, `+${gained}`)
    while (this.score >= this.nextLife) {
      this.lives += 1
      this.nextLife += 75000
      this.pushEvent('reward', 0, 64, '#7dff9b', 1, 'EXTRA LIFE')
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
    this.pushEvent('death', this.player.x, this.player.y, '#ffffff', 1, this.lives > 0 ? 'GRID BREACH' : 'GRID COLLAPSED')
  }

  spawnWave(): void {
    const cap = Math.min(90, 24 + this.wave * 4)
    const living = this.enemies.reduce((count, enemy) => count + (enemy.dead ? 0 : 1), 0)
    const batch = Math.min(7, 1 + Math.floor(this.elapsed / 32) + this.assault.batchBonus)
    const count = Math.min(batch, cap - living)
    const side = Math.floor(this.random() * 4)
    for (let index = 0; index < count; index += 1) this.spawnAssaultEnemy(this.pickEnemy(), side, index, count)
    this.spawnClock = Math.max(0.2, 1.08 - this.elapsed * 0.0055) * (0.78 + this.random() * 0.46)
  }

  private waveText(): string {
    return this.wave < 10 ? `0${this.wave}` : String(this.wave)
  }

  pickEnemy(): EnemyKind {
    const pool: EnemyKind[] = ['wanderer', 'grunt', 'grunt']
    if (this.assault.kind === 'swarm') pool.push('wanderer', 'grunt', 'grunt', 'weaver')
    if (this.elapsed > 12) pool.push('dart', 'dart')
    if (this.elapsed > 10) pool.push('weaver')
    if (this.elapsed > 17 && this.assault.kind === 'flank') pool.push('dart', 'dart', 'weaver', 'orbiter')
    if (this.elapsed > 26) pool.push('orbiter')
    if (this.elapsed > 22) pool.push('spinner')
    if (this.elapsed > 35 && this.assault.kind === 'spiral') pool.push('spinner', 'spinner', 'orbiter', 'snake')
    if (this.elapsed > 44) pool.push('splitter')
    if (this.elapsed > 36) pool.push('snake')
    if (this.elapsed > 53 && this.assault.kind === 'siege') pool.push('splitter', 'snake', 'repulsar')
    if (this.elapsed > 62) pool.push('crusher')
    if (this.elapsed > 52) pool.push('repulsar')
    if (this.elapsed > 72 && this.random() < 0.15) return 'blackhole'
    return pool[Math.floor(this.random() * pool.length)]
  }

  private spawnAssaultEnemy(kind: EnemyKind, side: number, index: number, count: number): Enemy {
    const halfWidth = this.width * 0.5
    const halfHeight = this.height * 0.5
    const inset = ENEMY_RADIUS[kind] + 24
    const baseLane = (index + 1) / (count + 1)
    const lane = clamp(baseLane + (this.random() - 0.5) * 0.16, 0.08, 0.92)
    if (side === 0) return this.spawnEnemy(kind, -halfWidth + inset, -halfHeight + lane * this.height)
    if (side === 1) return this.spawnEnemy(kind, halfWidth - inset, -halfHeight + lane * this.height)
    if (side === 2) return this.spawnEnemy(kind, -halfWidth + lane * this.width, halfHeight - inset)
    return this.spawnEnemy(kind, -halfWidth + lane * this.width, -halfHeight + inset)
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
      radius: ENEMY_RADIUS[kind],
      speed: ENEMY_SPEED[kind] * speedScale,
      health: ENEMY_HEALTH[kind],
      value: ENEMY_VALUE[kind],
      age: 0,
      phase: this.random() * Math.PI * 2,
      spawnTimer: 0.45,
      dead: false,
      mass: 1,
      segments,
      missileChargeUsed: false,
      fragmentsOnDeath: kind === 'splitter',
      selfDestruct: 0
    }
    this.enemies.push(enemy)
    return enemy
  }

  enemyColor(kind: EnemyKind): string {
    switch (kind) {
      case 'wanderer': return '#9d61ff'
      case 'grunt': return '#43f6ff'
      case 'weaver': return '#73ff80'
      case 'spinner': return '#ff48ed'
      case 'snake': return '#ffe45c'
      case 'repulsar': return '#ff9f2f'
      case 'blackhole': return '#ff506d'
      case 'dart': return '#ff9f2f'
      case 'orbiter': return '#9d61ff'
      case 'crusher': return '#ff554d'
      case 'splitter': return '#ff48ed'
      case 'shard': return '#ff48ed'
      default: {
        const unreachable: never = kind
        return unreachable
      }
    }
  }

  private spawnSplitterShards(enemy: Enemy): void {
    for (let index = 0; index < 3; index += 1) {
      const angle = enemy.angle + index / 3 * Math.PI * 2
      const shard = this.spawnEnemy('shard', enemy.x + Math.cos(angle) * 12, enemy.y + Math.sin(angle) * 12)
      shard.spawnTimer = 0.12
      shard.phase = angle
      shard.vx = Math.cos(angle) * shard.speed
      shard.vy = Math.sin(angle) * shard.speed
    }
  }

  cleanup(): void {
    let write = 0
    for (const bullet of this.bullets) {
      if (bullet.life > 0) {
        this.bullets[write] = bullet
        write += 1
      }
    }
    this.bullets.length = write

    write = 0
    for (const enemy of this.enemies) {
      if (!enemy.dead && Math.abs(enemy.x) < this.width * 0.72 && Math.abs(enemy.y) < this.height * 0.78) {
        this.enemies[write] = enemy
        write += 1
      }
    }
    this.enemies.length = write

    write = 0
    for (const supply of this.supplies) {
      if (!supply.dead) {
        this.supplies[write] = supply
        write += 1
      }
    }
    this.supplies.length = write

    write = 0
    for (const ally of this.allies) {
      if (ally.life > 0) {
        this.allies[write] = ally
        write += 1
      }
    }
    this.allies.length = write
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
