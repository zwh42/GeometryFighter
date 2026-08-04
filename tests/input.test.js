const test = require('node:test')
const assert = require('node:assert/strict')
const Input = require('../js/input')

function touchPlatform() {
  var handlers = {}
  return {
    handlers: handlers,
    onTouchStart: function (handler) { handlers.start = handler },
    onTouchMove: function (handler) { handlers.move = handler },
    onTouchEnd: function (handler) { handlers.end = handler },
    onTouchCancel: function (handler) { handlers.cancel = handler }
  }
}

test('touches drive both sticks and the central bomb action', function () {
  var platform = touchPlatform()
  var input = new Input(platform)
  input.resize(800, 450)

  platform.handlers.start({
    changedTouches: [
      { identifier: 1, clientX: 100, clientY: 300 },
      { identifier: 2, clientX: 700, clientY: 300 }
    ]
  })
  platform.handlers.move({
    touches: [
      { identifier: 1, clientX: 148, clientY: 300 },
      { identifier: 2, clientX: 700, clientY: 252 }
    ]
  })

  assert.ok(input.move.x > 0.99)
  assert.ok(input.aim.y < -0.99)
  assert.equal(input.consumeActions().start, true)

  platform.handlers.end({
    changedTouches: [
      { identifier: 1, clientX: 148, clientY: 300 },
      { identifier: 2, clientX: 700, clientY: 252 }
    ]
  })
  assert.deepEqual(input.move, { x: 0, y: 0 })
  assert.deepEqual(input.aim, { x: 0, y: 0 })

  platform.handlers.start({
    changedTouches: [{ identifier: 3, clientX: 400, clientY: 410 }]
  })
  assert.equal(input.consumeActions().bomb, true)
})
