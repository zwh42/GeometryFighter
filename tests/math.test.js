const test = require('node:test')
const assert = require('node:assert/strict')
const math = require('../js/math')

test('normalize preserves direction and handles zero', function () {
  var value = math.normalize(3, 4)
  assert.equal(value.length, 5)
  assert.equal(value.x, 0.6)
  assert.equal(value.y, 0.8)
  assert.deepEqual(math.normalize(0, 0), { x: 0, y: 0, length: 0 })
})

test('difficulty ramps while respecting mobile-safe caps', function () {
  var early = math.difficultyAt(0)
  var late = math.difficultyAt(300)
  assert.equal(early.batch, 1)
  assert.ok(late.batch > early.batch)
  assert.ok(late.spawnInterval < early.spawnInterval)
  assert.equal(late.cap, 75)
  assert.ok(late.speedScale <= 1.72)
})

test('weapon upgrades and threshold rewards are deterministic', function () {
  assert.equal(math.weaponTierForScore(9999), 1)
  assert.equal(math.weaponTierForScore(10000), 2)
  assert.equal(math.weaponTierForScore(60000), 4)
  assert.equal(math.crossedThreshold(74000, 76000, 75000, 75000), 1)
  assert.equal(math.crossedThreshold(74000, 151000, 75000, 75000), 2)
  assert.equal(math.crossedThreshold(80000, 90000, 100000, 100000), 0)
})

test('score multiplier is clamped at the arcade maximum', function () {
  assert.equal(math.scoreFor(100, 3), 300)
  assert.equal(math.scoreFor(100, 99), 1000)
})
