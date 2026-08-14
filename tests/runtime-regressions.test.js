'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

test('presentation uses a portrait design resolution', function () {
  // Given: the presentation constants consumed by the Cocos scene.
  const { DESIGN_HEIGHT, DESIGN_WIDTH } = require('../assets/scripts/presentation.ts')

  // When: the default design aspect is compared.
  const isPortrait = DESIGN_HEIGHT > DESIGN_WIDTH

  // Then: layout coordinates are authored against a portrait canvas.
  assert.equal(isPortrait, true)
  assert.deepEqual([DESIGN_WIDTH, DESIGN_HEIGHT], [720, 1280])
})

test('Cocos shades at one logical device pixel instead of the full retina resolution', function () {
  // Given: the production render-density policy.
  const { RENDER_PIXEL_RATIO } = require('../assets/scripts/presentation.ts')

  // Then: a high-DPR phone shades one pixel per logical device pixel.
  assert.equal(RENDER_PIXEL_RATIO, 1)
})

test('Cocos entity radii preserve the early-August logical-pixel sizes', function () {
  // Given: a 720-unit world displayed on the 390-pixel reference viewport.
  const { GeometryWorld } = require('../assets/scripts/simulation.ts')
  const world = new GeometryWorld()
  const unitsPerPixel = 720 / 390
  world.resize(720, 1280, unitsPerPixel)

  // When: each enemy role is spawned at a fixed point.
  const kinds = ['wanderer', 'grunt', 'weaver', 'spinner', 'snake', 'repulsar', 'blackhole']
  const radii = Object.fromEntries(kinds.map(function (kind) {
    return [kind, Math.round(world.spawnEnemy(kind, 0, 0).radius / unitsPerPixel * 100) / 100]
  }))

  // Then: player and enemy collision geometry matches the mature early-August build.
  assert.equal(Math.round(world.player.radius / unitsPerPixel * 100) / 100, 10)
  assert.deepEqual(radii, {
    wanderer: 11,
    grunt: 12,
    weaver: 12,
    spinner: 13,
    snake: 10,
    repulsar: 15,
    blackhole: 18
  })
})

test('Cocos visual primitives consume the documented design tokens', function () {
  // Given: the shared palette, type scale, and one-thumb control metrics.
  const { COLORS, TYPOGRAPHY, TOUCH } = require('../assets/scripts/design-tokens.ts')

  // Then: Cocos uses the documented semantic values.
  assert.deepEqual(COLORS, {
    background: '#000006', grid: '#2a7190', gridHot: '#15d8ff', white: '#ffffff',
    hud: '#b9ff36', cyan: '#42efff', green: '#4dff67', magenta: '#ff48ed',
    violet: '#9d61ff', yellow: '#ffe45c', orange: '#ff9f2f', red: '#ff554d'
  })
  assert.deepEqual(TYPOGRAPHY, {
    display: 74, displayLineHeight: 72, hudPrimary: 23, hudSecondary: 18,
    subtitle: 22, prompt: 20, message: 32, lineHeightExtra: 4, outlineWidth: 2
  })
  assert.deepEqual(TOUCH, {
    travel: 48, ringRadius: 48, knobRadius: 17, deadZone: 7, responseSpan: 35,
    sectorRadius: 66, headingRay: 58, bombRadius: 28, bombHitRadius: 36,
    bombOffset: 58, defaultBottom: 78, defaultSide: 90
  })
})

test('warped grid shares one point lattice across both line directions', function () {
  // Given: a portrait playfield and the production grid spacing.
  const { gridBounds, gridPointCount } = require('../assets/scripts/presentation.ts')
  const bounds = gridBounds(720, 1280, 42)

  // When: the renderer sizes its reusable point lattice.
  const points = gridPointCount(bounds)

  // Then: horizontal and vertical paths share one lattice instead of warping every point twice.
  assert.deepEqual([bounds.columnCount, bounds.rowCount], [21, 34])
  assert.equal(points, 714)
  assert.equal(points, bounds.columnCount * bounds.rowCount)
  assert.ok(points < bounds.columnCount * bounds.rowCount * 2)
})

test('presentation budgets bound high-load particle and grid distortion work', function () {
  // Given: the production presentation budgets.
  const { GRID_SPACING, MAX_GRID_WARP_RIPPLES, MAX_PARTICLES, STAR_COUNT, gridBounds, gridPointCount } = require('../assets/scripts/presentation.ts')

  // When: the worst-case effect counts are inspected.
  const points = gridPointCount(gridBounds(720, 1280, GRID_SPACING))
  const budget = { particles: MAX_PARTICLES, gridRipples: MAX_GRID_WARP_RIPPLES, stars: STAR_COUNT, gridPoints: points }

  // Then: mobile rendering remains bounded without disabling either effect.
  assert.deepEqual(budget, { particles: 480, gridRipples: 4, stars: 48, gridPoints: 260 })
})

