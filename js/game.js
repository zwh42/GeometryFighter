const math = require('./math')
const config = require('./config')
const Input = require('./input')
const AudioSystem = require('./audio')
const effects = require('./effects')
const Renderer = require('./renderer')

class GeometryGame {
  constructor(platform, canvas, context) {
    this.platform = platform
    this.canvas = canvas
    this.ctx = context
    this.input = new Input(platform)
    this.audio = new AudioSystem(platform)
    this.particles = new effects.ParticleSystem()
    this.grid = new effects.GridField()
    this.renderer = new Renderer(canvas, context, this.input, this.grid, this.particles)
    this.width = 0
    this.height = 0
    this.dpr = 1
    this.time = 0
    this.state = 'title'
    this.paused = false
    this.highScore = this.loadHighScore()
    this.score = 0
    this.elapsed = 0
    this.lives = 3
    this.multiplier = 1
    this.totalKills = 0
    this.streakKills = 0
    this.enemies = []
    this.bullets = []
    this.blackholes = []
    this.supplies = []
    this.allies = []
    this.popups = []
    this.shockwaves = []
    this.spawnTimer = 1
    this.supplyTimer = 12
    this.missileTimer = 0
    this.overloadTimer = 0
    this.random = Math.random
    this.lastPhase = -1
    this.message = ''
    this.messageTimer = 0
    this.gameOverTimer = 0
    this.flash = 0
    this.shake = 0
    this.ambientTimer = 0
    this.player = this.createPlayer(320, 180)
    this.bindLifecycle()
  }

  loadHighScore() {
    try {
      return Number(this.platform.getStorageSync('geometryFighterHighScore')) || 0
    } catch (error) {
      return 0
    }
  }

  saveHighScore() {
    try {
      this.platform.setStorageSync('geometryFighterHighScore', this.highScore)
    } catch (error) {
    }
  }

  bindLifecycle() {
    var self = this
    if (this.platform.onHide) {
      this.platform.onHide(function () {
        if (self.state === 'playing') self.paused = true
      })
    }
  }

  resize(width, height, dpr, safeArea) {
    this.width = width
    this.height = height
    this.dpr = math.clamp(dpr || 1, 1, 2.5)
    this.canvas.width = Math.round(width * this.dpr)
    this.canvas.height = Math.round(height * this.dpr)
    this.input.resize(width, height)
    this.renderer.resize(width, height, safeArea)
    if (!this.player || this.state === 'title') this.player = this.createPlayer(width * 0.5, height * 0.5)
    this.keepInside(this.player)
  }

  createPlayer(x, y) {
    return {
      x: x,
      y: y,
      vx: 0,
      vy: 0,
      radius: 10,
      angle: 0,
      fireTimer: 0,
      invulnerable: 0,
      deadTimer: 0,
      trail: [],
      trailTimer: 0
    }
  }

  startRound() {
    this.state = 'playing'
    this.paused = false
    this.score = 0
    this.elapsed = 0
    this.lives = 3
    this.multiplier = 1
    this.totalKills = 0
    this.streakKills = 0
    this.enemies.length = 0
    this.bullets.length = 0
    this.blackholes.length = 0
    this.supplies.length = 0
    this.allies.length = 0
    this.popups.length = 0
    this.shockwaves.length = 0
    this.particles.clear()
    this.grid.impulses.length = 0
    this.spawnTimer = 0.8
    this.supplyTimer = 12 + this.random() * 6
    this.missileTimer = 0
    this.overloadTimer = 0
    this.lastPhase = -1
    this.message = 'GRID LEVEL 1'
    this.messageTimer = 1.8
    this.gameOverTimer = 0
    this.flash = 0.28
    this.shake = 0
    this.player = this.createPlayer(this.width * 0.5, this.height * 0.5)
    this.player.invulnerable = 1.8
    this.grid.pulse(this.player.x, this.player.y, 18, config.COLORS.cyan)
    this.shockwave(this.player.x, this.player.y, config.COLORS.cyan, 0.8, 170)
  }

  frame(dt) {
    var delta = math.clamp(dt, 0, 0.034)
    this.time += delta
    this.input.updateKeyboard()
    var actions = this.input.consumeActions()
    if (actions.firstGesture) this.audio.unlock()

    if (this.state === 'title') {
      if (actions.start) this.startRound()
      else this.updateAmbient(delta)
    } else if (this.state === 'gameover') {
      this.gameOverTimer += delta
      this.updateEffects(delta)
      if (actions.start && this.gameOverTimer > 0.7) this.startRound()
    } else {
      if (actions.pause) this.paused = !this.paused
      if (this.paused) {
        if (actions.start) this.paused = false
      } else {
        this.updatePlaying(delta)
      }
    }

    this.flash = Math.max(0, this.flash - delta * 1.7)
    this.shake = Math.max(0, this.shake - delta * 18)
    this.audio.update(this.time, this.state === 'playing' && !this.paused)
    this.renderer.render(this)
  }

  updateAmbient(dt) {
    this.grid.update(dt)
    this.particles.update(dt, [])
    this.ambientTimer -= dt
    if (this.ambientTimer <= 0) {
      this.ambientTimer = 0.16
      var side = Math.floor(Math.random() * 4)
      var x = side % 2 ? this.width - config.WORLD.margin : config.WORLD.margin
      var y = side < 2 ? math.randomRange(30, this.height - 30) : (side === 2 ? config.WORLD.margin : this.height - config.WORLD.margin)
      if (side >= 2) x = math.randomRange(30, this.width - 30)
      this.particles.add(x, y, math.randomRange(-60, 60), math.randomRange(-60, 60), math.pick([config.COLORS.cyan, config.COLORS.magenta, config.COLORS.green]), math.randomRange(0.5, 1.2), 1.2, 0.985)
    }
  }

