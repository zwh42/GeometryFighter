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

test('the renderer shades at one logical device pixel instead of the full retina resolution', function () {
  // Given: the production render-density policy.
  const { RENDER_PIXEL_RATIO } = require('../assets/scripts/presentation.ts')

  // Then: a high-DPR phone shades one pixel per logical device pixel.
  assert.equal(RENDER_PIXEL_RATIO, 1)
})

test('title glow flicker stays bounded and keeps breathing over time', function () {
  // Given: the neon-sign pulse behind the title.
  const { titleGlowPulse } = require('../assets/scripts/presentation.ts')

  // When: a long stretch of time is sampled densely (including stutter windows).
  let minimum = 1
  let maximum = 0
  for (let t = 0; t < 60; t += 0.01) {
    const pulse = titleGlowPulse(t)
    minimum = Math.min(minimum, pulse)
    maximum = Math.max(maximum, pulse)
  }

  // Then: the sign dims and flares but never blacks out or saturates.
  assert.ok(minimum >= 0.3, `pulse bottom ${minimum} below 0.3`)
  assert.ok(maximum <= 1, `pulse peak ${maximum} above 1`)
  assert.ok(maximum - minimum > 0.2, 'pulse does not visibly breathe')
})

test('top HUD clears both safe-area edges and the WeChat menu capsule', function () {
  // Given: a portrait viewport with a 90-unit cutout and a menu capsule ending 124 units from the top.
  const { hudLayout } = require('../assets/scripts/presentation.ts')
  const viewport = { width: 720, height: 1280 }
  const safeArea = { x: 0, y: 34, width: 720, height: 1156 }

  // When: the complete two-column HUD layout is positioned.
  const layout = hudLayout({ viewport, safeArea, labelHeight: 80, obstructionTop: 124 })

  // Then: both horizontal anchors are inset and the whole row starts below the capsule with padding.
  assert.deepEqual(layout, { leftX: -332, rightX: 332, y: 464, statusWidth: 388, topInset: 136 })
  assert.equal(layout.y + 40, viewport.height * 0.5 - layout.topInset)
})

