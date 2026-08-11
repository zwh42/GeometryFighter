const test = require('node:test')
const assert = require('node:assert/strict')
const AudioSystem = require('../js/audio')

function fakePlatform(completeLoad) {
  var contexts = []
  var loadRequests = []
  return {
    contexts: contexts,
    loadRequests: loadRequests,
    loadSubpackage: function (options) {
      loadRequests.push(options)
      if (completeLoad) options.success()
    },
    createInnerAudioContext: function () {
      var context = {
        autoplay: false,
        loop: false,
        src: '',
        volume: 1,
        currentTime: 0,
        playCount: 0,
        play: function () { this.playCount += 1 }
      }
      contexts.push(context)
      return context
    }
  }
}

test('game startup randomly configures every packaged background track', function () {
  // Given: fresh launches spanning the full random range.
  var values = [0, 0.2, 0.4, 0.6, 0.999]
  var platforms = values.map(function () { return fakePlatform(true) })

  // When: each launch creates its audio system.
  values.forEach(function (value, index) {
    new AudioSystem(platforms[index], function () { return value })
  })

  // Then: all five distinct tracks are selected and configured to loop.
  assert.deepEqual(
    platforms.map(function (platform) { return platform.contexts[0].src }),
    [
      'music/bgm.mp3',
      'music/grid-pressure.mp3',
      'music/grid-runner-pulse.mp3',
      'music/gravity-coin.mp3',
      'music/gravity-coin-alt.mp3'
    ]
  )
  assert.ok(platforms.every(function (platform) { return platform.loadRequests.length === 1 }))
  assert.ok(platforms.every(function (platform) { return platform.contexts[0].autoplay }))
  assert.ok(platforms.every(function (platform) { return platform.contexts[0].loop }))
})

test('music waits for its package and honors an earlier unlock gesture', function () {
  // Given: the music package is still loading when the player first touches the game.
  var platform = fakePlatform(false)
  var audio = new AudioSystem(platform, function () { return 0 })

  // When: audio is unlocked before the package finishes loading.
  audio.unlock()
  platform.loadRequests[0].success()

  // Then: the selected track starts as soon as its package is available.
  assert.equal(platform.contexts.length, 1)
  assert.equal(platform.contexts[0].playCount, 1)
})

test('spawn delays land on the selected music beat without accelerating difficulty', function () {
  // Given: music is already playing between two beats.
  var platform = fakePlatform(true)
  var audio = new AudioSystem(platform, function () { return 0 })
  platform.contexts[0].currentTime = 1.1

  // When: the game requests its next spawn no earlier than 0.8 seconds away.
  var delay = audio.nextBeatDelay(0.8, 99)
  var beatPosition = (platform.contexts[0].currentTime + delay - audio.beatOffset) / audio.beatDuration

  // Then: the delay is rounded forward to a beat and never shortened.
  assert.ok(delay >= 0.8)
  assert.ok(delay < 0.8 + audio.beatDuration)
  assert.ok(Math.abs(beatPosition - Math.round(beatPosition)) < 0.000001)
})
