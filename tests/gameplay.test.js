const test = require('node:test')
const assert = require('node:assert/strict')
const GeometryGame = require('../js/game')

function fakePlatform() {
  return {
    onTouchStart: function () {},
    onTouchMove: function () {},
    onTouchEnd: function () {},
    onTouchCancel: function () {},
    onHide: function () {},
    getStorageSync: function () { return 0 },
    setStorageSync: function () {}
  }
}

test('a round supports shooting, scoring and life loss without a bomb inventory', function () {
  var game = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, {})
  game.resize(800, 450, 2)
  game.startRound()
  assert.equal(game.state, 'playing')
  assert.equal(game.lives, 3)
  assert.equal('bombs' in game, false)
  assert.equal('useBomb' in game, false)

  game.fireWeapon()
  assert.equal(game.bullets.length, 1)

  var enemy = game.spawnEnemy('grunt', game.player.x + 40, game.player.y)
  enemy.spawn = 0
  game.bullets[0].x = enemy.x
  game.bullets[0].y = enemy.y
  game.resolveCollisions()
  assert.equal(enemy.dead, true)
  assert.equal(game.score, 100)
  assert.equal(game.totalKills, 1)

  game.player.invulnerable = 0
  game.loseLife()
  assert.equal(game.lives, 2)
  assert.ok(game.player.deadTimer > 0)
  assert.equal(game.multiplier, 1)
})

test('the expanded geometric enemy roster can be instantiated for wave progression', function () {
  var game = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, {})
  game.resize(800, 450, 1)
  game.startRound()
  var types = ['wanderer', 'grunt', 'weaver', 'spinner', 'snake', 'repulsar', 'blackhole', 'dart', 'orbiter', 'crusher', 'splitter', 'shard']
  for (var i = 0; i < types.length; i += 1) game.spawnEnemy(types[i])
  assert.deepEqual(game.enemies.map(function (enemy) { return enemy.type }), types)
  assert.equal(game.enemies[4].segments.length, 9)
  assert.equal(game.blackholes.length, 1)
})

test('a score milestone launches a super supply instead of awarding a bomb', function () {
  var game = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, {})
  game.resize(800, 450, 1)
  game.startRound()
  game.score = 99900
  var enemy = game.spawnEnemy('grunt', 120, 100)

  game.awardKill(enemy)

  assert.equal(game.supplies.length, 1)
  assert.equal(game.supplies[0].maxHp, 8)
  assert.equal('bombs' in game, false)
})

test('new geometric enemies have distinct motion and splitters release three shards', function () {
  var game = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, {})
  game.resize(800, 450, 1)
  game.startRound()
  var dart = game.spawnEnemy('dart', 120, game.player.y)
  var orbiter = game.spawnEnemy('orbiter', 120, game.player.y)
  var crusher = game.spawnEnemy('crusher', 120, game.player.y)
  var splitter = game.spawnEnemy('splitter', 160, 100)
  dart.spawn = 0
  orbiter.spawn = 0
  crusher.spawn = 0
  splitter.spawn = 0
  dart.age = 0
  orbiter.age = 0

  game.updateEnemies(0.1)

  assert.ok(Math.hypot(dart.vx, dart.vy) > Math.hypot(crusher.vx, crusher.vy))
  assert.ok(Math.abs(orbiter.vy) > 0)
  assert.ok(crusher.maxHp >= 6)

  game.destroyEnemy(splitter, true)

  assert.equal(game.enemies.filter(function (enemy) { return enemy.type === 'shard' }).length, 3)
})

test('portrait fire ignores enemies behind the selected direction', function () {
  var game = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, {})
  game.resize(390, 844, 2)
  game.startRound()
  var enemy = game.spawnEnemy('grunt', game.player.x - 60, game.player.y)
  enemy.spawn = 0
  game.input.move.x = 1
  game.input.move.y = 0

  game.updatePlayer(0.11)

  assert.equal(game.bullets.length, 1)
  assert.ok(game.bullets[0].vx > 0)
  assert.ok(Math.abs(game.player.angle) < 0.001)
})

test('portrait center hold keeps firing along the last deliberate heading', function () {
  // Given an active one-thumb drag that established a rightward firing heading.
  var game = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, {})
  game.resize(390, 844, 2)
  game.startRound()
  game.input.left.active = true
  game.input.move.x = 1
  game.input.move.y = 0
  game.updatePlayer(0.11)
  var openingShots = game.bullets.length

  // When the thumb returns to the stick center without lifting.
  game.input.move.x = 0
  game.input.move.y = 0
  game.player.fireTimer = 0
  game.updatePlayer(0.01)

  // Then movement input is neutral but fire continues along the remembered direction.
  assert.equal(game.bullets.length, openingShots + 1)
  assert.ok(game.bullets[game.bullets.length - 1].vx > 0)
})

test('portrait sector corrects only the launch angle and never tracks in flight', function () {
  // Given a target inside the rightward directional sector.
  var game = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, {})
  game.resize(390, 844, 2)
  game.startRound()
  var target = game.spawnEnemy('grunt', game.player.x + 180, game.player.y + 50)
  target.spawn = 0
  game.input.left.active = true
  game.input.move.x = 1
  game.input.move.y = 0

  // When the volley launches and the target then moves elsewhere.
  game.updatePlayer(0.11)
  var bullet = game.bullets[0]
  var launchVelocity = { x: bullet.vx, y: bullet.vy }
  target.x = game.player.x - 180
  target.y = game.player.y
  game.updateBullets(0.1)

  // Then the launch was sector-assisted but its in-flight velocity remains ballistic.
  assert.ok(launchVelocity.y > 0)
  assert.equal(bullet.vx, launchVelocity.x)
  assert.equal(bullet.vy, launchVelocity.y)
})

