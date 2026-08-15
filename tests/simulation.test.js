'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { GeometryWorld, normalizeInto } = require('../assets/scripts/simulation.ts')
const { ENEMY_ART_COLOR, SUPER_EVENT_ART, SUPER_WEAPON_ART } = require('../assets/scripts/design-tokens.ts')

test('normalizeInto reuses caller storage for hot-loop vectors', function () {
  // Given: caller-owned storage used repeatedly by the simulation hot path.
  const output = { x: 99, y: -99 }

  // When: a vector is normalized into that storage.
  const result = normalizeInto(3, 4, output)

  // Then: no replacement object is created and the normalized value is correct.
  assert.strictEqual(result, output)
  assert.deepEqual(output, { x: 0.6, y: 0.8 })
})

test('smart bomb has no remaining simulation inventory or action surface', function () {
  // Given: a freshly reset world after the secondary action was removed.
  const world = new GeometryWorld()
  world.reset()

  // When: the public gameplay surface is inspected.
  const hasInventory = 'bombs' in world
  const hasAction = 'useBomb' in world

  // Then: neither a finite bomb inventory nor an activation action remains.
  assert.equal(hasInventory, false)
  assert.equal(hasAction, false)
})

test('timed super supplies require eight hits and activate their stored effect', function () {
  // Given: a playing world whose passive supply timer has elapsed.
  const world = new GeometryWorld()
  world.reset()
  world.events.length = 0
  world.supplyClock = 0

  // When: one frame advances and an overload supply is then hit eight times.
  world.update(0.016, idleControls())
  assert.equal(world.supplies.length, 1)
  const supply = world.spawnSupply(100, 0, 'overload')
  supply.spawnTimer = 0
  for (let hit = 0; hit < 8; hit += 1) {
    world.bullets.push({ x: supply.x, y: supply.y, vx: 0, vy: 0, angle: 0, life: 1, radius: 3, kind: 'bullet', source: 'player' })
    world.resolveCollisions()
  }

  // Then: the orbital beacon is destroyed on the eighth hit and grants eight seconds of overdrive.
  assert.equal(supply.dead, true)
  assert.equal(supply.health, 0)
  assert.equal(world.overloadTimer, 8)
})

test('score milestone restores a super supply', function () {
  // Given: a kill worth the remaining points before the 100,000-point milestone.
  const world = new GeometryWorld()
  world.reset()
  world.score = 99900
  world.events.length = 0
  const enemy = world.spawnEnemy('grunt', 120, 0)
  enemy.spawnTimer = 0

  // When: the target is destroyed.
  world.killEnemy(enemy)

  // Then: the historical supply trigger returns without introducing a secondary inventory.
  assert.equal(world.supplies.length, 1)
  assert.equal(world.supplies[0].maxHealth, 8)
  assert.equal('bombs' in world, false)
})

test('all historical super forms coexist without a secondary action inventory', function () {
  // Given: live enemies and the passive super-supply system.
  const world = new GeometryWorld()
  world.reset()
  const first = world.spawnEnemy('grunt', 100, 0)
  const second = world.spawnEnemy('weaver', 140, 0)
  first.spawnTimer = 0
  second.spawnTimer = 0

  // When: detonation, ally wing, and overload are activated in sequence.
  world.activateSuperWeapon('detonation')
  world.activateSuperWeapon('allies')
  world.activateSuperWeapon('overload')

  // Then: enemies enter the staggered chain, 3-5 allies deploy for 12 seconds, and overdrive lasts 8 seconds.
  assert.ok(first.selfDestruct > 0)
  assert.ok(second.selfDestruct > first.selfDestruct)
  assert.ok(world.allies.length >= 3 && world.allies.length <= 5)
  assert.ok(world.allies.every(function (ally) { return ally.life === 12 }))
  assert.equal(world.overloadTimer, 8)
  assert.equal('bombs' in world, false)
})

test('overdrive fires a nine-lane barrage of dedicated energy pulses', function () {
  // Given: an active overdrive super weapon with an empty projectile field.
  const world = new GeometryWorld()
  world.reset()
  world.bullets.length = 0
  world.overloadTimer = 8

  // When: one volley is fired.
  world.fire(0)

  // Then: all nine lanes use the overload visual kind instead of arrow-like standard bolts.
  assert.equal(world.bullets.length, 9)
  assert.ok(world.bullets.every(function (bullet) { return bullet.kind === 'overload' }))
})