test('world entity radii preserve the early-August logical-pixel sizes', function () {
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

test('visual primitives consume the documented design tokens', function () {
  // Given: the shared palette, type scale, and one-thumb control metrics.
  const { COLORS, LAYOUT, TYPOGRAPHY, TOUCH } = require('../assets/scripts/design-tokens.ts')

  // Then: Cocos uses the documented semantic values.
  assert.deepEqual(COLORS, {
    background: '#000006', grid: '#2a7190', gridDeep: '#1e1e8b', gridHot: '#15d8ff', white: '#ffffff',
    hud: '#b9ff36', cyan: '#42efff', green: '#4dff67', magenta: '#ff48ed',
    violet: '#9d61ff', yellow: '#ffe45c', orange: '#ff9f2f', red: '#ff554d'
  })
  assert.deepEqual(TYPOGRAPHY, {
    display: 92, displayLineHeight: 160, hudPrimary: 23, hudSecondary: 18,
    subtitle: 22, prompt: 20, message: 32, lineHeightExtra: 4, outlineWidth: 2
  })
  assert.deepEqual(TOUCH, {
    travel: 48, ringRadius: 48, knobRadius: 17, deadZone: 7, responseSpan: 35,
    sectorRadius: 66, headingRay: 58, defaultBottom: 78, defaultSide: 90
  })
  assert.deepEqual(LAYOUT, {
    arenaInset: 8, scoreEdge: 28, hudMinimumTop: 24, hudSafePadding: 12,
    hudColumnGap: 16, titleY: 82, subtitleY: -42, promptY: -116, messageY: 142,
    scoreWidth: 260, scoreHeight: 80, labelWidth: 900, labelHeight: 160
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

test('reactive lattice springs to a sustained dimple, overshoots, and settles back', function () {
  // Given: the production spring constants and a small lattice.
  const { ReactiveGridLattice, gridBounds, gridPointIndex } = require('../assets/scripts/presentation.ts')
  const lattice = new ReactiveGridLattice(90, 7.5)
  const layout = gridBounds(200, 200, 50)
  const center = gridPointIndex(layout, 0, 0)

  // When: a constant 10-unit target displacement is held for two seconds, then released.
  let peak = 0
  let settledLow = Number.POSITIVE_INFINITY
  for (let step = 0; step < 120; step += 1) {
    lattice.advance(layout, 50, 1 / 60, function (x, y, output) { output.x = 10; output.y = 0 })
    const offset = lattice.points[center].x - 0
    peak = Math.max(peak, offset)
  }
  const heldOffset = lattice.points[center].x
  for (let step = 0; step < 240; step += 1) {
    lattice.advance(layout, 50, 1 / 60, function (x, y, output) { output.x = 0; output.y = 0 })
    settledLow = Math.min(settledLow, lattice.points[center].x)
  }

  // Then: the lattice converges toward the dimple, visibly overshoots past it, and relaxes home.
  assert.ok(heldOffset > 9 && heldOffset < 10, `expected near-target hold, got ${heldOffset}`)
  assert.ok(peak > 10.05, `expected under-damped overshoot past 10, got ${peak}`)
  assert.ok(Math.abs(lattice.points[center].x) < 0.6, 'expected the lattice to settle back to rest')
})

test('bullet-wake kicks inject velocity into only the nearest lattice points', function () {
  // Given: a resting lattice with spacing 50.
  const { ReactiveGridLattice, gridBounds, gridPointIndex } = require('../assets/scripts/presentation.ts')
  const lattice = new ReactiveGridLattice(90, 7.5)
  const layout = gridBounds(400, 400, 50)
  lattice.advance(layout, 50, 1 / 60, function (x, y, output) { output.x = 0; output.y = 0 })

  // When: one wake impulse lands beside a lattice intersection.
  lattice.kick(layout, 50, 12, 0, 80, 6)

  // Then: the nearest point is shoved away while a point beyond the radius stays at rest.
  const struck = lattice.points[gridPointIndex(layout, 0, 0)]
  const far = lattice.points[gridPointIndex(layout, 3, 0)]
  lattice.advance(layout, 50, 1 / 60, function (x, y, output) { output.x = 0; output.y = 0 })
  assert.ok(struck.x < -0.05, `expected the struck point to be shoved away, got ${struck.x}`)
  assert.ok(Math.abs(far.x - 150) < 1e-9, `expected an untouched point to stay at rest, got ${far.x}`)
})

test('presentation budgets bound high-load particle and grid distortion work', function () {
  // Given: the production presentation budgets.
  const { GRID_SPACING, MAX_GRID_WARP_RIPPLES, MAX_PARTICLES, STAR_COUNT, gridBounds, gridPointCount } = require('../assets/scripts/presentation.ts')

  // When: the worst-case effect counts are inspected.
  const points = gridPointCount(gridBounds(720, 1280, GRID_SPACING))
  const budget = { particles: MAX_PARTICLES, gridRipples: MAX_GRID_WARP_RIPPLES, stars: STAR_COUNT, gridPoints: points }

  // Then: mobile rendering remains bounded without disabling either effect.
  assert.deepEqual(budget, { particles: 640, gridRipples: 6, stars: 48, gridPoints: 260 })
})

test('portrait controls keep firing through center hold and stop on release', function () {
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
  world.update(0.016, { ...dragged, start: false, pause: false })
  controls.move({ id: 3, x: 160, y: -300 })
  const centered = controls.vectors()
  world.fireClock = 0
  world.update(0.016, { ...centered, start: false, pause: false })
  const heldBulletCount = world.bullets.length
  controls.end(3)
  const released = controls.vectors()
  world.fireClock = 0
  world.update(0.016, { ...released, start: false, pause: false })

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

test('the fighter traces the original claw silhouette from the 1.6.6 review feedback', function () {
  // Given: the claw-ship contract that replaces the nine-point hull.
  const {
    FIGHTER_GLOW_ALPHA,
    FIGHTER_GLOW_COLOR,
    FIGHTER_HULL_COLOR,
    FIGHTER_INNER_GLOW_STROKE,
    FIGHTER_INNER_PATH,
    FIGHTER_INNER_STROKE,
    FIGHTER_OUTER_GLOW_STROKE,
    FIGHTER_OUTER_PATH,
    FIGHTER_OUTER_STROKE,
    FIGHTER_THRUSTER_COLOR,
    FIGHTER_THRUSTER_PATH
  } = require('../assets/scripts/fighter-shape.ts')
  const forwards = FIGHTER_OUTER_PATH.map(function (point) { return point.forward })
  const sides = FIGHTER_OUTER_PATH.map(function (point) { return point.side })

  // Then: the hull keeps its footprint but now reads as the original claw.
  assert.equal(Math.max.apply(null, forwards) - Math.min.apply(null, forwards), 31)
  assert.equal(Math.max.apply(null, sides) - Math.min.apply(null, sides), 24)
  assert.deepEqual(FIGHTER_OUTER_PATH, [
    { forward: -9, side: 0 },
    { forward: -1, side: -6.5 },
    { forward: 6, side: -11.5 },
    { forward: 13.5, side: -12 },
    { forward: 22, side: -4 },
    { forward: 14, side: -6 },
    { forward: 2, side: -3.7 },
    { forward: -9, side: 0 },
    { forward: 2, side: 3.7 },
    { forward: 14, side: 6 },
    { forward: 22, side: 4 },
    { forward: 13.5, side: 12 },
    { forward: 6, side: 11.5 },
    { forward: -1, side: 6.5 },
    { forward: -9, side: 0 }
  ])
  assert.deepEqual(FIGHTER_INNER_PATH, [
    { forward: 4, side: 0 }, { forward: 0, side: -3 }, { forward: -4, side: 0 }, { forward: 0, side: 3 }, { forward: 4, side: 0 }
  ])
  assert.deepEqual(FIGHTER_THRUSTER_PATH, [
    { forward: -8, side: 5 }, { forward: -19, side: 0 }, { forward: -8, side: -5 }
  ])
  assert.deepEqual({
    hull: FIGHTER_HULL_COLOR,
    glow: FIGHTER_GLOW_COLOR,
    glowAlpha: FIGHTER_GLOW_ALPHA,
    thruster: FIGHTER_THRUSTER_COLOR,
    strokes: [FIGHTER_OUTER_GLOW_STROKE, FIGHTER_OUTER_STROKE, FIGHTER_INNER_GLOW_STROKE, FIGHTER_INNER_STROKE]
  }, {
    hull: '#e8ffff', glow: '#5cebff', glowAlpha: 66, thruster: '#5dffba',
    strokes: [13, 2.6, 8, 1.4]
  })
})

test('standalone projectiles, enemies, allies, and super supplies use the current combat tokens', function () {
  // Given: the reviewed combat primitives separated from simulation behavior.
  const { ALLY_ART, COMBAT_ART_SCALE, ENEMY_ART_RADIUS, MISSILE_ART, PROJECTILE_ART, SUPER_WEAPON_ART } = require('../assets/scripts/design-tokens.ts')

  // Then: each visible weapon form retains its historical silhouette and palette.
  assert.deepEqual(PROJECTILE_ART, {
    bulletTail: 20, glowWidth: 12, coreWidth: 2.8,
    overloadTail: 16, overloadGlowWidth: 18, overloadRailWidth: 2.2, overloadCoreRadius: 4.8,
    overloadRingRadius: 7.2, overloadRailOffset: 3.8, overloadRailLength: 12,
    bulletGlow: '#ffef49', missileGlow: '#ff892a', overloadGlow: '#42efff',
    overloadCore: '#ffffff', overloadAccent: '#ff48ed', core: '#fffdd7'
  })
  assert.deepEqual(MISSILE_ART, {
    hull: '#fff3df', glow: '#ff892a', flame: '#ff7a1f', flameCore: '#ffe9a8',
    hullStroke: 1.8, glowStroke: 11,
    noseForward: 11, noseShoulderForward: 8.4, noseShoulderSide: 1.5,
    bodyForward: 5.2, bodySide: 2.4, tailForward: -8.2, tailSide: 2.4, capForward: -9.4, capSide: 1.3,
    finRootForward: -4.6, finRootSide: 2.3, finTipForward: -10.2, finTipSide: 5.4, finTrailForward: -8.4, finTrailSide: 2.1,
    nozzleForward: -8.6, nozzleSide: 1.9,
    flameBaseForward: -9.8, flameBaseSide: 1.8, flameCoreSide: 0.9,
    flameLength: 7.5, flameFlicker: 3.2, flameCoreLength: 4.4,
    contrailStart: 14, contrailSpan: 22, contrailSegments: 4, contrailWidth: 2.4, contrailSway: 1.6
  })
  assert.equal(COMBAT_ART_SCALE, 1.6)
  assert.deepEqual(ALLY_ART, {
    glow: '#43f6ff', glowAlpha: 62, core: '#b0ffff', glowWidth: 10, coreWidth: 1.8,
    coreRadius: 5.5, nose: 12, wingForward: 3, wingSide: 7, tailForward: -7, tailSide: 4
  })
  assert.deepEqual(SUPER_WEAPON_ART, {
    glow: '#bcff49', glowAlpha: 68, core: '#dbff95', icon: '#f5ffe0', iconGlowAlpha: 62,
    radius: 22, glowWidth: 13, coreWidth: 2.2, shellPadding: 4, orbitInset: 3, orbitGap: 6,
    rayStart: 8, rayEnd: 16, durabilityOrbit: 8, durabilityRadius: 2,
    detonationSpokes: 6, detonationInner: 3, detonationOuter: 11, alliesRadius: 9, iconRadius: 2.6
  })
  assert.deepEqual(ENEMY_ART_RADIUS, {
    wanderer: 9, grunt: 13, weaver: 14, spinner: 15, snake: 15, repulsar: 18, blackhole: 26
  })
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

test('first gesture starts the packaged background track', function () {
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
    const synth = new Synth(function () { return null }, function () { return 0 })
    synth.unlock()
    synth.unlock()
  } finally {
    globalThis.wx = originalPlatform
  }

  // Then: a real MP3 is present and the adapter starts one full-playback track.
  assert.equal(musicBytes.subarray(0, 3).toString('ascii'), 'ID3')
  assert.equal(cocosMusic.src, 'music/bgm.mp3')
  assert.equal(cocosMusic.loop, false)
  assert.equal(cocosMusic.volume, 0.24)
  assert.equal(cocosMusic.playCount, 1)
})

test('packaged music waits for its WeChat subpackage after the unlock gesture', function () {
  // Given: the first touch happens while the music subpackage is still loading.
  const originalPlatform = globalThis.wx
  const music = new FakeInnerAudioContext()
  let loadRequest = null
  globalThis.wx = {
    loadSubpackage: function (options) { loadRequest = options },
    createInnerAudioContext: function () { return music }
  }
  const { Synth } = require('../assets/scripts/synth.ts')

  // When: audio unlocks before WeChat reports that the subpackage is ready.
  try {
    const synth = new Synth(function () { return null }, function () { return 0 })
    synth.unlock()
    assert.equal(music.playCount, 0)
    assert.equal(loadRequest.name, 'music')
    loadRequest.success()
  } finally {
    globalThis.wx = originalPlatform
  }

  // Then: the chosen track starts immediately after the package becomes available.
  assert.equal(music.src, 'music/bgm.mp3')
  assert.equal(music.playCount, 1)
})

test('WeChat build declares the soundtrack directory as a subpackage', function () {
  // Given: the release packager that copies the restored soundtrack.
  const buildSource = readFileSync(join(__dirname, '..', 'scripts', 'build-wechat.js'), 'utf8')

  // Then: it also writes the matching package declaration and entry point.
  assert.match(buildSource, /subpackages: \[\{ name: 'music', root: 'music' \}\]/)
  assert.match(buildSource, /join\(wechatOutput, 'music'\)/)
  assert.equal(readFileSync(join(__dirname, '..', 'music', 'game.js'), 'utf8'), 'module.exports = {}\n')
})

test('packaged music survives an unavailable effects audio context', function () {
  // Given: music support is present while the optional WebAudio effects factory fails.
  const originalPlatform = globalThis.wx
  const music = new FakeInnerAudioContext()
  globalThis.wx = { createInnerAudioContext: function () { return music } }
  const { Synth } = require('../assets/scripts/synth.ts')

  try {
    // When: the first gesture unlocks audio on that device.
    assert.doesNotThrow(function () {
      new Synth(function () { throw new Error('WebAudio unavailable') }, function () { return 0 }).unlock()
    })
  } finally {
    globalThis.wx = originalPlatform
  }

  // Then: packaged BGM still starts and remains the active fallback.
  assert.equal(music.src, 'music/bgm.mp3')
  assert.equal(music.loop, false)
  assert.equal(music.playCount, 1)
})

test('each launch can randomly select every restored background track', function () {
  // Given: deterministic launch rolls spanning the complete early-August soundtrack.
  const tracks = [
    'music/bgm.mp3',
    'music/grid-pressure.mp3',
    'music/grid-runner-pulse.mp3',
    'music/gravity-coin.mp3',
    'music/gravity-coin-alt.mp3'
  ]
  const values = [0, 0.2, 0.4, 0.6, 0.999]
  const originalPlatform = globalThis.wx
  const selected = []
  const { Synth } = require('../assets/scripts/synth.ts')

  // When: five fresh audio adapters unlock with those launch rolls.
  try {
    for (const value of values) {
      const music = new FakeInnerAudioContext()
      globalThis.wx = { createInnerAudioContext: function () { return music } }
      new Synth(function () { return null }, function () { return value }).unlock()
      selected.push(music.src)
    }
  } finally {
    globalThis.wx = originalPlatform
  }

  // Then: every packaged track is reachable and present as an MP3.
  assert.deepEqual(selected, tracks)
  for (const track of tracks) {
    const bytes = readFileSync(join(__dirname, '..', track))
    assert.equal(bytes.subarray(0, 3).toString('ascii'), 'ID3')
  }
})

test('music rotation falls back to a timed change when track ends are unobservable', function () {
  // Given: an unlocked track on a device exposing neither onEnded nor duration,
  // with deterministic rolls that would otherwise repeat the track.
  const originalPlatform = globalThis.wx
  const music = new FakeInnerAudioContext()
  globalThis.wx = { createInnerAudioContext: function () { return music } }
  const { Synth } = require('../assets/scripts/synth.ts')
  const synth = new Synth(function () { return null }, function () { return 0 })

  // When: the app clock crosses two one-minute boundaries.
  try {
    synth.unlock()
    synth.update(0, false)
    synth.update(59.99, false)
    const openingTrack = music.src
    synth.update(60, false)
    const secondTrack = music.src
    synth.update(120, false)

    // Then: playback rotates exactly at the boundary and never picks the current track.
    assert.equal(openingTrack, 'music/bgm.mp3')
    assert.notEqual(secondTrack, openingTrack)
    assert.notEqual(music.src, secondTrack)
    assert.equal(music.playCount, 3)
  } finally {
    globalThis.wx = originalPlatform
  }
})

test('tracks play through in full and rotate once at the natural end', function () {
  // Given: an unlocked device whose audio context reports playhead and duration.
  const originalPlatform = globalThis.wx
  const music = new FakeFullPlaybackMusicContext(30)
  globalThis.wx = { createInnerAudioContext: function () { return music } }
  const { Synth } = require('../assets/scripts/synth.ts')
  const synth = new Synth(function () { return null }, function () { return 0 })

  // When: the opening track reaches its natural end, twice in a row.
  try {
    synth.unlock()
    assert.equal(music.playCount, 1)
    const openingTrack = music.src
    music.end()
    const secondTrack = music.src

    // Then: rotation switches tracks exactly once and resets the playhead.
    assert.equal(music.playCount, 2)
    assert.notEqual(secondTrack, openingTrack)
    assert.equal(music.currentTime, 0)
    music.end()
    assert.equal(music.playCount, 2)
  } finally {
    globalThis.wx = originalPlatform
  }
})

test('duration polling rotates tracks when end callbacks are unavailable', function () {
  // Given: a device that exposes currentTime and duration but not onEnded.
  const originalPlatform = globalThis.wx
  const music = new FakeDurationOnlyMusicContext()
  globalThis.wx = { createInnerAudioContext: function () { return music } }
  const { Synth } = require('../assets/scripts/synth.ts')
  const synth = new Synth(function () { return null }, function () { return 0 })

  // When: the integrated music clock is re-anchored onto a nearly finished playhead.
  try {
    synth.unlock()
    const openingTrack = music.src
    synth.update(0, false)
    music.currentTime = 29.95
    synth.update(1, false)

    // Then: the backup poll rotates before the track can fall silent.
    assert.equal(music.playCount, 2)
    assert.notEqual(music.src, openingTrack)
    assert.equal(music.currentTime, 0)
  } finally {
    globalThis.wx = originalPlatform
  }
})

test('beat snapshots lock to the analyzed grid of the playing track', function () {
  // Given: playback of grid-pressure.mp3, whose analyzed grid is 140 BPM at 0.399s.
  const originalPlatform = globalThis.wx
  const music = new FakeFullPlaybackMusicContext(480)
  globalThis.wx = { createInnerAudioContext: function () { return music } }
  const { Synth } = require('../assets/scripts/synth.ts')
  const synth = new Synth(function () { return null }, function () { return 0 })

  // When: deterministic rolls rotate from the unmapped bgm.mp3 onto the mapped track.
  try {
    synth.unlock()
    assert.equal(synth.beatSnapshot(), null)
    music.end()
    assert.equal(music.src, 'music/grid-pressure.mp3')
    synth.update(10, false)
    music.currentTime = 10.5
    synth.update(10.6, false)

    // Then: the snapshot exposes the track's grid anchored at the observed playhead.
    const beat = synth.beatSnapshot()
    assert.ok(beat)
    const secondsPerBeat = 60 / 140
    assert.ok(Math.abs(beat.secondsPerBeat - secondsPerBeat) < 1e-9)
    const nextIndex = Math.floor((10.5 - 0.399) / secondsPerBeat) + 1
    const expectedIn = 0.399 + nextIndex * secondsPerBeat - 10.5
    assert.ok(Math.abs(beat.nextBeatIn - expectedIn) < 1e-6, `nextBeatIn ${beat.nextBeatIn} vs ${expectedIn}`)
    assert.equal(beat.nextBeatIndex - 4096, nextIndex)
  } finally {
    globalThis.wx = originalPlatform
  }
})

test('fallback metronome exposes the beat clock for rhythm spawning', function () {
  // Given: an unlocked audio context and no packaged music on this platform.
  const { Synth } = require('../assets/scripts/synth.ts')
  const context = new FakeAudioContext()
  const synth = new Synth(function () { return context })
  synth.unlock()

  // When: the metronome fires its first step and waits inside the second.
  synth.update(0, true)
  synth.update(0.1, true)

  // Then: the snapshot counts down to the next metronome step.
  const beat = synth.beatSnapshot()
  assert.ok(beat)
  assert.equal(beat.secondsPerBeat, 0.36)
  assert.ok(Math.abs(beat.nextBeatIn - 0.26) < 1e-9)
  assert.equal(beat.nextBeatIndex, 1)
})

test('beat maps stay consistent with the packaged soundtrack', function () {
  // Given: the beat maps generated by scripts/analyze-beats.js.
  const { BEATMAPS } = require('../assets/scripts/beatmaps.ts')
  const shipped = ['bgm.mp3', 'grid-pressure.mp3', 'grid-runner-pulse.mp3', 'gravity-coin.mp3', 'gravity-coin-alt.mp3']

  // Then: at least one shipped track carries a map and every map is well formed.
  const mapped = Object.keys(BEATMAPS)
  assert.ok(mapped.length >= 1, 'at least one track must carry a beat map')
  for (const name of mapped) {
    assert.ok(shipped.includes(name), `${name} is not a shipped track`)
    const beatmap = BEATMAPS[name]
    assert.ok(beatmap.bpm >= 70 && beatmap.bpm <= 180, `${name} bpm ${beatmap.bpm} out of range`)
    assert.ok(beatmap.offset >= 0 && beatmap.offset < 60 / beatmap.bpm, `${name} offset ${beatmap.offset} outside one beat`)
  }
})

test('WeChat boot loads the display font through the documented path-string API', function () {
  // Given: a base library (3.16.2+) whose wx.loadFont takes a font file path
  // and returns the family name the runtime registered the face under.
  const originalPlatform = globalThis.wx
  const loadFontCalls = []
  globalThis.wx = {
    createCanvas: function () { return new FakeWxCanvas() },
    loadFont: function (path) {
      loadFontCalls.push(path)
      return 'DingTalk JinBuTi'
    }
  }

  // When: the platform boots and a display label rasterizes.
  try {
    const { WeChatPlatform } = require('../assets/scripts/platform.ts')
    const { TextLabel } = require('../assets/scripts/text-surface.ts')
    const platform = new WeChatPlatform()
    const label = new TextLabel({ width: 200, height: 80, fontSize: 32, lineHeight: 36, outlineWidth: 2, align: 'center', display: true }, platform.createRaster)
    label.setText('几何空战')
    platform.rasterizeLabel(label)

    // Then: the font file is requested by path string, not an options object,
    // and the raster addresses the runtime-assigned family.
    assert.deepEqual(loadFontCalls, ['fonts/DingTalk-JinBuTi.ttf'])
    assert.ok(label.raster.context.font.includes("'DingTalk JinBuTi'"))
  } finally {
    globalThis.wx = originalPlatform
  }
})

test('the game boots when wx.createOffscreenCanvas is missing entirely', function () {
  // Given: the reviewer's iPhone 13 / iOS 26.5 / WeChat 8.0.75 runtime, where
  // wx.createOffscreenCanvas is not a function and only wx.createCanvas exists
  // (first call returns the on-screen canvas, later calls offscreen canvases).
  const originalPlatform = globalThis.wx
  const canvases = []
  globalThis.wx = {
    createCanvas: function () {
      const canvas = new FakeWxCanvas()
      canvases.push(canvas)
      return canvas
    }
  }

  // When: the WeChat platform boots and rasterizes a HUD label.
  try {
    const { WeChatPlatform } = require('../assets/scripts/platform.ts')
    const { TextLabel, TEXT_RASTER_SCALE } = require('../assets/scripts/text-surface.ts')
    const platform = new WeChatPlatform()
    const label = new TextLabel({ width: 200, height: 80, fontSize: 32, lineHeight: 36, outlineWidth: 2, align: 'center', monospace: true }, platform.createRaster)
    label.setText('SCORE 00000000')
    platform.rasterizeLabel(label)

    // Then: the raster comes from a later offscreen createCanvas call, keeps
    // the supersampled label size, and never aliases the on-screen GL canvas.
    assert.equal(canvases.length, 2)
    assert.equal(platform.glCanvas, canvases[0])
    assert.equal(label.raster, canvases[1])
    assert.equal(label.raster.width, Math.ceil(200 * TEXT_RASTER_SCALE))
    assert.equal(label.raster.height, Math.ceil(80 * TEXT_RASTER_SCALE))
    assert.equal(label.dirty, false)
    assert.deepEqual(label.raster.context.fills, ['SCORE 00000000'])
  } finally {
    globalThis.wx = originalPlatform
  }
})

test('the legacy argument-free offscreen canvas form is adopted and resized', function () {
  // Given: a runtime whose createOffscreenCanvas rejects the options form and
  // only returns a fixed 300x150 legacy canvas.
  const originalPlatform = globalThis.wx
  const legacy = new FakeWxCanvas()
  legacy.width = 300
  legacy.height = 150
  globalThis.wx = {
    createCanvas: function () { return new FakeWxCanvas() },
    createOffscreenCanvas: function (options) {
      if (options) throw new TypeError('legacy runtime')
      return legacy
    }
  }

  // When: a raster is requested at an exact label size.
  try {
    const { WeChatPlatform } = require('../assets/scripts/platform.ts')
    const platform = new WeChatPlatform()
    const raster = platform.createRaster(90, 45)

    // Then: the legacy canvas is reused once resized to the request.
    assert.equal(raster, legacy)
    assert.equal(legacy.width, 90)
    assert.equal(legacy.height, 45)
  } finally {
    globalThis.wx = originalPlatform
  }
})

test('the modern offscreen canvas form stays preferred when it works', function () {
  // Given: a healthy runtime providing the options form of createOffscreenCanvas.
  const originalPlatform = globalThis.wx
  let offscreenCalls = 0
  let canvasCalls = 0
  globalThis.wx = {
    createCanvas: function () { canvasCalls += 1; return new FakeWxCanvas() },
    createOffscreenCanvas: function (options) {
      offscreenCalls += 1
      const canvas = new FakeWxCanvas()
      if (options) { canvas.width = options.width; canvas.height = options.height }
      return canvas
    }
  }

  // When: the platform boots and creates one raster.
  try {
    const { WeChatPlatform } = require('../assets/scripts/platform.ts')
    const platform = new WeChatPlatform()
    const raster = platform.createRaster(60, 30)

    // Then: only the on-screen canvas plus one options-form call are made.
    assert.equal(canvasCalls, 1)
    assert.equal(offscreenCalls, 1)
    assert.equal(raster.width, 60)
    assert.equal(raster.height, 30)
  } finally {
    globalThis.wx = originalPlatform
  }
})

class FakeWxCanvas {
  constructor() {
    this.width = 0
    this.height = 0
    this.context = new FakeRasterContext()
  }

  getContext(type) {
    return type === '2d' ? this.context : null
  }
}

class FakeRasterContext {
  constructor() {
    this.font = ''
    this.textBaseline = ''
    this.textAlign = ''
    this.lineWidth = 0
    this.strokeStyle = ''
    this.fillStyle = ''
    this.fills = []
  }

  clearRect() {}

  strokeText() {}

  fillText(text) {
    this.fills.push(text)
  }
}

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

class FakeFullPlaybackMusicContext {
  constructor(duration) {
    this.loop = false
    this.autoplay = false
    this.volume = 0
    this.src = ''
    this.currentTime = 0
    this.duration = duration
    this.playCount = 0
    this.endedCallbacks = []
  }

  play() {
    this.playCount += 1
    this.currentTime = 0
  }

  onEnded(callback) {
    this.endedCallbacks.push(callback)
  }

  end() {
    this.currentTime = this.duration
    for (const callback of this.endedCallbacks) callback()
  }
}

class FakeDurationOnlyMusicContext {
  constructor() {
    this.loop = false
    this.autoplay = false
    this.volume = 0
    this.src = ''
    this.currentTime = 0
    this.duration = 30
    this.playCount = 0
  }

  play() {
    this.playCount += 1
    this.currentTime = 0
  }
}