  updatePlaying(dt) {
    this.elapsed += dt
    this.messageTimer = Math.max(0, this.messageTimer - dt)
    this.updateSpecialTimers(dt)
    this.updatePlayer(dt)
    this.updateSpawner(dt)
    this.updateSupplies(dt)
    this.updateEnemies(dt)
    this.updateAllies(dt)
    this.updateBullets(dt)
    this.resolveCollisions()
    this.compactEntities()
    this.refreshBlackholes()
    this.updateEffects(dt)
  }

  updateSpecialTimers(dt) {
    this.missileTimer = Math.max(0, this.missileTimer - dt)
    this.overloadTimer = Math.max(0, this.overloadTimer - dt)
  }

  updatePlayer(dt) {
    var player = this.player
    if (player.deadTimer > 0) {
      player.deadTimer -= dt
      if (player.deadTimer <= 0) {
        if (this.lives <= 0) {
          this.finishRound()
          return
        }
        player.x = this.width * 0.5
        player.y = this.height * 0.5
        player.vx = 0
        player.vy = 0
        player.invulnerable = 2.4
        player.trail.length = 0
        this.clearSpawnArea(player.x, player.y, 110)
        this.grid.pulse(player.x, player.y, 14, config.COLORS.cyan)
      }
      return
    }

    player.invulnerable = Math.max(0, player.invulnerable - dt)
    var acceleration = 980
    player.vx += this.input.move.x * acceleration * dt
    player.vy += this.input.move.y * acceleration * dt
    var damping = Math.pow(0.88, dt * 60)
    if (Math.abs(this.input.move.x) < 0.05) player.vx *= damping
    if (Math.abs(this.input.move.y) < 0.05) player.vy *= damping
    var velocity = math.normalize(player.vx, player.vy)
    if (velocity.length > config.WORLD.playerSpeed) {
      player.vx = velocity.x * config.WORLD.playerSpeed
      player.vy = velocity.y * config.WORLD.playerSpeed
    }

    for (var h = 0; h < this.blackholes.length; h += 1) {
      var hole = this.blackholes[h]
      var hx = hole.x - player.x
      var hy = hole.y - player.y
      var holeDistance = Math.max(20, math.length(hx, hy))
      if (holeDistance < 225) {
        var pull = (1 - holeDistance / 225) * (430 + hole.mass * 24)
        player.vx += hx / holeDistance * pull * dt
        player.vy += hy / holeDistance * pull * dt
      }
    }

    player.x += player.vx * dt
    player.y += player.vy * dt
    this.keepInside(player)
    player.fireTimer -= dt

    var aimX = this.input.aim.x
    var aimY = this.input.aim.y
    var aimStrength = math.length(aimX, aimY)
    if (this.input.singleHanded) {
      aimX = this.input.move.x
      aimY = this.input.move.y
      aimStrength = math.length(aimX, aimY)
    }
    if (aimStrength > 0.22) {
      player.angle = Math.atan2(aimY, aimX)
      if (player.fireTimer <= 0) {
        this.fireWeapon()
        player.fireTimer = this.overloadTimer > 0 ? config.WORLD.overloadFireRate : config.WORLD.fireRate
      }
    } else if (velocity.length > 20) {
      player.angle += math.angleDelta(player.angle, Math.atan2(player.vy, player.vx)) * math.clamp(dt * 4, 0, 1)
    }

    player.trailTimer -= dt
    if (player.trailTimer <= 0 && velocity.length > 28) {
      player.trailTimer = 0.026
      player.trail.push({ x: player.x - Math.cos(player.angle) * 8, y: player.y - Math.sin(player.angle) * 8 })
      if (player.trail.length > 16) player.trail.shift()
      this.particles.trail(player.x - Math.cos(player.angle) * 10, player.y - Math.sin(player.angle) * 10, player.vx, player.vy, config.COLORS.orange)
    } else if (velocity.length <= 28 && player.trail.length) {
      player.trail.shift()
    }
  }

  nearestTarget() {
    return this.nearestTargetFrom(this.player.x, this.player.y)
  }

  nearestTargetFrom(x, y) {
    var nearest = null
    var nearestDistance = Infinity
    for (var i = 0; i < this.enemies.length; i += 1) {
      var enemy = this.enemies[i]
      if (enemy.dead || enemy.spawn > 0) continue
      var dx = enemy.x - x
      var dy = enemy.y - y
      var distance = dx * dx + dy * dy
      if (distance < nearestDistance) {
        nearest = enemy
        nearestDistance = distance
      }
    }
    return nearest
  }

  fireWeapon() {
    var tier = math.weaponTierForScore(this.score)
    var angle = this.player.angle
    if (this.overloadTimer > 0) {
      for (var spread = -4; spread <= 4; spread += 1) this.spawnBullet(angle + spread * 0.07, spread * 1.4)
    } else if (tier === 1) {
      this.spawnBullet(angle, 0)
    } else if (tier === 2) {
      this.spawnBullet(angle, -4.5)
      this.spawnBullet(angle, 4.5)
    } else if (tier === 3) {
      this.spawnBullet(angle - 0.105, 0)
      this.spawnBullet(angle, 0)
      this.spawnBullet(angle + 0.105, 0)
    } else {
      this.spawnBullet(angle - 0.15, -3)
      this.spawnBullet(angle - 0.045, -3)
      this.spawnBullet(angle + 0.045, 3)
      this.spawnBullet(angle + 0.15, 3)
    }
    this.audio.shot()
  }