test('first spinner hit restores five seconds of smoothly homing missiles', function () {
  // Given: a spinner in the path of one player bullet.
  const world = new GeometryWorld()
  world.reset()
  const spinner = world.spawnEnemy('spinner', 40, 0)
  spinner.spawnTimer = 0
  world.bullets.push({ x: 40, y: 0, vx: 0, vy: 0, angle: 0, life: 1, radius: 3, kind: 'bullet', source: 'player' })

  // When: collision resolves and the player fires again.
  world.resolveCollisions()
  world.fire(0)

  // Then: the timed missile form is active and the new projectile carries its distinct kind.
  assert.equal(world.missileTimer, 5)
  assert.equal(world.bullets[world.bullets.length - 1].kind, 'missile')
})

test('crowded collision broad phase avoids scanning every enemy for every bullet', function () {
  // Given: 100 enemies far from 180 live bullets, with radius access counting candidate checks.
  const world = crowdedWorld('grunt')
  let checks = 0
  for (const enemy of world.enemies) {
    const radius = enemy.radius
    Object.defineProperty(enemy, 'radius', {
      configurable: true,
      get: function () { checks += 1; return radius },
      set: function () {}
    })
  }

  // When: projectile collisions are resolved.
  world.resolveCollisions()

  // Then: a local broad phase replaces the previous 18,000 radius checks.
  assert.ok(checks < 1000, `expected fewer than 1000 candidate checks, got ${checks}`)
})

