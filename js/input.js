const math = require('./math')
const config = require('./config')

class Input {
  constructor(platform) {
    this.platform = platform
    this.width = 0
    this.height = 0
    this.singleHanded = false
    this.move = { x: 0, y: 0 }
    this.aim = { x: 0, y: 0 }
    this.left = this.createStick('move')
    this.right = this.createStick('aim')
    this.keys = {}
    this.startPressed = false
    this.bombPressed = false
    this.pausePressed = false
    this.firstGesture = false
    this.bind()
  }

  createStick(kind) {
    return {
      kind: kind,
      id: null,
      active: false,
      baseX: 0,
      baseY: 0,
      knobX: 0,
      knobY: 0
    }
  }

  resize(width, height) {
    this.width = width
    this.height = height
    this.singleHanded = height >= width
    if (this.singleHanded && this.right.active) this.releaseStick(this.right)
    if (!this.left.active) {
      this.left.baseX = this.singleHanded ? width * 0.5 : config.TOUCH.defaultSide
      this.left.baseY = height - config.TOUCH.defaultBottom
      this.left.knobX = this.left.baseX
      this.left.knobY = this.left.baseY
    }
    if (!this.right.active) {
      this.right.baseX = width - config.TOUCH.defaultSide
      this.right.baseY = height - config.TOUCH.defaultBottom
      this.right.knobX = this.right.baseX
      this.right.knobY = this.right.baseY
    }
    this.syncVectors()
  }

  bind() {
    var self = this
    this.platform.onTouchStart(function (event) { self.onTouchStart(event) })
    this.platform.onTouchMove(function (event) { self.onTouchMove(event) })
    this.platform.onTouchEnd(function (event) { self.onTouchEnd(event) })
    if (this.platform.onTouchCancel) {
      this.platform.onTouchCancel(function (event) { self.onTouchEnd(event) })
    }
    if (this.platform.onKeyDown) {
      this.platform.onKeyDown(function (event) { self.onKey(event, true) })
      this.platform.onKeyUp(function (event) { self.onKey(event, false) })
    }
  }

  touchPoint(touch) {
    return {
      id: touch.identifier,
      x: touch.clientX === undefined ? touch.x : touch.clientX,
      y: touch.clientY === undefined ? touch.y : touch.clientY
    }
  }

  onTouchStart(event) {
    this.firstGesture = true
    this.startPressed = true
    var touches = event.changedTouches || event.touches || []
    for (var i = 0; i < touches.length; i += 1) {
      var point = this.touchPoint(touches[i])
      var bombX = this.singleHanded ? this.width - config.TOUCH.bombOffset : this.width * 0.5
      var bombY = this.height - config.TOUCH.bombOffset
      if (math.length(point.x - bombX, point.y - bombY) < config.TOUCH.bombHitRadius) {
        this.bombPressed = true
      } else if (this.singleHanded) {
        if (point.y >= this.height * config.TOUCH.portraitActivationYRatio && !this.left.active) this.activateStick(this.left, point)
      } else if (point.x < this.width * 0.5 && !this.left.active) {
        this.activateStick(this.left, point)
      } else if (!this.right.active) {
        this.activateStick(this.right, point)
      }
    }
    this.syncVectors()
  }

  activateStick(stick, point) {
    stick.id = point.id
    stick.active = true
    stick.baseX = point.x
    stick.baseY = point.y
    stick.knobX = point.x
    stick.knobY = point.y
  }

  onTouchMove(event) {
    var touches = event.touches || event.changedTouches || []
    for (var i = 0; i < touches.length; i += 1) {
      var point = this.touchPoint(touches[i])
      this.moveStick(this.left, point)
      this.moveStick(this.right, point)
    }
    this.syncVectors()
  }

  moveStick(stick, point) {
    if (!stick.active || stick.id !== point.id) return
    var dx = point.x - stick.baseX
    var dy = point.y - stick.baseY
    var direction = math.normalize(dx, dy)
    var reach = Math.min(config.TOUCH.travel, direction.length)
    stick.knobX = stick.baseX + direction.x * reach
    stick.knobY = stick.baseY + direction.y * reach
  }

  onTouchEnd(event) {
    var touches = event.changedTouches || []
    for (var i = 0; i < touches.length; i += 1) {
      var point = this.touchPoint(touches[i])
      if (this.left.id === point.id) this.releaseStick(this.left)
      if (this.right.id === point.id) this.releaseStick(this.right)
    }
    this.syncVectors()
  }

  releaseStick(stick) {
    stick.id = null
    stick.active = false
    stick.knobX = stick.baseX
    stick.knobY = stick.baseY
  }

  vectorFor(stick) {
    if (!stick.active) return { x: 0, y: 0 }
    var direction = math.normalize(stick.knobX - stick.baseX, stick.knobY - stick.baseY)
    var strength = math.clamp((direction.length - config.TOUCH.deadZone) / config.TOUCH.responseSpan, 0, 1)
    return { x: direction.x * strength, y: direction.y * strength }
  }

  syncVectors() {
    var leftVector = this.vectorFor(this.left)
    var rightVector = this.vectorFor(this.right)
    this.move.x = leftVector.x
    this.move.y = leftVector.y
    this.aim.x = rightVector.x
    this.aim.y = rightVector.y
  }

  onKey(event, down) {
    var key = String(event.key || event.code || '').toLowerCase()
    this.keys[key] = down
    if (down && (key === ' ' || key === 'space' || key === 'spacebar')) this.bombPressed = true
    if (down && (key === 'enter' || key === 'return')) this.startPressed = true
    if (down && (key === 'escape' || key === 'p')) this.pausePressed = true
  }

  updateKeyboard() {
    var x = (this.keys.d || this.keys.arrowright ? 1 : 0) - (this.keys.a || this.keys.arrowleft ? 1 : 0)
    var y = (this.keys.s || this.keys.arrowdown ? 1 : 0) - (this.keys.w || this.keys.arrowup ? 1 : 0)
    if (x || y) {
      var move = math.normalize(x, y)
      this.move.x = move.x
      this.move.y = move.y
    }
    var ax = (this.keys.l ? 1 : 0) - (this.keys.j ? 1 : 0)
    var ay = (this.keys.k ? 1 : 0) - (this.keys.i ? 1 : 0)
    if (ax || ay) {
      var aim = math.normalize(ax, ay)
      this.aim.x = aim.x
      this.aim.y = aim.y
    }
  }

  consumeActions() {
    var actions = {
      start: this.startPressed,
      bomb: this.bombPressed,
      pause: this.pausePressed,
      firstGesture: this.firstGesture
    }
    this.startPressed = false
    this.bombPressed = false
    this.pausePressed = false
    this.firstGesture = false
    return actions
  }
}

module.exports = Input