  spawnBullet(angle, sideOffset) {
    if (this.bullets.length >= config.WORLD.maxBullets) return
    var missile = this.missileTimer > 0
    var sideX = Math.cos(angle + Math.PI * 0.5) * sideOffset
    var sideY = Math.sin(angle + Math.PI * 0.5) * sideOffset
    var x = this.player.x + Math.cos(angle) * 14 + sideX
    var y = this.player.y + Math.sin(angle) * 14 + sideY
    this.bullets.push({
      x: x,
      y: y,
      oldX: x,
      oldY: y,
      vx: Math.cos(angle) * (missile ? config.WORLD.missileSpeed : config.WORLD.bulletSpeed),
      vy: Math.sin(angle) * (missile ? config.WORLD.missileSpeed : config.WORLD.bulletSpeed),
      radius: missile ? 4.2 : 2.8,
      life: missile ? 2.2 : 1.25,
      width: missile ? 3.2 : 2.2,
      color: missile ? config.COLORS.orange : config.COLORS.yellow,
      kind: missile ? 'missile' : 'bullet',
      source: 'player',
      dead: false
    })
  }

  spawnAllyBullet(ally, angle) {
    if (this.bullets.length >= config.WORLD.maxBullets) return
    var x = ally.x + Math.cos(angle) * 11
    var y = ally.y + Math.sin(angle) * 11
    this.bullets.push({
      x: x,
      y: y,
      oldX: x,
      oldY: y,
      vx: Math.cos(angle) * 620,
      vy: Math.sin(angle) * 620,
      radius: 2.4,
      life: 1.15,
      width: 1.9,
      color: config.COLORS.cyan,
      kind: 'bullet',
      source: 'ally',
      dead: false
    })
  }

  updateSpawner(dt) {
    this.supplyTimer -= dt
    var hasSupply = this.supplies.some(function (supply) { return !supply.dead })
    if (this.supplyTimer <= 0 && !hasSupply) {
      this.spawnSupply()
      this.supplyTimer = config.WORLD.supplyIntervalMin + this.random() * (config.WORLD.supplyIntervalMax - config.WORLD.supplyIntervalMin)
    }
    var difficulty = math.difficultyAt(this.elapsed)
    if (difficulty.phase !== this.lastPhase) {
      this.lastPhase = difficulty.phase
      if (difficulty.phase > 0) {
        this.message = 'GRID LEVEL ' + (difficulty.phase + 1)
        this.messageTimer = 1.5
        this.grid.pulse(this.width * 0.5, this.height * 0.5, 12 + difficulty.phase, config.COLORS.violet)
      }
    }
    this.spawnTimer -= dt
    if (this.spawnTimer > 0 || this.enemies.length >= difficulty.cap) return
    this.spawnTimer = difficulty.spawnInterval * math.randomRange(0.76, 1.18)
    var count = Math.min(difficulty.batch, difficulty.cap - this.enemies.length)
    var type = this.chooseEnemyType(this.elapsed)
    for (var i = 0; i < count; i += 1) {
      this.spawnEnemy(type)
      if (Math.random() < 0.28) type = this.chooseEnemyType(this.elapsed)
    }
  }

  spawnSupply(forcedX, forcedY, forcedEffect) {
    var margin = 68
    var x = forcedX === undefined ? margin + this.random() * Math.max(1, this.width - margin * 2) : forcedX
    var y = forcedY === undefined ? 105 + this.random() * Math.max(1, this.height - 210) : forcedY
    var effects = ['detonation', 'overload', 'allies']
    var effect = forcedEffect || effects[Math.min(effects.length - 1, Math.floor(this.random() * effects.length))]
    var supply = {
      x: x,
      y: y,
      radius: 20,
      hp: config.WORLD.supplyHits,
      maxHp: config.WORLD.supplyHits,
      effect: effect,
      spawn: 0.6,
      age: 0,
      life: 18,
      dead: false
    }
    this.supplies.push(supply)
    this.grid.pulse(x, y, 12, config.COLORS.hud)
    this.shockwave(x, y, config.COLORS.hud, 0.55, 90)
    this.message = 'SUPER SUPPLY INBOUND'
    this.messageTimer = 1.25
    return supply
  }

  updateSupplies(dt) {
    for (var i = 0; i < this.supplies.length; i += 1) {
      var supply = this.supplies[i]
      if (supply.dead) continue
      supply.age += dt
      supply.spawn = Math.max(0, supply.spawn - dt)
      supply.life -= dt
      if (supply.life <= 0) supply.dead = true
    }
  }

  collectSupply(supply) {
    if (supply.dead) return
    supply.dead = true
    this.particles.burst(supply.x, supply.y, config.COLORS.hud, 68, 280, { minLife: 0.35, maxLife: 0.95, minWidth: 1, maxWidth: 3 })
    this.grid.pulse(supply.x, supply.y, 26, config.COLORS.hud)
    this.shockwave(supply.x, supply.y, config.COLORS.hud, 0.8, 220)
    this.activateSuperWeapon(supply.effect)
  }

