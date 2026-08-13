const test = require('node:test')
const assert = require('node:assert/strict')
const Input = require('../js/input')
const config = require('../js/config')

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

test('portrait touch uses one floating stick from either side of the lower screen', function () {
  // Given: a portrait playfield and one thumb starting on the lower-right side.
  var platform = touchPlatform()
  var input = new Input(platform)
  input.resize(390, 844)
  platform.handlers.start({
    changedTouches: [{ identifier: 7, clientX: 300, clientY: 640 }]
  })

  // When: that thumb drags left.
  platform.handlers.move({
    touches: [{ identifier: 7, clientX: 252, clientY: 640 }]
  })

  // Then: it is the only movement stick; no right-hand aim stick is activated.
  assert.equal(input.singleHanded, true)
  assert.ok(input.move.x < -0.99)
  assert.deepEqual(input.aim, { x: 0, y: 0 })
  assert.equal(input.right.active, false)
})

test('touch interaction geometry reads its shared standalone tokens', function () {
  // Given: intentionally distinct control-token values.
  var platform = touchPlatform()
  var input = new Input(platform)
  var original = Object.assign({}, config.TOUCH)
  Object.assign(config.TOUCH, {
    defaultSide: 91,
    defaultBottom: 83,
    bombOffset: 47,
    bombHitRadius: 19,
    travel: 29,
    deadZone: 5,
    responseSpan: 22
  })

  try {
    // When: the landscape controls are laid out, dragged, and the bomb is tapped.
    input.resize(800, 450)
    platform.handlers.start({ changedTouches: [{ identifier: 9, clientX: 400, clientY: 403 }] })
    platform.handlers.start({ changedTouches: [{ identifier: 10, clientX: 91, clientY: 367 }] })
    platform.handlers.move({ touches: [{ identifier: 10, clientX: 140, clientY: 367 }] })

    // Then: layout, hit testing, travel, and response all follow the shared tokens.
    assert.equal(input.left.baseX, config.TOUCH.defaultSide)
    assert.equal(input.left.baseY, 450 - config.TOUCH.defaultBottom)
    assert.equal(input.consumeActions().bomb, true)
    assert.equal(input.left.knobX - input.left.baseX, config.TOUCH.travel)
    assert.equal(input.vectorFor(input.left).x, 1)
  } finally {
    Object.assign(config.TOUCH, original)
  }
})
