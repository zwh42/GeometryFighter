const GeometryGame = require('./game')

var screenCanvas = typeof canvas !== 'undefined' ? canvas : wx.createCanvas()
var context = screenCanvas.getContext('2d')
var game = new GeometryGame(wx, screenCanvas, context)

function windowInfo() {
  if (wx.getWindowInfo) return wx.getWindowInfo()
  return wx.getSystemInfoSync()
}

function resize() {
  var info = windowInfo()
  var width = info.windowWidth || info.screenWidth
  var height = info.windowHeight || info.screenHeight
  game.resize(width, height, info.pixelRatio || 1, info.safeArea)
}

resize()
if (wx.onWindowResize) {
  wx.onWindowResize(function () { resize() })
}
if (wx.setPreferredFramesPerSecond) wx.setPreferredFramesPerSecond(60)

if (typeof GameGlobal !== 'undefined') {
  GameGlobal.geometryGame = game
}
if (typeof globalThis !== 'undefined') globalThis.geometryGame = game
wx.geometryGame = game

var lastTime = Date.now()
var requestFrame = screenCanvas.requestAnimationFrame ? screenCanvas.requestAnimationFrame.bind(screenCanvas) : requestAnimationFrame

function loop(timestamp) {
  var now = typeof timestamp === 'number' ? timestamp : Date.now()
  var dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000))
  lastTime = now
  game.frame(dt)
  requestFrame(loop)
}

requestFrame(loop)

module.exports = game
