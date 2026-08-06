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
  return {
    calls: calls,
    save: function () {},
    restore: function () {},
    translate: function () {},
    rotate: function () {},
    scale: function () {},
    beginPath: function () { currentShape = '' },
    moveTo: function () { currentShape = 'line' },
    lineTo: function () { currentShape = 'line' },
    quadraticCurveTo: function () { currentShape = 'line' },
    closePath: function () { calls.push({ kind: 'closePath' }) },
    arc: function () { currentShape = 'arc' },
    stroke: function () { calls.push({ kind: currentShape === 'arc' ? 'strokeArc' : 'strokePath' }) },
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

test('the player is rendered as an open Geometry Wars claw silhouette', function () {
  // Given the active player fighter.
  var context = recordingContext()
  var game = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, context)
  game.resize(390, 844, 2)
  game.player.invulnerable = 0

  // When its vector silhouette is drawn.
  game.renderer.drawPlayer(game.player, 1)

  // Then the hull remains open instead of becoming an enemy-like closed polygon.
  assert.equal(context.calls.filter(function (call) { return call.kind === 'closePath' }).length, 0)
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