  activateSuperWeapon(effect) {
    if (effect === 'detonation') {
      var delay = 0.1
      for (var i = 0; i < this.enemies.length; i += 1) {
        var enemy = this.enemies[i]
        if (enemy.dead) continue
        if (enemy.type === 'splitter') enemy.fragmentsOnDeath = false
        enemy.selfDestruct = delay
        delay += 0.065
      }
      this.message = 'CHAIN DETONATION'
      this.messageTimer = 1.5
      this.audio.superDetonation()
    } else if (effect === 'overload') {
      this.overloadTimer = config.WORLD.overloadDuration
      this.message = 'WEAPON OVERDRIVE 8S'
      this.messageTimer = 1.5
      this.audio.life()
    } else if (effect === 'allies') {
      this.spawnAllies(3 + Math.floor(this.random() * 3))
      this.message = 'ALLY WING DEPLOYED'
      this.messageTimer = 1.5
      this.audio.life()
    }
  }

  spawnAllies(count) {
    this.allies.length = 0
    var amount = Math.min(config.WORLD.maxAllies, count)
    for (var i = 0; i < amount; i += 1) {
      var phase = i / amount * Math.PI * 2
      this.allies.push({
        x: this.player.x + Math.cos(phase) * 46,
        y: this.player.y + Math.sin(phase) * 46,
        angle: phase,
        phase: phase,
        life: config.WORLD.allyDuration,
        fireTimer: i * 0.07
      })
    }
  }

  updateAllies(dt) {
    for (var i = 0; i < this.allies.length; i += 1) {
      var ally = this.allies[i]
      ally.life -= dt
      if (ally.life <= 0) continue
      ally.phase += dt * (0.72 + i * 0.035)
      var orbit = 48 + i * 13
      var targetX = this.player.x + Math.cos(ally.phase) * orbit
      var targetY = this.player.y + Math.sin(ally.phase) * orbit
      ally.x = math.lerp(ally.x, targetX, math.clamp(dt * 5, 0, 1))
      ally.y = math.lerp(ally.y, targetY, math.clamp(dt * 5, 0, 1))
      ally.fireTimer -= dt
      var target = this.nearestTargetFrom(ally.x, ally.y)
      if (target) ally.angle = Math.atan2(target.y - ally.y, target.x - ally.x)
      if (target && ally.fireTimer <= 0) {
        this.spawnAllyBullet(ally, ally.angle)
        ally.fireTimer = 0.24 + i * 0.018
      }
    }
  }

  chooseEnemyType(seconds) {
    var choices = ['wanderer', 'wanderer', 'grunt', 'grunt']
    if (seconds > 12) choices.push('dart', 'dart')
    if (seconds > 16) choices.push('weaver', 'weaver')
    if (seconds > 26) choices.push('orbiter')
    if (seconds > 32) choices.push('spinner')
    if (seconds > 44) choices.push('splitter')
    if (seconds > 48) choices.push('snake')
    if (seconds > 62) choices.push('crusher')
    if (seconds > 68) choices.push('repulsar')
    if (seconds > 82 && this.blackholes.length < 3) choices.push('blackhole')
    return math.pick(choices)
  }

  spawnEnemy(type, forcedX, forcedY) {
    if (!config.ENEMY[type]) return null
    var definition = config.ENEMY[type]
    var margin = config.WORLD.margin + definition.radius + 4
    var point = this.spawnPoint(margin)
    var x = forcedX === undefined ? point.x : forcedX
    var y = forcedY === undefined ? point.y : forcedY
    var angle = Math.random() * Math.PI * 2
    var enemy = {
      type: type,
      x: x,
      y: y,
      vx: Math.cos(angle) * definition.speed * 0.45,
      vy: Math.sin(angle) * definition.speed * 0.45,
      angle: angle,
      radius: definition.radius,
      speed: definition.speed,
      hp: definition.hp,
      maxHp: definition.hp,
      score: definition.score,
      color: definition.color,
      spawn: 0.55,
      age: Math.random() * 4,
      phase: Math.random() * Math.PI * 2,
      mass: type === 'blackhole' ? 1 : 0,
      missileChargeUsed: false,
      fragmentsOnDeath: type === 'splitter',
      selfDestruct: 0,
      dead: false,
      segments: []
    }
    if (type === 'snake') {
      for (var i = 0; i < 9; i += 1) {
        enemy.segments.push({
          x: x - Math.cos(angle) * i * 11,
          y: y - Math.sin(angle) * i * 11,
          angle: angle
        })
      }
    }
    this.enemies.push(enemy)
    if (type === 'blackhole') this.blackholes.push(enemy)
    this.grid.pulse(x, y, 5, enemy.color)
    return enemy
  }

  spawnPoint(margin) {
    var point = { x: margin, y: margin }
    for (var attempt = 0; attempt < 8; attempt += 1) {
      var edge = math.randomInt(0, 3)
      if (edge === 0) {
        point.x = math.randomRange(margin, this.width - margin)
        point.y = margin
      } else if (edge === 1) {
        point.x = this.width - margin
        point.y = math.randomRange(margin, this.height - margin)
      } else if (edge === 2) {
        point.x = math.randomRange(margin, this.width - margin)
        point.y = this.height - margin
      } else {
        point.x = margin
        point.y = math.randomRange(margin, this.height - margin)
      }
      if (math.length(point.x - this.player.x, point.y - this.player.y) > 145) break
    }
    return point
  }

