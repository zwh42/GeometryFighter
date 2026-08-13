'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

test('mini game requests portrait orientation by default', function () {
  // Given: the release configuration consumed by WeChat Mini Game.
  const config = JSON.parse(readFileSync(join(__dirname, '..', 'game.json'), 'utf8'))

  // When: the device orientation is resolved.
  const orientation = config.deviceOrientation

  // Then: startup is portrait rather than a locked landscape session.
  assert.equal(orientation, 'portrait')
})

test('presentation uses a portrait design resolution', function () {
  // Given: the presentation constants consumed by the Cocos scene.
  const { DESIGN_HEIGHT, DESIGN_WIDTH } = require('../assets/scripts/presentation.ts')

  // When: the default design aspect is compared.
  const isPortrait = DESIGN_HEIGHT > DESIGN_WIDTH

  // Then: layout coordinates are authored against a portrait canvas.
  assert.equal(isPortrait, true)
  assert.deepEqual([DESIGN_WIDTH, DESIGN_HEIGHT], [720, 1280])
})

test('Cocos visual primitives consume the documented design tokens', function () {
  // Given: the shared palette, type scale, and one-thumb control metrics.
  const { COLORS, TYPOGRAPHY, TOUCH } = require('../assets/scripts/design-tokens.ts')

  // Then: Cocos uses the same semantic values documented for both runtimes.
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

test('standalone one-thumb control draws its remembered 52-degree firing sector', function () {
  // Given: an active portrait stick with a remembered right-facing heading.
  const Renderer = require('../js/renderer')
  const context = new PathContext()
  const input = {
    singleHanded: true,
    left: { active: true, baseX: 120, baseY: 700, knobX: 120, knobY: 700 },
    right: { active: false, baseX: 0, baseY: 0, knobX: 0, knobY: 0 }
  }
  const renderer = new Renderer({}, context, input, {}, {})
  renderer.resize(390, 844)
  const config = require('../js/config')
  const original = Object.assign({}, config.TOUCH)
  Object.assign(config.TOUCH, { sectorRadius: 63, headingRay: 51 })

  try {
    // When: controls are rendered while the centered thumb remains held.
    renderer.drawControls({ state: 'playing', paused: false, hasFireHeading: true, fireHeading: 0 })
    const sector = context.arcs.find(function (arc) { return arc.radius === config.TOUCH.sectorRadius })

    // Then: two rays, a 52-degree arc, and a token-sized center ray expose the retained direction.
    assert.ok(sector)
    assert.ok(Math.abs(sector.start + Math.PI * 26 / 180) < 1e-12)
    assert.ok(Math.abs(sector.end - Math.PI * 26 / 180) < 1e-12)
    assert.ok(context.strokedPaths.some(function (path) {
      return path.length === 2 && path[0].x === 120 && path[1].x === 120 + config.TOUCH.headingRay && path[1].y === 700
    }))
  } finally {
    Object.assign(config.TOUCH, original)
  }
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

test('root mini game schedules background tones in a phone-audible range', function () {
  // Given: the WeChat entry point's audio system and a supported platform context.
  const AudioSystem = require('../js/audio')
  const context = new FakeAudioContext()
  const audio = new AudioSystem({ createWebAudioContext: function () { return context } })
  audio.unlock()

  // When: active gameplay crosses two background beat boundaries.
  audio.update(0, true)
  audio.update(0.1, true)
  audio.update(0.4, true)

  // Then: each scheduled tone is audible on small speakers and the context was resumed.
  assert.equal(context.oscillators.length, 2)
  assert.ok(context.oscillators.every(function (oscillator) { return oscillator.frequency.values[0] >= 100 }))
  assert.ok(context.gains.every(function (gain) { return gain.gain.values[0] >= 0.04 }))
  assert.equal(context.resumeCount, 1)
})

test('first gesture starts the packaged looping background track', function () {
  // Given: the shipped music asset and both WeChat audio adapters.
  const musicBytes = readFileSync(join(__dirname, '..', 'music', 'bgm.mp3'))
  const originalPlatform = globalThis.wx
  const cocosMusic = new FakeInnerAudioContext()
  globalThis.wx = {
    createInnerAudioContext: function () { return cocosMusic }
  }
  const { Synth } = require('../assets/scripts/synth.ts')
  const rootMusic = new FakeInnerAudioContext()
  const AudioSystem = require('../js/audio')

  // When: the first user gesture unlocks both runtime paths and a later touch unlocks them again.
  try {
    const synth = new Synth(function () { return null })
    const audio = new AudioSystem({ createInnerAudioContext: function () { return rootMusic } })
    synth.unlock()
    audio.unlock()
    synth.unlock()
    audio.unlock()
  } finally {
    globalThis.wx = originalPlatform
  }

  // Then: a real MP3 is present and both adapters start one uninterrupted visible-volume loop.
  assert.equal(musicBytes.subarray(0, 3).toString('ascii'), 'ID3')
  for (const music of [cocosMusic, rootMusic]) {
    assert.equal(music.src, 'music/bgm.mp3')
    assert.equal(music.loop, true)
    assert.equal(music.volume, 0.24)
    assert.equal(music.playCount, 1)
  }
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

test('standalone fighter preserves the original 31 by 26 open-claw hull', function () {
  // Given: the active standalone fighter and a path-recording canvas context.
  const Renderer = require('../js/renderer')
  const config = require('../js/config')
  const context = new PathContext()
  const renderer = new Renderer({}, context, {}, {}, {})

  // When: the fighter points to the right.
  renderer.drawPlayer({ x: 0, y: 0, angle: 0, invulnerable: 0, deadTimer: 0 }, 0.1)
  const hull = context.strokedPaths[0]
  const xs = hull.map(function (point) { return point.x })
  const ys = hull.map(function (point) { return point.y })

  // Then: both unfilled hulls remain open, with no permanent tail stroke.
  assert.equal(Math.max.apply(null, xs) - Math.min.apply(null, xs), 31)
  assert.equal(Math.max.apply(null, ys) - Math.min.apply(null, ys), 26)
  assert.deepEqual(context.strokedPaths.map(function (path) { return path.length }), [6, 4])
  assert.deepEqual(context.strokeStyles, ['#ffffff', '#ffffff'])
  assert.deepEqual(config.FIGHTER.outerPath, [[18, -8], [3, -13], [-13, -7], [-13, 7], [3, 13], [18, 8]])
  assert.deepEqual(config.FIGHTER.innerPath, [[10, -3.5], [-4, -7], [-4, 7], [10, 3.5]])
})

test('standalone core enemies retain their distinct canonical silhouette roles', function () {
  // Given: one fully spawned instance of each core enemy family.
  const Renderer = require('../js/renderer')
  const render = function (type, extra) {
    const context = new PathContext()
    const renderer = new Renderer({}, context, {}, {}, {})
    renderer.drawEnemy(Object.assign({
      type: type, x: 0, y: 0, angle: 0, radius: 12, spawn: 0,
      color: '#ffffff', mass: 1, segments: []
    }, extra), 0.2)
    return context
  }

  // When: their canonical Canvas paths are drawn.
  const wanderer = render('wanderer')
  const grunt = render('grunt')
  const weaver = render('weaver')
  const spinner = render('spinner')
  const snake = render('snake', { segments: [{ x: -4, y: 0, angle: 0 }] })
  const repulsar = render('repulsar')
  const blackhole = render('blackhole')

  // Then: pinwheel, diamond, framed cube, crossed box, headed snake, split-color hull, and ringed void remain separate roles.
  assert.equal(wanderer.strokedPaths.length, 4)
  assert.equal(grunt.strokedPaths.length, 2)
  assert.equal(weaver.strokeRects.length, 1)
  assert.equal(spinner.strokeRects.length, 1)
  assert.equal(snake.strokeRects.length, 1)
  assert.equal(snake.strokeStyles.at(-1), '#42efff')
  assert.equal(repulsar.strokeStyles.at(-1), '#42efff')
  assert.equal(blackhole.strokedPaths.length, 4)
  assert.equal(blackhole.arcs.length, 5)
})

test('root particle system reuses bounded slots under effect pressure', function () {
  // Given: the Canvas renderer's production particle limit.
  const config = require('../js/config')
  const { ParticleSystem } = require('../js/effects')
  const particles = new ParticleSystem()
  for (let index = 0; index < config.WORLD.maxParticles; index += 1) {
    particles.add(0, 0, 0, 0, '#ffffff', 1, 1, 1)
  }
  const firstParticle = particles.items[0]

  // When: one more effect is emitted at the limit.
  particles.add(1, 1, 0, 0, '#ffffff', 1, 1, 1)

  // Then: memory stays bounded and an existing slot is recycled instead of allocated away.
  assert.equal(config.WORLD.maxParticles, 720)
  assert.equal(particles.items.length, config.WORLD.maxParticles)
  assert.strictEqual(particles.items[0], firstParticle)
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

class PathContext {
  constructor() {
    this.currentPath = []
    this.strokedPaths = []
    this.strokeStyles = []
    this.strokeRects = []
    this.arcs = []
  }

  save() {}
  restore() {}
  translate() {}
  rotate() {}
  scale() {}
  closePath() {}
  fill() {}
  fillText() {}

  strokeRect(x, y, width, height) {
    this.strokeRects.push({ x: x, y: y, width: width, height: height })
  }

  beginPath() {
    this.currentPath = []
  }

  moveTo(x, y) {
    this.currentPath.push({ x: x, y: y })
  }

  lineTo(x, y) {
    this.currentPath.push({ x: x, y: y })
  }

  arc(x, y, radius, start, end) {
    this.arcs.push({ x: x, y: y, radius: radius, start: start, end: end })
  }

  stroke() {
    this.strokedPaths.push(this.currentPath.slice())
    this.strokeStyles.push(this.strokeStyle)
  }
}
