'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { VectorRenderer } = require('../assets/scripts/renderer.ts')
const { GameApp } = require('../assets/scripts/game-app.ts')
const { hudLayout } = require('../assets/scripts/presentation.ts')
const { MISSILE_ART } = require('../assets/scripts/design-tokens.ts')

class MockPlatform {
  constructor(metrics = {}) {
    this.kind = 'web'
    this.glCanvas = { width: 0, height: 0 }
    this.metricsValue = { width: 390, height: 844, safeLeft: 0, safeRight: 0, safeTop: 47, safeBottom: 34, menuBottom: 88, ...metrics }
    this.storage = new Map()
    this.gets = 0
    this.sets = []
    this.touchHandlers = null
    this.keyHandlers = null
    this.visibilityListener = null
    this.resizeListeners = []
    this.scheduledFrames = []
    this.clock = 0
  }

  createRaster(width, height) {
    return { width, height }
  }

  rasterizeLabel(label) {
    label.dirty = false
  }

  metrics() {
    return this.metricsValue
  }

  onResize(listener) {
    this.resizeListeners.push(listener)
  }

  onTouch(handlers) {
    this.touchHandlers = handlers
  }

  onKey(handlers) {
    this.keyHandlers = handlers
  }

  onVisibility(listener) {
    this.visibilityListener = listener
  }

  storageGet(key) {
    this.gets += 1
    return this.storage.get(key) || ''
  }

  storageSet(key, value) {
    this.sets.push({ key, value })
    this.storage.set(key, value)
  }

  requestFrame(callback) {
    this.scheduledFrames.push(callback)
  }

  now() {
    return this.clock
  }
}

class RecordingSink {
  constructor() {
    this.frames = []
    this.maxVertices = 0
  }

  drawFrame(renderer, labels, options) {
    this.frames.push(renderer.vertexCount)
    this.maxVertices = Math.max(this.maxVertices, renderer.vertexCount)
    this.labels = labels
    this.camera = options.camera
  }
}

function makeApp(metrics) {
  const platform = new MockPlatform(metrics)
  const sink = new RecordingSink()
  const app = new GameApp(platform, sink)
  return { platform, sink, app }
}

test('vector renderer tessellates primitives into one preallocated buffer', function () {
  // Given: a fresh renderer.
  const renderer = new VectorRenderer(1024)

  // When: one segment and one ten-slice disc are drawn.
  renderer.begin()
  renderer.setColor('#ff0000')
  renderer.setWidth(2)
  renderer.segment(0, 0, 10, 0)
  renderer.disc(5, 5, 3, 10)
  const afterPrimitives = renderer.vertexCount

  // Then: each primitive lands as exact triangle vertices in a single buffer.
  assert.equal(afterPrimitives, 6 + 30)
  assert.equal(renderer.stats.triangles, 12)

  // And: a new frame resets the cursor without reallocating.
  renderer.begin()
  assert.equal(renderer.vertexCount, 0)
  renderer.segment(0, 0, 1, 1)
  assert.equal(renderer.capacity, 1024)
  assert.equal(renderer.stats.grows, 0)
})

test('vector renderer grows its buffer only when a frame exceeds capacity', function () {
  // Given: a renderer with a tiny initial capacity.
  const renderer = new VectorRenderer(16)

  // When: a heavy frame grows the buffer in one step, then repeats in budget.
  renderer.begin()
  for (let index = 0; index < 24; index += 1) renderer.segment(index, 0, index + 1, 1)
  const capacityAfterGrowth = renderer.capacity
  const growsAfterGrowth = renderer.stats.grows
  renderer.begin()
  for (let index = 0; index < 24; index += 1) renderer.segment(index, 0, index + 1, 1)

  // Then: capacity doubles past the need and later identical frames allocate nothing.
  assert.ok(capacityAfterGrowth >= 144)
  assert.equal(renderer.capacity, capacityAfterGrowth)
  assert.equal(renderer.stats.grows, growsAfterGrowth)
})