  updateEnemies(dt) {
    var difficulty = math.difficultyAt(this.elapsed)
    for (var i = 0; i < this.enemies.length; i += 1) {
      var enemy = this.enemies[i]
      if (enemy.dead) continue
      if (enemy.selfDestruct > 0) {
        enemy.selfDestruct -= dt
        if (enemy.selfDestruct <= 0) {
          this.destroyEnemy(enemy, true)
          continue
        }
      }
      enemy.age += dt
      if (enemy.spawn > 0) {
        enemy.spawn -= dt
        enemy.angle += dt * 3
        continue
      }
      var dx = this.player.x - enemy.x
      var dy = this.player.y - enemy.y
      var target = math.normalize(dx, dy)
      var speed = enemy.speed * difficulty.speedScale

      if (enemy.type === 'wanderer') {
        var wanderAngle = Math.atan2(enemy.vy, enemy.vx) + Math.sin(enemy.age * 1.7 + enemy.phase) * dt * 1.7
        enemy.vx += (Math.cos(wanderAngle) * speed - enemy.vx) * dt * 0.8
        enemy.vy += (Math.sin(wanderAngle) * speed - enemy.vy) * dt * 0.8
        enemy.angle = Math.atan2(enemy.vy, enemy.vx)
      } else if (enemy.type === 'grunt') {
        this.steer(enemy, target.x * speed, target.y * speed, dt * 2.4)
        enemy.angle = Math.atan2(enemy.vy, enemy.vx) + Math.PI / 4
      } else if (enemy.type === 'weaver') {
        var lateral = Math.sin(enemy.age * 4.2 + enemy.phase) * speed * 0.82
        this.steer(enemy, target.x * speed - target.y * lateral, target.y * speed + target.x * lateral, dt * 3)
        enemy.angle += dt * 1.8
      } else if (enemy.type === 'spinner') {
        var orbit = Math.sin(enemy.age * 1.4 + enemy.phase) * speed * 0.72
        this.steer(enemy, target.x * speed - target.y * orbit, target.y * speed + target.x * orbit, dt * 1.45)
        enemy.angle += dt * 5.5
      } else if (enemy.type === 'snake') {
        var curve = Math.sin(enemy.age * 2.3 + enemy.phase) * 0.86
        this.steer(enemy, target.x * speed - target.y * speed * curve, target.y * speed + target.x * speed * curve, dt * 1.7)
        enemy.angle = Math.atan2(enemy.vy, enemy.vx)
      } else if (enemy.type === 'repulsar') {
        var keep = target.length > 175 ? 1 : (target.length < 125 ? -1 : 0)
        var circle = Math.sin(enemy.age * 1.7) > 0 ? 0.72 : -0.72
        this.steer(enemy, target.x * speed * keep - target.y * speed * circle, target.y * speed * keep + target.x * speed * circle, dt * 1.8)
        enemy.angle += dt * 2.4
      } else if (enemy.type === 'blackhole') {
        enemy.angle += dt * 1.25
        enemy.mass = math.clamp(enemy.mass + dt * 0.06, 1, 10)
        enemy.vx *= Math.pow(0.985, dt * 60)
        enemy.vy *= Math.pow(0.985, dt * 60)
      } else if (enemy.type === 'dart') {
        var charging = enemy.age % 1.35 < 0.45
        var dartSpeed = speed * (charging ? 1.85 : 0.45)
        this.steer(enemy, target.x * dartSpeed, target.y * dartSpeed, dt * (charging ? 8 : 3))
        enemy.angle = Math.atan2(enemy.vy, enemy.vx)
      } else if (enemy.type === 'orbiter') {
        var radial = target.length > 190 ? 0.8 : (target.length < 135 ? -0.8 : 0)
        var orbitDirection = Math.sin(enemy.phase) >= 0 ? 1 : -1
        this.steer(enemy, (target.x * radial - target.y * orbitDirection) * speed, (target.y * radial + target.x * orbitDirection) * speed, dt * 3.4)
        enemy.angle += dt * orbitDirection * 2.8
      } else if (enemy.type === 'crusher') {
        this.steer(enemy, target.x * speed, target.y * speed, dt * 0.7)
        enemy.angle += dt * 0.55
      } else if (enemy.type === 'splitter') {
        var splitterWave = Math.sin(enemy.age * 2.6 + enemy.phase) * speed * 0.35
        this.steer(enemy, target.x * speed - target.y * splitterWave, target.y * speed + target.x * splitterWave, dt * 1.4)
        enemy.angle += dt * 1.6
      } else if (enemy.type === 'shard') {
        var shardCurve = Math.sin(enemy.age * 7 + enemy.phase) * speed * 0.32
        this.steer(enemy, target.x * speed - target.y * shardCurve, target.y * speed + target.x * shardCurve, dt * 5.5)
        enemy.angle = Math.atan2(enemy.vy, enemy.vx)
      }

      var previousX = enemy.x
      var previousY = enemy.y
      enemy.x += enemy.vx * dt
      enemy.y += enemy.vy * dt
      this.keepInside(enemy)
      if (enemy.type === 'snake') this.updateSnake(enemy, previousX, previousY)
    }
    this.resolveBlackholeAbsorption()
  }

  steer(enemy, targetVx, targetVy, amount) {
    var steering = math.clamp(amount, 0, 1)
    enemy.vx = math.lerp(enemy.vx, targetVx, steering)
    enemy.vy = math.lerp(enemy.vy, targetVy, steering)
  }

