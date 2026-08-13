const test = require('node:test')
const assert = require('node:assert/strict')
const GeometryGame = require('../js/game')

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

function touchPlatform() {
  var handlers = {}
  return {
    handlers: handlers,
    onTouchStart: function (handler) { handlers.start = handler },
    onTouchMove: function (handler) { handlers.move = handler },
    onTouchEnd: function (handler) { handlers.end = handler },
    onTouchCancel: function (handler) { handlers.cancel = handler },
    onHide: function () {},
    getStorageSync: function () { return 0 },
    setStorageSync: function () {}
  }
}

test('a round supports shooting, scoring, bombing and life loss', function () {
  var game = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, {})
  game.resize(800, 450, 2)
  game.startRound()
  assert.equal(game.state, 'playing')
  assert.equal(game.lives, 3)
  assert.equal(game.bombs, 3)

  game.fireWeapon()
  assert.equal(game.bullets.length, 1)

  var enemy = game.spawnEnemy('grunt', game.player.x + 40, game.player.y)
  enemy.spawn = 0
  game.bullets[0].x = enemy.x
  game.bullets[0].y = enemy.y
  game.resolveCollisions()
  assert.equal(enemy.dead, true)
  assert.equal(game.score, 100)
  assert.equal(game.totalKills, 1)

  game.spawnEnemy('weaver', 100, 100).spawn = 0
  game.useBomb()
  assert.equal(game.bombs, 2)
  assert.ok(game.enemies.every(function (item) { return item.dead }))

  game.player.invulnerable = 0
  game.loseLife()
  assert.equal(game.lives, 2)
  assert.ok(game.player.deadTimer > 0)
  assert.equal(game.multiplier, 1)
})

test('the full enemy roster can be instantiated for wave progression', function () {
  var game = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, {})
  game.resize(800, 450, 1)
  game.startRound()
  var types = ['wanderer', 'grunt', 'weaver', 'spinner', 'snake', 'repulsar', 'blackhole']
  for (var i = 0; i < types.length; i += 1) game.spawnEnemy(types[i])
  assert.deepEqual(game.enemies.map(function (enemy) { return enemy.type }), types)
  assert.equal(game.enemies[4].segments.length, 9)
  assert.equal(game.blackholes.length, 1)
})

test('one portrait thumb moves and fires along the same drag direction', function () {
  // Given: an active portrait round controlled by one lower-screen touch.
  var platform = touchPlatform()
  var game = new GeometryGame(platform, { width: 0, height: 0 }, {})
  game.resize(390, 844, 1)
  game.startRound()
  platform.handlers.start({
    changedTouches: [{ identifier: 4, clientX: 90, clientY: 640 }]
  })
  platform.handlers.move({
    touches: [{ identifier: 4, clientX: 138, clientY: 640 }]
  })

  // When: the player update consumes that one-thumb gesture.
  game.player.fireTimer = 0
  game.updatePlayer(0.016)

  // Then: the ship moves right and emits a right-facing volley without a second thumb.
  assert.ok(game.player.vx > 0)
  assert.equal(game.bullets.length, 1)
  assert.ok(Math.abs(game.bullets[0].angle) < 1e-9)

  // When: the thumb returns to center without lifting.
  platform.handlers.move({
    touches: [{ identifier: 4, clientX: 90, clientY: 640 }]
  })
  game.player.fireTimer = 0
  game.updatePlayer(0.016)

  // Then: movement stops while the remembered right-facing heading keeps firing.
  assert.deepEqual(game.input.move, { x: 0, y: 0 })
  assert.equal(game.bullets.length, 2)
  assert.ok(Math.abs(game.bullets[1].angle) < 1e-9)

  // When: the controlling thumb is released.
  platform.handlers.end({
    changedTouches: [{ identifier: 4, clientX: 90, clientY: 640 }]
  })
  game.player.fireTimer = 0
  game.updatePlayer(0.016)

  // Then: the retained heading clears and no new volley is emitted.
  assert.equal(game.bullets.length, 2)
  assert.equal(game.hasFireHeading, false)
})