test('bullet forces scan a filtered repulsar list once per frame', function () {
  // Given: a crowded wave containing no repulsars.
  const world = crowdedWorld('grunt')
  let kindReads = 0
  for (const enemy of world.enemies) {
    const kind = enemy.kind
    Object.defineProperty(enemy, 'kind', {
      configurable: true,
      get: function () { kindReads += 1; return kind },
      set: function () {}
    })
  }

  // When: all bullets update for one frame.
  world.updateBullets(0)

  // Then: enemies are classified once instead of 100 times per projectile.
  assert.ok(kindReads < 500, `expected fewer than 500 kind reads, got ${kindReads}`)
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

test('enemy and super-event colors match the historical review build', function () {
  // Given: the production world and the combat palette reviewed in be22ffa.
  const world = new GeometryWorld()
  const expected = {
    wanderer: '#9d61ff',
    grunt: '#43f6ff',
    weaver: '#73ff80',
    spinner: '#ff48ed',
    snake: '#ffe45c',
    repulsar: '#ff9f2f',
    blackhole: '#ff506d'
  }

  // Then: live enemy and super-effect colors retain the reviewed palette.
  assert.deepEqual(ENEMY_ART_COLOR, expected)
  assert.deepEqual(SUPER_EVENT_ART, {
    detonation: '#ff6d77', overload: '#fff36a', allies: '#43f6ff'
  })
  assert.equal(SUPER_WEAPON_ART.glow, '#bcff49')
  for (const [kind, color] of Object.entries(expected)) {
    assert.equal(world.enemyColor(kind), color)
  }

  world.reset()
  world.events.length = 0
  world.activateSuperWeapon('detonation')
  world.activateSuperWeapon('overload')
  world.activateSuperWeapon('allies')
  assert.deepEqual(world.events.map(function (event) { return event.color }), [
    SUPER_EVENT_ART.detonation, SUPER_EVENT_ART.overload, SUPER_EVENT_ART.allies
  ])
})

test('kills drop magnetized geoms that raise the multiplier and reset on death', function () {
  // Given: six grunts destroyed near the player.
  const world = new GeometryWorld()
  world.reset()
  world.events.length = 0
  for (let index = 0; index < 6; index += 1) {
    const enemy = world.spawnEnemy('grunt', 60 + index * 4, 0)
    enemy.spawnTimer = 0
    world.killEnemy(enemy)
  }
  assert.equal(world.geoms.length, 6)

  // When: the dropped crystals magnetize to the stationary player over time.
  let guard = 0
  while (world.geoms.some(function (geom) { return !geom.dead }) && guard < 2000) {
    world.updateGeoms(0.033)
    guard += 1
  }

  // Then: every geom is collected, the multiplier climbs, and death resets it.
  assert.equal(world.geomTotal, 6)
  assert.equal(world.multiplier, 2)
  assert.ok(world.events.some(function (event) { return event.kind === 'geom' }))
  world.player.invulnerable = 0
  world.loseLife()
  assert.equal(world.multiplier, 1)
  assert.equal(world.geomTotal, 0)
})

test('chain detonation clears enemies without dropping multiplier geoms', function () {
  // Given: three live grunts and the detonation super weapon.
  const world = new GeometryWorld()
  world.reset()
  world.events.length = 0
  for (let index = 0; index < 3; index += 1) world.spawnEnemy('grunt', -120 + index * 90, 200)
  world.activateSuperWeapon('detonation')

  // When: the staggered self-destruct chain resolves.
  for (let step = 0; step < 40; step += 1) world.updateEnemies(0.05)

  // Then: every enemy is gone and no geoms entered the field.
  assert.ok(world.enemies.every(function (enemy) { return enemy.dead }))
  assert.equal(world.geoms.length, 0)
})

test('a fed black hole devours enemies and erupts into a grunt ring', function () {
  // Given: an active black hole with a wanderer drifting beside it.
  const world = new GeometryWorld()
  world.reset()
  world.events.length = 0
  world.enemies.length = 0
  const blackhole = world.spawnEnemy('blackhole', 220, 0)
  blackhole.spawnTimer = 0
  const snack = world.spawnEnemy('wanderer', 258, 0)
  snack.spawnTimer = 0

  // When: repeated frames pull the wanderer in while bullets feed the core.
  let guard = 0
  while (!blackhole.dead && guard < 4000) {
    world.bullets.push({ x: blackhole.x, y: blackhole.y, vx: 0, vy: 0, angle: 0, life: 1, radius: 3, kind: 'bullet', source: 'player' })
    world.updateEnemies(0.016)
    world.bullets.length = 0
    guard += 1
  }

  // Then: the snack is consumed for no score and the eruption spawns six grunts.
  assert.equal(blackhole.dead, true)
  assert.equal(snack.dead, true)
  assert.equal(world.score, blackhole.value * world.multiplier)
  const grunts = world.enemies.filter(function (enemy) { return enemy.kind === 'grunt' })
  assert.equal(grunts.length, 6)
  assert.ok(world.events.some(function (event) { return event.kind === 'super' && event.text === 'BLACK HOLE ERUPTED' }))
})

test('weavers sidestep approaching fire', function () {
  // Given: a weaver in the path of an incoming player bullet.
  const world = new GeometryWorld()
  world.reset()
  const weaver = world.spawnEnemy('weaver', 100, 0)
  weaver.spawnTimer = 0
  world.bullets.length = 0
  world.bullets.push({ x: 30, y: 0, vx: 790, vy: 0, angle: 0, life: 1, radius: 3, kind: 'bullet', source: 'player', target: null })

  // When: one enemy update observes the threat.
  world.updateEnemies(0.016)

  // Then: the weaver receives a lateral dodge impulse and enters cooldown.
  assert.ok(Math.abs(weaver.vy) > 100)
  assert.ok(weaver.dodgeTimer > 0)
})

test('geom collection caps the multiplier at the documented ceiling', function () {
  // Given: a long collection streak simulated directly through the economy.
  const world = new GeometryWorld()
  world.reset()

  // When: far more geoms than the ceiling are collected.
  for (let index = 0; index < 300; index += 1) {
    world.spawnGeoms(0, 0, 1)
    world.geoms[world.geoms.length - 1].x = world.player.x
    world.geoms[world.geoms.length - 1].y = world.player.y
    world.updateGeoms(0.016)
    world.cleanup()
  }

  // Then: the multiplier stops at the design ceiling.
  assert.equal(world.multiplier, 25)
})

test('a three-minute soak run keeps every interacting subsystem inside its budget', function () {
  // Given: a deterministic world driven by a circling one-thumb player.
  const world = new GeometryWorld()
  world.reset()
  const controls = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, engaged: true, start: false, pause: false }
  let heading = 0

  // When: three minutes of continuous play advance frame by frame.
  for (let frame = 0; frame < 60 * 180; frame += 1) {
    heading += 0.031
    controls.move.x = Math.cos(heading)
    controls.move.y = Math.sin(heading)
    world.update(1 / 60, controls)
    if (world.state !== 'playing') world.reset()
    assert.ok(world.enemies.length <= 100, `enemy budget exceeded at frame ${frame}`)
    assert.ok(world.geoms.length <= 91, `geom budget exceeded at frame ${frame}`)
    assert.ok(world.multiplier <= 25, `multiplier ceiling exceeded at frame ${frame}`)
    assert.ok(Number.isFinite(world.score) && world.score >= 0, `score corrupted at frame ${frame}`)
    world.consumeEvents()
  }

  // Then: the run survived, scored, and exercised the drop economy without drifting out of budget.
  assert.ok(world.score > 0 || world.kills > 0)
  assert.ok(world.geoms.length <= 90)
})

function idleControls() {
  return { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, engaged: false, start: false, pause: false }
}

function crowdedWorld(kind) {
  const world = new GeometryWorld()
  world.reset()
  world.enemies.length = 0
  world.bullets.length = 0
  for (let index = 0; index < 100; index += 1) {
    const enemy = world.spawnEnemy(kind, -320 + index % 10 * 64, -520 + Math.floor(index / 10) * 80)
    enemy.spawnTimer = 0
  }
  for (let index = 0; index < 180; index += 1) {
    world.bullets.push({ x: -340 + index % 18 * 40, y: 610, vx: 0, vy: 0, angle: 0, life: 1, radius: 3, kind: 'bullet', source: 'player' })
  }
  return world
}