  updateSnake(enemy, previousX, previousY) {
    var anchorX = previousX
    var anchorY = previousY
    for (var i = 0; i < enemy.segments.length; i += 1) {
      var segment = enemy.segments[i]
      var dx = anchorX - segment.x
      var dy = anchorY - segment.y
      var direction = math.normalize(dx, dy)
      if (direction.length > 10.5) {
        segment.x = anchorX - direction.x * 10.5
        segment.y = anchorY - direction.y * 10.5
      }
      segment.angle = Math.atan2(dy, dx)
      anchorX = segment.x
      anchorY = segment.y
    }
  }

  resolveBlackholeAbsorption() {
    for (var h = 0; h < this.blackholes.length; h += 1) {
      var hole = this.blackholes[h]
      if (hole.dead || hole.spawn > 0) continue
      for (var i = 0; i < this.enemies.length; i += 1) {
        var enemy = this.enemies[i]
        if (enemy === hole || enemy.dead || enemy.spawn > 0) continue
        var dx = hole.x - enemy.x
        var dy = hole.y - enemy.y
        var distance = Math.max(12, math.length(dx, dy))
        if (distance < 150) {
          var pull = (1 - distance / 150) * 240
          enemy.vx += dx / distance * pull
          enemy.vy += dy / distance * pull
          if (distance < hole.radius + enemy.radius * 0.55) {
            enemy.dead = true
            hole.mass = math.clamp(hole.mass + 0.55, 1, 10)
            this.particles.burst(enemy.x, enemy.y, enemy.color, 7, 80, { maxLife: 0.5 })
          }
        }
      }
    }
  }

  updateBullets(dt) {
    var left = config.WORLD.margin
    var right = this.width - config.WORLD.margin
    var top = config.WORLD.margin
    var bottom = this.height - config.WORLD.margin
    for (var i = 0; i < this.bullets.length; i += 1) {
      var bullet = this.bullets[i]
      if (bullet.dead) continue
      bullet.life -= dt
      bullet.oldX = bullet.x
      bullet.oldY = bullet.y
      if (bullet.kind === 'missile') {
        var target = this.nearestTargetFrom(bullet.x, bullet.y)
        if (target) {
          var desiredAngle = Math.atan2(target.y - bullet.y, target.x - bullet.x)
          var currentAngle = Math.atan2(bullet.vy, bullet.vx)
          var turn = math.angleDelta(currentAngle, desiredAngle) * math.clamp(config.WORLD.missileTurnRate * dt, 0, 1)
          var missileAngle = currentAngle + turn
          bullet.vx = Math.cos(missileAngle) * config.WORLD.missileSpeed
          bullet.vy = Math.sin(missileAngle) * config.WORLD.missileSpeed
        }
      }
      for (var h = 0; h < this.blackholes.length; h += 1) {
        var hole = this.blackholes[h]
        var hx = hole.x - bullet.x
        var hy = hole.y - bullet.y
        var holeDistance = Math.max(12, math.length(hx, hy))
        if (holeDistance < 210) {
          var pull = (1 - holeDistance / 210) * (1050 + hole.mass * 55)
          bullet.vx += hx / holeDistance * pull * dt
          bullet.vy += hy / holeDistance * pull * dt
        }
      }
      for (var r = 0; r < this.enemies.length; r += 1) {
        var repulsar = this.enemies[r]
        if (repulsar.type !== 'repulsar' || repulsar.dead || repulsar.spawn > 0) continue
        var rx = bullet.x - repulsar.x
        var ry = bullet.y - repulsar.y
        var repulseDistance = Math.max(8, math.length(rx, ry))
        if (repulseDistance < 82) {
          var force = (1 - repulseDistance / 82) * 1850
          bullet.vx += rx / repulseDistance * force * dt
          bullet.vy += ry / repulseDistance * force * dt
        }
      }
      bullet.x += bullet.vx * dt
      bullet.y += bullet.vy * dt
      if (bullet.life <= 0 || bullet.x < left || bullet.x > right || bullet.y < top || bullet.y > bottom) {
        bullet.dead = true
        if (bullet.life > 0) {
          var impactX = math.clamp(bullet.x, left, right)
          var impactY = math.clamp(bullet.y, top, bottom)
          this.grid.pulse(impactX, impactY, 2.5, config.COLORS.yellow)
          this.particles.burst(impactX, impactY, config.COLORS.yellow, 3, 70, { maxLife: 0.25, maxWidth: 1.4 })
        }
      }
    }
  }

