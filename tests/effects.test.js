const test = require('node:test')
const assert = require('node:assert/strict')
const effects = require('../js/effects')

test('expired particle objects are reused instead of allocated again', function () {
  // Given a particle that has completed its lifetime.
  var particles = new effects.ParticleSystem()
  particles.add(0, 0, 0, 0, '#fff', 0.01, 1, 1)
  var expired = particles.items[0]
  particles.update(0.02, [])
  assert.equal(particles.items.length, 0)

  // When another particle is emitted.
  particles.add(1, 1, 0, 0, '#fff', 1, 1, 1)

  // Then the hot effect loop recycles the existing object.
  assert.equal(particles.items[0], expired)
})

test('grid distortion reuses its output point across render samples', function () {
  // Given a reactive grid field.
  var grid = new effects.GridField()

  // When two adjacent line samples are distorted.
  var first = grid.distort(10, 20, [])
  var second = grid.distort(22, 20, [])

  // Then the renderer receives one reusable point instead of per-sample garbage.
  assert.equal(first, second)
})