test('Cocos portrait controls keep firing through center hold and stop on release', function () {
  // Given: a portrait Cocos viewport whose design units are half a physical pixel.
  const { TouchControls } = require('../assets/scripts/touch-controls.ts')
  const { AIM_ASSIST_HALF_ANGLE, GeometryWorld } = require('../assets/scripts/simulation.ts')
  const controls = new TouchControls()
  const world = new GeometryWorld()
  controls.resize(720, 1280, 0.5)
  world.resize(720, 1280)
  world.reset()
  controls.start({ id: 3, x: 160, y: -300 })

  // When: the single lower-screen touch moves to the right.
  controls.move({ id: 3, x: 184, y: -300 })
  const dragged = controls.vectors()
  world.update(0.016, { ...dragged, bomb: false, start: false, pause: false })
  controls.move({ id: 3, x: 160, y: -300 })
  const centered = controls.vectors()
  world.fireClock = 0
  world.update(0.016, { ...centered, bomb: false, start: false, pause: false })
  const heldBulletCount = world.bullets.length
  controls.end(3)
  const released = controls.vectors()
  world.fireClock = 0
  world.update(0.016, { ...released, bomb: false, start: false, pause: false })

  // Then: centering stops movement but preserves the heading until the touch ends.
  assert.equal(controls.singleHanded, true)
  assert.ok(dragged.move.x > 0.99)
  assert.equal(dragged.engaged, true)
  assert.deepEqual(centered.move, { x: 0, y: 0 })
  assert.equal(centered.engaged, true)
  assert.equal(heldBulletCount, 2)
  assert.equal(world.bullets.length, heldBulletCount)
  assert.equal(released.engaged, false)
  assert.equal(world.hasFireHeading, false)
  assert.ok(Math.abs(AIM_ASSIST_HALF_ANGLE - Math.PI * 26 / 180) < 1e-12)
  assert.equal(controls.right.active, false)
})

test('Cocos fighter tokens preserve the original 31 by 26 physical hull', function () {
  // Given: the shared Cocos fighter outline.
  const { FIGHTER_OUTER_PATH } = require('../assets/scripts/fighter-shape.ts')
  const forwards = FIGHTER_OUTER_PATH.map(function (point) { return point.forward })
  const sides = FIGHTER_OUTER_PATH.map(function (point) { return point.side })

  // Then: the resolution-independent token retains its established physical bounds.
  assert.equal(Math.max.apply(null, forwards) - Math.min.apply(null, forwards), 31)
  assert.equal(Math.max.apply(null, sides) - Math.min.apply(null, sides), 26)
})

test('background music schedules recurring tones after audio unlock', function () {
  // Given: an unlocked audio context and an active game.
  const { Synth } = require('../assets/scripts/synth.ts')
  const context = new FakeAudioContext()
  const synth = new Synth(function () { return context })
  synth.unlock()

  // When: music advances across two beat boundaries.
  synth.update(0, true)
  synth.update(0.1, true)
  synth.update(0.4, true)

  // Then: tones recur, but no duplicate tone is scheduled inside one beat.
  assert.equal(context.oscillators.length, 2)
  assert.ok(context.oscillators.every(function (oscillator) { return oscillator.started }))
  assert.ok(context.oscillators.every(function (oscillator) { return oscillator.stopped }))
  assert.ok(context.gains.every(function (gain) { return gain.gain.values[0] >= 0.04 }))
})

test('first gesture starts the packaged looping background track', function () {
  // Given: the shipped music asset and the Cocos WeChat audio adapter.
  const musicBytes = readFileSync(join(__dirname, '..', 'music', 'bgm.mp3'))
  const originalPlatform = globalThis.wx
  const cocosMusic = new FakeInnerAudioContext()
  globalThis.wx = {
    createInnerAudioContext: function () { return cocosMusic }
  }
  const { Synth } = require('../assets/scripts/synth.ts')

  // When: the first user gesture unlocks music and a later touch unlocks it again.
  try {
    const synth = new Synth(function () { return null })
    synth.unlock()
    synth.unlock()
  } finally {
    globalThis.wx = originalPlatform
  }

  // Then: a real MP3 is present and the adapter starts one uninterrupted visible-volume loop.
  assert.equal(musicBytes.subarray(0, 3).toString('ascii'), 'ID3')
  assert.equal(cocosMusic.src, 'music/bgm.mp3')
  assert.equal(cocosMusic.loop, true)
  assert.equal(cocosMusic.volume, 0.24)
  assert.equal(cocosMusic.playCount, 1)
})

test('looping music survives an unavailable effects audio context', function () {
  // Given: music support is present while the optional WebAudio effects factory fails.
  const originalPlatform = globalThis.wx
  const music = new FakeInnerAudioContext()
  globalThis.wx = { createInnerAudioContext: function () { return music } }
  const { Synth } = require('../assets/scripts/synth.ts')

  try {
    // When: the first gesture unlocks audio on that device.
    assert.doesNotThrow(function () {
      new Synth(function () { throw new Error('WebAudio unavailable') }).unlock()
    })
  } finally {
    globalThis.wx = originalPlatform
  }

  // Then: packaged BGM still starts and remains the active fallback.
  assert.equal(music.src, 'music/bgm.mp3')
  assert.equal(music.loop, true)
  assert.equal(music.playCount, 1)
})

class FakeAudioParam {
  constructor() {
    this.values = []
  }

  setValueAtTime(value) {
    this.values.push(value)
  }

  exponentialRampToValueAtTime(value) {
    this.values.push(value)
  }
}

class FakeOscillator {
  constructor() {
    this.frequency = new FakeAudioParam()
    this.type = 'sine'
    this.started = false
    this.stopped = false
  }

  connect() {}

  start() {
    this.started = true
  }

  stop() {
    this.stopped = true
  }
}

class FakeGain {
  constructor() {
    this.gain = new FakeAudioParam()
  }

  connect() {}
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 0
    this.destination = {}
    this.state = 'running'
    this.oscillators = []
    this.gains = []
    this.resumeCount = 0
  }

  resume() {
    this.resumeCount += 1
    return Promise.resolve()
  }

  createOscillator() {
    const oscillator = new FakeOscillator()
    this.oscillators.push(oscillator)
    return oscillator
  }

  createGain() {
    const gain = new FakeGain()
    this.gains.push(gain)
    return gain
  }
}

class FakeInnerAudioContext {
  constructor() {
    this.loop = false
    this.autoplay = false
    this.volume = 0
    this.src = ''
    this.playCount = 0
  }

  play() {
    this.playCount += 1
  }
}