  resolveCollisions() {
    for (var b = 0; b < this.bullets.length; b += 1) {
      var bullet = this.bullets[b]
      if (bullet.dead) continue
      for (var s = 0; s < this.supplies.length; s += 1) {
        var supply = this.supplies[s]
        if (supply.dead || supply.spawn > 0) continue
        var supplyX = bullet.x - supply.x
        var supplyY = bullet.y - supply.y
        if (supplyX * supplyX + supplyY * supplyY > (supply.radius + bullet.radius) * (supply.radius + bullet.radius)) continue
        bullet.dead = true
        supply.hp -= 1
        this.particles.burst(bullet.x, bullet.y, config.COLORS.hud, 7, 105, { maxLife: 0.38, maxWidth: 1.8 })
        this.grid.pulse(supply.x, supply.y, 3 + (supply.maxHp - supply.hp) * 0.6, config.COLORS.hud)
        if (supply.hp <= 0) this.collectSupply(supply)
        else this.audio.hit()
        break
      }
      if (bullet.dead) continue
      for (var e = 0; e < this.enemies.length; e += 1) {
        var enemy = this.enemies[e]
        if (enemy.dead || enemy.spawn > 0) continue
        var hitRadius = enemy.radius + (enemy.type === 'blackhole' ? enemy.mass * 0.5 : 0)
        var dx = bullet.x - enemy.x
        var dy = bullet.y - enemy.y
        if (dx * dx + dy * dy <= (hitRadius + bullet.radius) * (hitRadius + bullet.radius)) {
          bullet.dead = true
          enemy.hp -= 1
          if (enemy.type === 'spinner' && !enemy.missileChargeUsed) {
            enemy.missileChargeUsed = true
            this.missileTimer = config.WORLD.missileDuration
            this.message = 'MISSILE LOCK 5S'
            this.messageTimer = 1.25
            this.audio.life()
          }
          if (enemy.type === 'blackhole') enemy.mass = math.clamp(enemy.mass + 0.16, 1, 10)
          this.particles.burst(bullet.x, bullet.y, enemy.color, 5, 95, { maxLife: 0.35, maxWidth: 1.6 })
          if (enemy.hp <= 0) this.destroyEnemy(enemy, true)
          else this.audio.hit()
          break
        }
      }
    }

    var player = this.player
    if (player.deadTimer > 0 || player.invulnerable > 0) return
    for (var i = 0; i < this.enemies.length; i += 1) {
      var target = this.enemies[i]
      if (target.dead || target.spawn > 0) continue
      var collisionRadius = target.radius + (target.type === 'blackhole' ? target.mass * 0.7 : 0)
      var px = player.x - target.x
      var py = player.y - target.y
      if (px * px + py * py <= (player.radius + collisionRadius) * (player.radius + collisionRadius)) {
        this.loseLife()
        break
      }
    }
  }

  destroyEnemy(enemy, awardScore) {
    if (enemy.dead) return
    enemy.dead = true
    if (enemy.fragmentsOnDeath) this.spawnSplitterShards(enemy)
    var isLarge = enemy.type === 'blackhole'
    var count = isLarge ? 100 : (enemy.type === 'snake' || enemy.type === 'repulsar' ? 42 : 22)
    var speed = isLarge ? 360 : 210
    this.particles.burst(enemy.x, enemy.y, enemy.color, count, speed, {
      minLife: isLarge ? 0.45 : 0.24,
      maxLife: isLarge ? 1.3 : 0.78,
      minWidth: 0.8,
      maxWidth: isLarge ? 3.4 : 2.4,
      radius: enemy.radius
    })
    this.grid.pulse(enemy.x, enemy.y, isLarge ? 34 : 9, enemy.color)
    this.shockwave(enemy.x, enemy.y, enemy.color, isLarge ? 0.9 : 0.38, isLarge ? 220 : 62)
    this.shake = Math.max(this.shake, isLarge ? 12 : 2.6)
    this.audio.explode(isLarge ? 2 : 1)
    if (awardScore) this.awardKill(enemy)
  }

  spawnSplitterShards(enemy) {
    for (var i = 0; i < 3; i += 1) {
      var angle = enemy.angle + i / 3 * Math.PI * 2
      var shard = this.spawnEnemy('shard', enemy.x + Math.cos(angle) * 10, enemy.y + Math.sin(angle) * 10)
      shard.spawn = 0.12
      shard.phase = angle
      shard.vx = Math.cos(angle) * shard.speed
      shard.vy = Math.sin(angle) * shard.speed
    }
  }

  awardKill(enemy) {
    var previousScore = this.score
    var previousMultiplier = this.multiplier
    var previousTier = math.weaponTierForScore(previousScore)
    var points = math.scoreFor(enemy.score, this.multiplier)
    this.score += points
    this.totalKills += 1
    this.streakKills += 1
    this.multiplier = math.clamp(1 + Math.floor(this.streakKills / 15), 1, 10)
    this.popups.push({
      x: enemy.x,
      y: enemy.y,
      text: String(points),
      color: config.COLORS.hud,
      life: 0.72
    })

    var extraLives = math.crossedThreshold(previousScore, this.score, 75000, 75000)
    var extraSupplies = math.crossedThreshold(previousScore, this.score, 100000, 100000)
    if (extraLives > 0) {
      this.lives += extraLives
      this.message = 'EXTRA LIFE'
      this.messageTimer = 1.6
      this.audio.life()
    }
    if (extraSupplies > 0) {
      for (var supply = 0; supply < extraSupplies; supply += 1) this.spawnSupply()
      this.supplyTimer = config.WORLD.supplyIntervalMin + this.random() * (config.WORLD.supplyIntervalMax - config.WORLD.supplyIntervalMin)
    }
    var tier = math.weaponTierForScore(this.score)
    if (tier > previousTier) {
      this.message = 'WEAPON UPGRADE ' + tier
      this.messageTimer = 1.7
      this.audio.life()
    } else if (this.multiplier > previousMultiplier) {
      this.message = 'MULTIPLIER ×' + this.multiplier
      this.messageTimer = 1.15
    }
    if (this.score > this.highScore) this.highScore = this.score
  }