test('homing missile tokens describe a finned missile, not an arrow orb', function () {
  // Given: the reviewed missile silhouette constants.
  // Then: the nose leads, fins sweep wider than the hull, and the exhaust trails.
  assert.ok(MISSILE_ART.noseForward > MISSILE_ART.bodyForward)
  assert.ok(MISSILE_ART.finTipSide > MISSILE_ART.bodySide)
  assert.ok(MISSILE_ART.finTipForward < MISSILE_ART.finRootForward)
  assert.ok(MISSILE_ART.flameBaseForward < MISSILE_ART.capForward)
  assert.ok(MISSILE_ART.flameLength > MISSILE_ART.flameCoreLength)
  assert.equal(MISSILE_ART.contrailSegments, 4)
})

test('a missile volley renders fuselage, fins, flame, and contrail primitives', function () {
  // Given: a game firing one volley under missile lock versus a plain volley.
  const missileRun = makeApp()
  missileRun.app.world.reset()
  missileRun.app.world.missileTimer = 5
  missileRun.app.world.update(0.016, { move: { x: 1, y: 0 }, aim: { x: 0, y: 0 }, engaged: true, start: false, pause: false })
  assert.ok(missileRun.app.world.bullets.length > 0)
  assert.ok(missileRun.app.world.bullets.every((bullet) => bullet.kind === 'missile'))
  missileRun.app.update(0.016)
  const missileSegments = missileRun.app.renderer.stats.segments
  const missileFills = missileRun.app.renderer.stats.fills

  const plainRun = makeApp()
  plainRun.app.world.reset()
  plainRun.app.world.update(0.016, { move: { x: 1, y: 0 }, aim: { x: 0, y: 0 }, engaged: true, start: false, pause: false })
  assert.ok(plainRun.app.world.bullets.every((bullet) => bullet.kind === 'bullet'))
  plainRun.app.update(0.016)
  const plainSegments = plainRun.app.renderer.stats.segments

  // Then: the missile silhouette draws many more stroke segments and filled
  // shapes than a plain tracer — fins, flame polygons, hull, and contrail.
  assert.ok(missileSegments >= plainSegments + 18, `expected missile strokes, got ${missileSegments} vs ${plainSegments}`)
  assert.ok(missileFills >= 6, `expected flame and hull fills, got ${missileFills}`)
  assert.equal(missileRun.sink.frames.length, 1)
})

test('HUD anchors clear the notch and menu capsule on a converted safe area', function () {
  // Given: a 390x844 device with a 47-unit notch, 34-unit home inset, and a
  // capsule ending 88 logical pixels from the top.
  const { app, sink } = makeApp()
  app.world.reset()
  app.update(0.016)

  // When: the HUD row is positioned after one frame.
  const unitsPerCssPixel = 720 / 390
  const worldHeight = 720 * 844 / 390
  const expected = hudLayout({
    viewport: { width: 720, height: worldHeight },
    safeArea: { x: 0, y: worldHeight - 34 * unitsPerCssPixel, width: 720, height: (844 - 47 - 34) * unitsPerCssPixel },
    labelHeight: 80,
    obstructionTop: 88 * unitsPerCssPixel
  })
  const score = app.labels[0]

  // Then: the score surface sits exactly on the reviewed anchors.
  assert.ok(Math.abs(score.x - (expected.leftX + score.config.width * 0.5)) < 1e-6)
  assert.ok(Math.abs(score.y - expected.y) < 1e-6)
  assert.match(score.string, /^SCORE  00000000/)
})

test('high-score storage is read once and written through at most every two seconds', function () {
  // Given: a scoring run on a device with synchronous storage.
  const { platform, app } = makeApp()
  app.world.reset()
  const getsAfterBoot = platform.gets

  // When: ten seconds of play accumulate a new record.
  for (let frame = 0; frame < 600; frame += 1) {
    app.world.score = 1000 + frame
    app.world.highScore = app.world.score
    app.update(1 / 60)
  }

  // Then: storage is never read per frame and writes stay throttled.
  assert.equal(platform.gets, getsAfterBoot)
  assert.ok(platform.sets.length >= 1 && platform.sets.length <= 6, `expected throttled writes, got ${platform.sets.length}`)
  assert.ok(Number(platform.sets[platform.sets.length - 1].value) > 0)
})

