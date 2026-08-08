const test = require('node:test')
const assert = require('node:assert/strict')
const GeometryGame = require('../js/game')
const config = require('../js/config')

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

function recordingContext() {
  var calls = []
  var currentShape = ''
  var currentPointCount = 0
  var currentPoints = []
  return {
    calls: calls,
    save: function () {},
    restore: function () {},
    translate: function () {},
    rotate: function () {},
    scale: function () {},
    beginPath: function () {
      currentShape = ''
      currentPointCount = 0
      currentPoints = []
    },
    moveTo: function (x, y) {
      currentShape = 'line'
      currentPointCount += 1
      currentPoints.push({ x: x, y: y })
    },
    lineTo: function (x, y) {
      currentShape = 'line'
      currentPointCount += 1
      currentPoints.push({ x: x, y: y })
    },
    quadraticCurveTo: function () { currentShape = 'line' },
    closePath: function () { calls.push({ kind: 'closePath' }) },
    arc: function () { currentShape = 'arc' },
    stroke: function () {
      calls.push({
        kind: currentShape === 'arc' ? 'strokeArc' : 'strokePath',
        alpha: this.globalAlpha,
        pointCount: currentPointCount,
        points: currentPoints.slice()
      })
    },
    fill: function () {},
    strokeRect: function () { calls.push({ kind: 'strokeRect' }) },
    fillText: function (text, x, y) { calls.push({ text: text, x: x, y: y }) }
  }
}

test('portrait HUD starts below the device safe area', function () {
  // Given a Dynamic Island-sized top inset.
  var context = recordingContext()
  var game = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, context)
  game.resize(390, 844, 2, { top: 59 })
  game.message = 'SUPPLY INBOUND'
  game.messageTimer = 1

  // When the live HUD is rendered.
  game.renderer.drawHud(game)

  // Then telemetry begins below the inset and messages clear the HUD band.
  var score = context.calls.find(function (call) { return call.text === 'SCORE' })
  var special = context.calls.find(function (call) { return call.text && call.text.indexOf('SUPER ') === 0 })
  var message = context.calls.find(function (call) { return call.text === 'SUPPLY INBOUND' })
  assert.equal(score.y, 67)
  assert.equal(special.y, 117)
  assert.equal(message.y, 135)
})

test('portrait gameplay guidance fades out after the opening seconds', function () {
  // Given a newly started portrait round.
  var context = recordingContext()
  var game = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, context)
  game.resize(390, 844, 2)
  game.startRound()

  // When touch controls are rendered at the beginning and at the exact cutoff.
  game.renderer.drawControls(game)
  var visibleAtStart = context.calls.some(function (call) {
    return call.text && call.text.indexOf('单指移动') >= 0
  })
  context.calls.length = 0
  game.elapsed = config.WORLD.tutorialDuration
  game.renderer.drawControls(game)

  // Then guidance is initially visible but no longer remains at the cutoff.
  assert.equal(visibleAtStart, true)
  assert.equal(context.calls.some(function (call) {
    return call.text && call.text.indexOf('单指移动') >= 0
  }), false)
})

test('landscape combat message clears the status telemetry row', function () {
  // Given a live landscape round with a wave announcement.
  var context = recordingContext()
  var game = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, context)
  game.resize(800, 450, 1)
  game.startRound()
  game.message = 'ASSAULT 01 // SWARM'
  game.messageTimer = 1

  // When the HUD is rendered.
  game.renderer.drawHud(game)
  var status = context.calls.find(function (call) { return call.text && call.text.indexOf('SUPER ') === 0 })
  var message = context.calls.find(function (call) { return call.text === 'ASSAULT 01 // SWARM' })

  // Then the two text bands retain a readable vertical gap.
  assert.ok(message.y - status.y >= 18)
})

test('active portrait controls expose the remembered firing sector', function () {
  // Given a held floating stick with an established heading.
  var context = recordingContext()
  var game = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, context)
  game.resize(390, 844, 2)
  game.startRound()
  game.input.left.active = true
  game.hasFireHeading = true
  game.fireHeading = 0

  // When the live controls are rendered.
  game.renderer.drawControls(game)

  // Then the two stick circles gain a third arc that exposes the firing sector.
  assert.ok(context.calls.filter(function (call) { return call.kind === 'strokeArc' }).length >= 3)
})

test('progression backgrounds fade in below combat stroke emphasis', function () {
  // Given a live wave whose background pattern has just changed.
  var context = recordingContext()
  var game = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, context)
  game.resize(390, 844, 1)
  game.startRound()
  game.flash = 0
  game.time = 8
  game.score = 10000

  // When the new weapon tier is rendered at its start and midpoint.
  game.renderer.drawGrid(game)
  var startStrokes = context.calls.filter(function (call) { return call.kind === 'strokePath' })
  context.calls.length = 0
  game.time = 8.4
  game.renderer.drawGrid(game)
  var midpointStrokes = context.calls.filter(function (call) { return call.kind === 'strokePath' })

  // Then the pattern begins invisible and remains below the resting 0.16 alpha ceiling.
  assert.ok(startStrokes.length > 0)
  assert.ok(startStrokes.every(function (call) { return call.alpha === 0 }))
  assert.ok(midpointStrokes.every(function (call) { return call.alpha > 0 && call.alpha < 0.16 }))
})

test('the player is rendered as two nested open Geometry Wars hexagons', function () {
  // Given the active player fighter.
  var context = recordingContext()
  var game = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, context)
  game.resize(390, 844, 2)
  game.player.invulnerable = 0

  // When its vector silhouette is drawn.
  game.renderer.drawPlayer(game.player, 1)

  // Then the outer six-vertex claw and inset four-vertex claw remain open.
  assert.equal(context.calls.filter(function (call) { return call.kind === 'closePath' }).length, 0)
  var hulls = context.calls.filter(function (call) {
    return call.kind === 'strokePath'
  })
  assert.deepEqual(hulls.map(function (call) {
    return call.pointCount
  }), [6, 4])
  assert.deepEqual(hulls[0].points, [
    { x: 18, y: -8 },
    { x: 3, y: -13 },
    { x: -13, y: -7 },
    { x: -13, y: 7 },
    { x: 3, y: 13 },
    { x: 18, y: 8 }
  ])
  assert.deepEqual(hulls[1].points, [
    { x: 10, y: -3.5 },
    { x: -4, y: -7 },
    { x: -4, y: 7 },
    { x: 10, y: 3.5 }
  ])
})

test('super supplies use stroked orbital rings that enemies do not use', function () {
  // Given a live super supply.
  var context = recordingContext()
  var game = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, context)
  game.resize(390, 844, 2)
  game.startRound()
  var supply = game.spawnSupply(120, 180, 'overload')
  supply.spawn = 0

  // When the pickup is rendered.
  game.renderer.drawSupplies(game.supplies, 1)

  // Then concentric orbital strokes give it a non-enemy beacon silhouette.
  assert.ok(context.calls.filter(function (call) { return call.kind === 'strokeArc' }).length >= 2)
})

test('enemy arrivals use segmented targeting rings before becoming dangerous', function () {
  var context = recordingContext()
  var game = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, context)
  game.resize(390, 844, 2)
  game.startRound()
  var enemy = game.spawnEnemy('grunt', 120, 180)

  game.renderer.drawSpawnTelegraph(enemy, 1)

  assert.ok(context.calls.filter(function (call) { return call.kind === 'strokeArc' }).length >= 2)
})
