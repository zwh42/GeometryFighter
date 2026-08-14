'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { GeometryWorld, normalizeInto } = require('../assets/scripts/simulation.ts')
const { COLORS } = require('../assets/scripts/design-tokens.ts')

test('normalizeInto reuses caller storage for hot-loop vectors', function () {
  // Given: caller-owned storage used repeatedly by the simulation hot path.
  const output = { x: 99, y: -99 }

  // When: a vector is normalized into that storage.
  const result = normalizeInto(3, 4, output)

  // Then: no replacement object is created and the normalized value is correct.
  assert.strictEqual(result, output)
  assert.deepEqual(output, { x: 0.6, y: 0.8 })
})

test('smart bomb bounds presentation events when destroying a crowded wave', function () {
  // Given: a full 90-enemy wave and one available smart bomb.
  const world = new GeometryWorld()
  world.reset()
  world.events.length = 0
  world.bombs = 1
  for (let index = 0; index < 90; index += 1) {
    const enemy = world.spawnEnemy('grunt', index * 3 - 135, 220)
    enemy.spawnTimer = 0
  }

  // When: the smart bomb destroys the wave in one update.
  world.useBomb()

  // Then: gameplay still kills every target, but presentation work stays bounded.
  assert.equal(world.enemies.filter(function (enemy) { return enemy.dead }).length, 90)
  assert.equal(world.events.filter(function (event) { return event.kind === 'kill' }).length, 6)
  assert.equal(world.events.filter(function (event) { return event.kind === 'bomb' }).length, 1)
})

test('cleanup compacts entity arrays without replacing their backing storage', function () {
  // Given: live and expired entities in arrays observed by the renderer.
  const world = new GeometryWorld()
  world.reset()
  world.bullets.push({ x: 0, y: 0, vx: 0, vy: 0, angle: 0, life: 1, radius: 3 })
  world.bullets.push({ x: 0, y: 0, vx: 0, vy: 0, angle: 0, life: 0, radius: 3 })
  const liveEnemy = world.spawnEnemy('grunt', 100, 100)
  const deadEnemy = world.spawnEnemy('grunt', 120, 100)
  deadEnemy.dead = true
  const bullets = world.bullets
  const enemies = world.enemies

  // When: expired objects are removed.
  world.cleanup()

  // Then: the arrays are reused and only live objects remain.
  assert.strictEqual(world.bullets, bullets)
  assert.strictEqual(world.enemies, enemies)
  assert.deepEqual(world.bullets, [bullets[0]])
  assert.deepEqual(world.enemies, [liveEnemy])
})

test('spawnWave admits a 100th live enemy without exceeding the measured budget', function () {
  // Given: a maximum-difficulty world with 99 live enemies.
  const world = new GeometryWorld()
  world.reset()
  world.elapsed = 1000
  world.events.length = 0
  for (let index = 0; index < 99; index += 1) world.spawnEnemy('grunt', -300 + index * 5, 240)

  // When: the next wave batch is requested.
  world.spawnWave()

  // Then: the higher density limit admits exactly one more enemy.
  assert.equal(world.enemies.length, 100)
})

test('fire bends a volley toward a live target inside the assistance cone', function () {
  // Given: a target close to, but not centered on, the player's firing direction.
  const world = new GeometryWorld()
  world.reset()
  world.events.length = 0
  const target = world.spawnEnemy('grunt', 200, 30)
  target.spawnTimer = 0

  // When: the player fires straight to the right.
  world.fire(0)

  // Then: the launch direction is corrected to the selected target once.
  assert.ok(Math.abs(world.bullets[0].angle - Math.atan2(30, 200)) < 1e-9)
})

test('fire preserves player direction when every target is outside the assistance cone', function () {
  // Given: a target beyond the visible 52-degree forward assistance sector.
  const world = new GeometryWorld()
  world.reset()
  world.events.length = 0
  const target = world.spawnEnemy('grunt', 200, 110)
  target.spawnTimer = 0

  // When: the player fires straight to the right.
  world.fire(0)

  // Then: aim assistance does not take over the player's chosen direction.
  assert.equal(world.bullets[0].angle, 0)
})

test('resolveCollisions forgives a four-pixel near miss', function () {
  // Given: a bullet passing four pixels beyond the visible collision radii.
  const world = new GeometryWorld()
  world.reset()
  world.events.length = 0
  const target = world.spawnEnemy('grunt', 100, 0)
  target.spawnTimer = 0
  world.bullets.push({ x: 82, y: 0, vx: 0, vy: 0, angle: 0, life: 1, radius: 3 })

  // When: projectile collisions are resolved.
  world.resolveCollisions()

  // Then: the near miss counts as a hit without enlarging player collision damage.
  assert.equal(target.dead, true)
})

test('continuous automatic fire remains inside the mobile projectile budget', function () {
  // Given: a long burst at the highest weapon tier.
  const world = new GeometryWorld()
  world.reset()
  world.score = 60000
  world.events.length = 0

  // When: enough volleys are requested to exceed any legitimate on-screen lifetime.
  for (let volley = 0; volley < 100; volley += 1) world.fire(0)

  // Then: collision and rendering work stay within the production mobile ceiling.
  assert.equal(world.bullets.length, 180)
})

test('enemy semantic colors follow the Cocos design tokens', function () {
  // Given: the production world and its semantic enemy palette.
  const world = new GeometryWorld()
  const expected = {
    wanderer: COLORS.violet,
    grunt: COLORS.cyan,
    weaver: COLORS.green,
    spinner: COLORS.magenta,
    snake: COLORS.yellow,
    repulsar: COLORS.orange,
    blackhole: COLORS.red
  }

  // Then: each enemy role resolves to its documented Cocos color token.
  for (const [kind, color] of Object.entries(expected)) {
    assert.equal(world.enemyColor(kind), color)
  }
})