test('hot-loop cleanup preserves entity array identities between frames', function () {
  var game = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, {})
  game.resize(390, 844, 2)
  game.startRound()
  var enemies = game.enemies
  var bullets = game.bullets
  var supplies = game.supplies
  var allies = game.allies

  game.updatePlaying(1 / 60)

  assert.equal(game.enemies, enemies)
  assert.equal(game.bullets, bullets)
  assert.equal(game.supplies, supplies)
  assert.equal(game.allies, allies)
})

test('hitting a spinner switches fire to smoothly homing missiles for five seconds', function () {
  var game = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, {})
  game.resize(800, 450, 1)
  game.startRound()
  var spinner = game.spawnEnemy('spinner', game.player.x + 40, game.player.y)
  spinner.spawn = 0
  spinner.hp = 1
  game.fireWeapon()
  game.bullets[0].x = spinner.x
  game.bullets[0].y = spinner.y

  game.resolveCollisions()

  assert.equal(game.missileTimer, 5)
  game.fireWeapon()
  var missile = game.bullets[game.bullets.length - 1]
  assert.equal(missile.kind, 'missile')
  var target = game.spawnEnemy('grunt', missile.x, missile.y + 160)
  target.spawn = 0
  missile.vx = 420
  missile.vy = 0
  game.updateBullets(0.1)
  assert.ok(missile.vy > 0)
  assert.ok(missile.vx > 0)

  game.updateSpecialTimers(5)

  assert.equal(game.missileTimer, 0)
})

test('a super supply is collected only after eight hits and activates its stored effect', function () {
  var game = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, {})
  game.resize(800, 450, 1)
  game.startRound()
  var supply = game.spawnSupply(game.player.x + 80, game.player.y, 'overload')
  supply.spawn = 0

  for (var hit = 0; hit < supply.maxHp - 1; hit += 1) {
    game.spawnBullet(0, 0)
    var bullet = game.bullets[game.bullets.length - 1]
    bullet.x = supply.x
    bullet.y = supply.y
    game.resolveCollisions()
  }

  assert.equal(supply.dead, false)
  assert.equal(supply.hp, 1)
  game.spawnBullet(0, 0)
  var finalBullet = game.bullets[game.bullets.length - 1]
  finalBullet.x = supply.x
  finalBullet.y = supply.y
  game.resolveCollisions()

  assert.equal(supply.dead, true)
  assert.equal(game.overloadTimer, 8)
})

test('super weapon effects cover chain detonation, barrage and allied auto fire', function () {
  var detonationGame = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, {})
  detonationGame.resize(800, 450, 1)
  detonationGame.startRound()
  detonationGame.spawnEnemy('grunt', 100, 100).spawn = 0
  detonationGame.spawnEnemy('weaver', 160, 100).spawn = 0
  detonationGame.activateSuperWeapon('detonation')
  detonationGame.updateEnemies(1.5)
  assert.ok(detonationGame.enemies.every(function (enemy) { return enemy.dead }))

  var barrageGame = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, {})
  barrageGame.resize(800, 450, 1)
  barrageGame.startRound()
  barrageGame.activateSuperWeapon('overload')
  barrageGame.fireWeapon()
  assert.ok(barrageGame.bullets.length >= 9)
  barrageGame.updateSpecialTimers(8)
  assert.equal(barrageGame.overloadTimer, 0)

  var allyGame = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, {})
  allyGame.resize(800, 450, 1)
  allyGame.startRound()
  var enemy = allyGame.spawnEnemy('grunt', allyGame.player.x + 180, allyGame.player.y)
  enemy.spawn = 0
  allyGame.random = function () { return 0 }
  allyGame.activateSuperWeapon('allies')
  allyGame.updateAllies(0.5)
  assert.equal(allyGame.allies.length, 3)
  assert.ok(allyGame.bullets.some(function (bullet) { return bullet.source === 'ally' }))
})

test('super supplies choose all three effects from the random range', function () {
  var game = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, {})
  game.resize(800, 450, 1)
  game.startRound()
  var values = [0, 0.34, 0.67]
  var effects = values.map(function (value) {
    game.random = function () { return value }
    return game.spawnSupply(120, 100).effect
  })

  assert.deepEqual(effects, ['detonation', 'overload', 'allies'])
})

test('assault waves pause spawning for recovery and return as a grouped edge breach', function () {
  var game = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, {})
  game.resize(390, 844, 2)
  game.startRound()
  game.supplyTimer = 99
  game.spawnTimer = 0
  game.elapsed = 15.5

  game.updateSpawner(0.2)
  assert.equal(game.enemies.length, 0)
  assert.equal(game.assault.active, false)

  game.elapsed = 18
  game.random = function () { return 0 }
  game.spawnTimer = 0
  game.updateSpawner(0.2)

  assert.equal(game.assault.label, 'FLANK')
  assert.ok(game.enemies.length >= 2)
  assert.ok(game.enemies.every(function (enemy) { return enemy.y < 70 }))
})
