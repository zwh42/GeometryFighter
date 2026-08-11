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

test('enemy breaches schedule their next arrival on a music beat', function () {
  // Given: an active assault is ready to spawn and music supplies beat-aligned delays.
  var game = new GeometryGame(fakePlatform(), { width: 0, height: 0 }, {})
  game.resize(390, 844, 2)
  game.startRound()
  game.elapsed = 1
  game.lastPhase = 0
  game.spawnTimer = 0
  game.supplyTimer = 99
  game.random = function () { return 0 }
  var requestedDelays = []
  game.audio.nextBeatDelay = function (minimumDelay) {
    requestedDelays.push(minimumDelay)
    return 0.625
  }

  // When: the assault spawner releases an enemy group.
  game.updateSpawner(0)

  // Then: its following group is scheduled by the music clock.
  assert.ok(game.enemies.length > 0)
  assert.ok(requestedDelays[0] > 0)
  assert.equal(game.spawnTimer, 0.625)
})