  loseLife() {
    var player = this.player
    if (player.deadTimer > 0 || player.invulnerable > 0) return
    this.lives -= 1
    this.multiplier = 1
    this.streakKills = 0
    player.deadTimer = 1.05
    player.vx = 0
    player.vy = 0
    this.flash = 0.58
    this.shake = 14
    this.particles.burst(player.x, player.y, config.COLORS.white, 115, 380, { minLife: 0.4, maxLife: 1.25, minWidth: 1, maxWidth: 3.2 })
    this.particles.burst(player.x, player.y, config.COLORS.orange, 55, 260, { minLife: 0.3, maxLife: 0.9 })
    this.grid.pulse(player.x, player.y, 38, config.COLORS.white)
    this.shockwave(player.x, player.y, config.COLORS.white, 0.9, 250)
    this.audio.explode(2)
    if (this.lives > 0) {
      this.message = 'MULTIPLIER LOST'
      this.messageTimer = 1.2
    }
  }

  clearSpawnArea(x, y, radius) {
    for (var i = 0; i < this.enemies.length; i += 1) {
      var enemy = this.enemies[i]
      if (math.length(enemy.x - x, enemy.y - y) < radius) this.destroyEnemy(enemy, false)
    }
  }

  updateEffects(dt) {
    this.grid.update(dt)
    this.particles.update(dt, this.blackholes)
    var popupWrite = 0
    for (var i = 0; i < this.popups.length; i += 1) {
      var popup = this.popups[i]
      popup.life -= dt
      popup.y -= 24 * dt
      if (popup.life > 0) {
        this.popups[popupWrite] = popup
        popupWrite += 1
      }
    }
    this.popups.length = popupWrite
    var waveWrite = 0
    for (var j = 0; j < this.shockwaves.length; j += 1) {
      var wave = this.shockwaves[j]
      wave.life -= dt / wave.duration
      wave.radius += wave.speed * dt
      if (wave.life > 0) {
        this.shockwaves[waveWrite] = wave
        waveWrite += 1
      }
    }
    this.shockwaves.length = waveWrite
  }

  compactEntities() {
    var write = 0
    for (var i = 0; i < this.enemies.length; i += 1) {
      var enemy = this.enemies[i]
      if (!enemy.dead) {
        this.enemies[write] = enemy
        write += 1
      }
    }
    this.enemies.length = write

    write = 0
    for (var b = 0; b < this.bullets.length; b += 1) {
      var bullet = this.bullets[b]
      if (!bullet.dead) {
        this.bullets[write] = bullet
        write += 1
      }
    }
    this.bullets.length = write

    write = 0
    for (var s = 0; s < this.supplies.length; s += 1) {
      var supply = this.supplies[s]
      if (!supply.dead) {
        this.supplies[write] = supply
        write += 1
      }
    }
    this.supplies.length = write

    write = 0
    for (var a = 0; a < this.allies.length; a += 1) {
      var ally = this.allies[a]
      if (ally.life > 0) {
        this.allies[write] = ally
        write += 1
      }
    }
    this.allies.length = write
  }

  refreshBlackholes() {
    var write = 0
    for (var i = 0; i < this.enemies.length; i += 1) {
      var enemy = this.enemies[i]
      if (enemy.type === 'blackhole' && enemy.spawn <= 0) {
        this.blackholes[write] = enemy
        write += 1
      }
    }
    this.blackholes.length = write
  }

  shockwave(x, y, color, duration, speed) {
    this.shockwaves.push({
      x: x,
      y: y,
      color: color,
      life: 1,
      duration: duration,
      radius: 4,
      speed: speed
    })
  }

  keepInside(entity) {
    var margin = config.WORLD.margin + entity.radius + 2
    if (entity.x < margin) {
      entity.x = margin
      entity.vx = Math.abs(entity.vx || 0)
    } else if (entity.x > this.width - margin) {
      entity.x = this.width - margin
      entity.vx = -Math.abs(entity.vx || 0)
    }
    if (entity.y < margin) {
      entity.y = margin
      entity.vy = Math.abs(entity.vy || 0)
    } else if (entity.y > this.height - margin) {
      entity.y = this.height - margin
      entity.vy = -Math.abs(entity.vy || 0)
    }
  }

  finishRound() {
    this.state = 'gameover'
    this.gameOverTimer = 0
    this.saveHighScore()
    this.messageTimer = 0
    this.enemies.length = 0
    this.blackholes.length = 0
    this.bullets.length = 0
    this.supplies.length = 0
    this.allies.length = 0
  }

  debugSnapshot() {
    return {
      state: this.state,
      paused: this.paused,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      multiplier: this.multiplier,
      elapsed: Math.round(this.elapsed * 100) / 100,
      enemies: this.enemies.length,
      bullets: this.bullets.length,
      supplies: this.supplies.length,
      allies: this.allies.length,
      missileTime: Math.round(this.missileTimer * 10) / 10,
      overloadTime: Math.round(this.overloadTimer * 10) / 10,
      particles: this.particles.items.length,
      player: { x: Math.round(this.player.x), y: Math.round(this.player.y), invulnerable: this.player.invulnerable }
    }
  }

  debugStart() {
    this.startRound()
  }

  debugSpawn(type, count) {
    var amount = count || 1
    for (var i = 0; i < amount; i += 1) this.spawnEnemy(type || 'grunt')
  }

  debugLoseLife() {
    this.player.invulnerable = 0
    this.loseLife()
  }
}

module.exports = GeometryGame