test('a one-minute maximum-load soak renders every frame inside fixed budgets', function () {
  // Given: a game pushed to its entity ceilings for one simulated minute.
  const { app, sink } = makeApp()
  app.world.reset()
  const kinds = ['wanderer', 'grunt', 'weaver', 'spinner', 'snake', 'repulsar', 'blackhole']
  const reseed = () => {
    app.world.elapsed = 600
    while (app.world.enemies.length < 100) {
      const enemy = app.world.spawnEnemy(kinds[app.world.enemies.length % kinds.length], (Math.random() - 0.5) * 600, (Math.random() - 0.5) * 1200)
      enemy.spawnTimer = 0
    }
    // Model the real 180-projectile ceiling: replace stale seeded rounds with a
    // fresh mixed volley instead of accumulating beyond the gameplay budget.
    app.world.bullets.length = 0
    for (let index = 0; index < 60; index += 1) {
      app.world.bullets.push({
        x: (Math.random() - 0.5) * 600,
        y: (Math.random() - 0.5) * 1200,
        vx: 0,
        vy: 0,
        angle: Math.random() * Math.PI * 2,
        life: 5,
        radius: 4,
        kind: index % 3 === 0 ? 'missile' : index % 3 === 1 ? 'bullet' : 'overload',
        source: 'player',
        target: null
      })
    }
  }
  reseed()
  const frames = 60 * 60
  let capacityAfterWarmup = 0
  let growsAtWarmup = 0
  for (let frame = 0; frame < frames; frame += 1) {
    if (frame % 120 === 0) reseed()
    app.update(1 / 60)
    if (frame === 120) {
      capacityAfterWarmup = app.renderer.capacity
      growsAtWarmup = app.renderer.stats.grows
    }
  }

  // Then: every frame drew, the vertex buffer stabilized, and per-frame
  // geometry stays bounded — no slow drift that would stutter long sessions.
  assert.equal(sink.frames.length, frames)
  assert.equal(app.renderer.capacity, capacityAfterWarmup)
  assert.equal(app.renderer.stats.grows, growsAtWarmup)
  assert.ok(sink.maxVertices < 131072, `vertex budget exceeded: ${sink.maxVertices}`)
  assert.ok(sink.maxVertices > 1000, `expected heavy combat frames, got ${sink.maxVertices}`)
})

test('every enemy bends the grid toward itself in proportion to its bulk', function () {
  // Given: a playing field whose lattice point at rest sits at (304, 0), well
  // clear of the player's own grid dimple, and an enemy pulling from (280, 0).
  // The under-damped lattice rings while the enemy chases the player, so the
  // meaningful measurement is the peak bend toward the enemy.
  function warpFrom(kind, frames) {
    const { app } = makeApp()
    app.world.reset()
    const enemy = app.world.spawnEnemy(kind, 280, 0)
    enemy.spawnTimer = 0
    app.update(1 / 60)
    let probeIndex = -1
    let probeDistance = Infinity
    const points = app.gridLattice.points
    for (let index = 0; index < points.length; index += 1) {
      const distance = Math.abs(points[index].x - 304) + Math.abs(points[index].y)
      if (distance < probeDistance) {
        probeDistance = distance
        probeIndex = index
      }
    }
    assert.ok(probeDistance < 30, `could not locate the lattice point near (304, 0), best ${probeDistance.toFixed(0)}`)
    let peakBend = 0
    for (let frame = 0; frame < frames; frame += 1) {
      app.update(1 / 60)
      peakBend = Math.max(peakBend, 304 - points[probeIndex].x)
    }
    return { app, enemy, probe: points[probeIndex], peakBend }  }

  // When: a grunt and a blackhole of equal footing each occupy the same spot.
  const gruntRun = warpFrom('grunt', 60)
  const holeRun = warpFrom('blackhole', 60)

  // Then: both bend the neighboring lattice point toward themselves, and the
  // heavier blackhole bends it far more than the grunt.
  assert.ok(gruntRun.peakBend > 5, `grunt barely warped the grid: ${gruntRun.peakBend.toFixed(2)}`)
  assert.ok(holeRun.peakBend > gruntRun.peakBend * 2, `expected bulk-proportional warp, got ${holeRun.peakBend.toFixed(2)} vs ${gruntRun.peakBend.toFixed(2)}`)

  // And: the bend relaxes back once the enemy is gone.
  gruntRun.enemy.dead = true
  for (let frame = 0; frame < 150; frame += 1) gruntRun.app.update(1 / 60)
  assert.ok(304 - gruntRun.probe.x < gruntRun.peakBend * 0.5, 'grid did not relax after the enemy died')
})
