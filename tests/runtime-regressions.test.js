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
  const { MAX_GRID_WARP_RIPPLES, MAX_PARTICLES } = require('../assets/scripts/presentation.ts')

  // When: the worst-case effect counts are inspected.
  const budget = { particles: MAX_PARTICLES, gridRipples: MAX_GRID_WARP_RIPPLES }

  // Then: mobile rendering remains bounded without disabling either effect.
  assert.deepEqual(budget, { particles: 480, gridRipples: 4 })
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
  assert.equal(context.resumeCount, 1)
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
    return new FakeGain()
  }
}
