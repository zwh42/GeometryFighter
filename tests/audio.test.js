const test = require('node:test')
const assert = require('node:assert/strict')
const AudioSystem = require('../js/audio')

function fakePlatform() {
  var contexts = []
  return {
    contexts: contexts,
    createInnerAudioContext: function () {
      var context = {
        autoplay: false,
        loop: false,
        src: '',
        volume: 1
      }
      contexts.push(context)
      return context
    }
  }
}

test('game startup randomly configures one of the packaged background tracks', function () {
  // Given: two fresh game launches at opposite ends of the random range
  var firstPlatform = fakePlatform()
  var secondPlatform = fakePlatform()

  // When: each launch creates its audio system
  new AudioSystem(firstPlatform, function () { return 0 })
  new AudioSystem(secondPlatform, function () { return 0.999 })

  // Then: each selected track is configured to autoplay and loop
  assert.deepEqual(
    firstPlatform.contexts.map(function (context) { return context.src }),
    ['audio/bgm.mp3']
  )
  assert.deepEqual(
    secondPlatform.contexts.map(function (context) { return context.src }),
    ['audio/grid-pressure.mp3']
  )
  assert.ok(firstPlatform.contexts[0].autoplay)
  assert.ok(firstPlatform.contexts[0].loop)
  assert.ok(secondPlatform.contexts[0].autoplay)
  assert.ok(secondPlatform.contexts[0].loop)
})
