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

test('landscape touches drive both sticks without a bomb action', function () {
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

  var actions = input.consumeActions()
  assert.equal('bomb' in actions, false)
})

test('portrait touch uses one floating movement stick across the lower playfield', function () {
  var platform = touchPlatform()
  var input = new Input(platform)
  input.resize(390, 844)

  assert.equal(input.singleHanded, true)
  assert.equal(input.left.baseX, 195)
  assert.equal(input.left.baseY, 752)

  platform.handlers.start({
    changedTouches: [{ identifier: 7, clientX: 310, clientY: 690 }]
  })
  platform.handlers.move({
    touches: [{ identifier: 7, clientX: 262, clientY: 690 }]
  })

  assert.ok(input.move.x < -0.99)
  assert.deepEqual(input.aim, { x: 0, y: 0 })
  assert.equal(input.right.active, false)

  platform.handlers.end({
    changedTouches: [{ identifier: 7, clientX: 262, clientY: 690 }]
  })
  platform.handlers.start({
    changedTouches: [{ identifier: 8, clientX: 195, clientY: 644 }]
  })
  assert.equal(input.left.active, true)
  assert.equal('bomb' in input.consumeActions(), false)
})
