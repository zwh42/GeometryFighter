const test = require('node:test')
const assert = require('node:assert/strict')
const background = require('../js/background-pattern')

test('every wave and weapon upgrade advances the background pattern', function () {
  // Given the first Assault wave and its first weapon tier.
  var first = background.patternForProgress(1, 1)

  // When either the wave or weapon tier advances.
  var nextWave = background.patternForProgress(2, 1)
  var nextTier = background.patternForProgress(2, 2)

  // Then each progression event selects the next quiet grid-world pattern.
  assert.equal(first, 'lattice')
  assert.equal(nextWave, 'diamond')
  assert.equal(nextTier, 'orbit')
  assert.equal(background.patternForProgress(4, 1), 'depth')
  assert.equal(background.patternForProgress(5, 1), 'lattice')
})

test('background patterns produce distinct bounded vector paths', function () {
  // Given a portrait arena matching the standalone runtime inset.
  var bounds = { width: 360, height: 814, spacing: 58, sampleStep: 12 }
  var patterns = ['lattice', 'diamond', 'orbit', 'depth']

  // When every progression pattern builds its live vector geometry.
  var pathSets = patterns.map(function (pattern) {
    return background.buildBackgroundPaths(pattern, bounds)
  })

  // Then each result is non-empty, stays inside the arena, and has a distinct signature.
  var signatures = pathSets.map(function (paths) {
    assert.ok(paths.length >= 4)
    for (var pathIndex = 0; pathIndex < paths.length; pathIndex += 1) {
      var path = paths[pathIndex]
      assert.ok(path.length >= 2)
      for (var pointIndex = 0; pointIndex < path.length; pointIndex += 1) {
        assert.ok(Math.abs(path[pointIndex].x) <= bounds.width * 0.5 + 0.001)
        assert.ok(Math.abs(path[pointIndex].y) <= bounds.height * 0.5 + 0.001)
      }
    }
    return paths.length + ':' + paths.reduce(function (total, path) { return total + path.length }, 0)
  })
  assert.equal(new Set(signatures).size, patterns.length)
})
