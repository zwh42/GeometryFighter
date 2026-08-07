const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

function loadTypeScriptModule(relativePath) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  loaded._compile(output, filename)
  return loaded.exports
}

const { TouchControls, controlBounds } = loadTypeScriptModule('assets/scripts/touch-controls.ts')
const { GeometryWorld } = loadTypeScriptModule('assets/scripts/simulation.ts')
const fighterShape = loadTypeScriptModule('assets/scripts/fighter-shape.ts')

test('Cocos fighter geometry preserves the original open-claw proportions', function () {
  // Given the tokenized outer and inner player hulls.
  const outer = fighterShape.FIGHTER_OUTER_PATH
  const inner = fighterShape.FIGHTER_INNER_PATH

  // When their physical bounds and forward openings are inspected.
  const forwardValues = outer.map(function (point) { return point.forward })
  const sideValues = outer.map(function (point) { return point.side })

  // Then the six/four paths remain open, white-dominant, and 31 by 26 pixels.
  assert.equal(outer.length, 6)
  assert.equal(inner.length, 4)
  assert.equal(Math.max.apply(null, forwardValues) - Math.min.apply(null, forwardValues), 31)
  assert.equal(Math.max.apply(null, sideValues) - Math.min.apply(null, sideValues), 26)
  assert.deepEqual(outer[0], { forward: 18, side: -8 })
  assert.deepEqual(outer[outer.length - 1], { forward: 18, side: 8 })
  assert.deepEqual(inner[0], { forward: 10, side: -3.5 })
  assert.deepEqual(inner[inner.length - 1], { forward: 10, side: 3.5 })
  assert.equal(fighterShape.FIGHTER_HULL_COLOR, '#ffffff')
  assert.equal(fighterShape.FIGHTER_GLOW_COLOR, '#42efff')
  assert.ok(fighterShape.FIGHTER_OUTER_STROKE > fighterShape.FIGHTER_INNER_STROKE)
  assert.ok(fighterShape.FIGHTER_OUTER_GLOW_STROKE < 8)
})

test('Cocos landscape touches drive movement and aim sticks independently', function () {
  const controls = new TouchControls()
  controls.resize(800, 450)

  // Given two touches on opposite sides of the landscape playfield.
  controls.start({ id: 1, x: -300, y: -120 })
  controls.start({ id: 2, x: 300, y: -120 })

  // When each touch moves in a different direction.
  controls.move({ id: 1, x: -242, y: -120 })
  controls.move({ id: 2, x: 300, y: -62 })
  const active = controls.vectors()

  // Then the left stick moves and the right stick aims without coupling them.
  assert.ok(active.move.x > 0.99)
  assert.ok(active.aim.y > 0.99)
  assert.equal(active.engaged, true)

  controls.end(1)
  controls.end(2)
  assert.deepEqual(controls.vectors(), {
    move: { x: 0, y: 0 },
    aim: { x: 0, y: 0 },
    engaged: false
  })
})

test('Cocos portrait touch keeps the right half inside the one-stick contract', function () {
  const controls = new TouchControls()
  controls.resize(390, 844)

  // Given a portrait touch that starts in the lower-right playfield.
  controls.start({ id: 7, x: 115, y: -154 })

  // When the player drags left.
  controls.move({ id: 7, x: 57, y: -154 })
  const active = controls.vectors()

  // Then that one stick controls movement and never exposes a second aim vector.
  assert.ok(active.move.x < -0.99)
  assert.deepEqual(active.aim, { x: 0, y: 0 })
  assert.equal(controls.right.active, false)
})

test('Cocos stick response stays in physical pixels after design-resolution scaling', function () {
  const controls = new TouchControls()
  const unitsPerPixel = 720 / 280
  controls.resize(720, 1530, unitsPerPixel)

  // Given a 48-pixel-equivalent drag in the scaled Cocos coordinate space.
  controls.start({ id: 9, x: 0, y: -300 })
  controls.move({ id: 9, x: 48 * unitsPerPixel, y: -300 })

  // When the scaled stick vector is sampled.
  const active = controls.vectors()

  // Then the same physical gesture saturates exactly like the Canvas stick.
  assert.ok(active.move.x > 0.99)
  assert.equal(controls.left.knob.x, 48 * unitsPerPixel)
})

test('Cocos landscape controls stay inside the physical canvas height', function () {
  // Given a landscape canvas whose world keeps extra vertical design space.
  const bounds = controlBounds(800, 595, 800, 450, 1)

  // When the visible control boundary is resolved.
  const baseY = -bounds.halfHeight + 74

  // Then a 48-pixel stick retains a safe bottom margin instead of using the hidden world edge.
  assert.equal(bounds.halfHeight, 225)
  assert.equal(baseY, -151)
  assert.equal(baseY - 48, -199)
  assert.ok(baseY - 48 > -bounds.halfHeight)
})

test('Cocos player volleys mirror the Canvas launch layouts and projectile tuning', function () {
  const world = new GeometryWorld()
  world.score = 10000

  // Given weapon tier two and a horizontal firing heading.
  world.fire(0)

  // When the parallel volley is created.
  const parallelVolley = world.bullets.slice()
  world.bullets.length = 0
  world.score = 60000
  world.fire(0)

  // Then tier two uses side offsets and tier four uses the same four-angle fan as Canvas.
  assert.equal(parallelVolley.length, 2)
  assert.deepEqual(parallelVolley.map(function (bullet) { return bullet.angle }), [0, 0])
  assert.deepEqual(parallelVolley.map(function (bullet) { return bullet.y }), [-4.5, 4.5])
  assert.equal(parallelVolley[0].vx, 570)
  assert.equal(parallelVolley[0].radius, 2.8)
  assert.equal(parallelVolley[0].life, 1.25)
  assert.deepEqual(world.bullets.map(function (bullet) { return bullet.angle }), [-0.15, -0.045, 0.045, 0.15])
})
