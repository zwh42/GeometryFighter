'use strict'

var PATTERNS = ['lattice', 'diamond', 'orbit', 'depth']

function patternForProgress(wave, weaponTier) {
  var stage = Math.max(0, Math.floor(wave) - 1) + Math.max(0, Math.floor(weaponTier) - 1)
  return PATTERNS[stage % PATTERNS.length]
}

function sampleSegment(start, end, sampleStep) {
  var distance = Math.hypot(end.x - start.x, end.y - start.y)
  var segments = Math.max(1, Math.ceil(distance / sampleStep))
  var points = []
  for (var index = 0; index <= segments; index += 1) {
    var progress = index / segments
    points.push({
      x: start.x + (end.x - start.x) * progress,
      y: start.y + (end.y - start.y) * progress
    })
  }
  return points
}

function samplePolyline(vertices, sampleStep, closed) {
  var points = []
  var edgeCount = closed ? vertices.length : vertices.length - 1
  for (var edge = 0; edge < edgeCount; edge += 1) {
    var segment = sampleSegment(vertices[edge], vertices[(edge + 1) % vertices.length], sampleStep)
    for (var pointIndex = edge === 0 ? 0 : 1; pointIndex < segment.length; pointIndex += 1) {
      points.push(segment[pointIndex])
    }
  }
  return points
}

function buildLattice(bounds) {
  var paths = []
  var halfWidth = bounds.width * 0.5
  var halfHeight = bounds.height * 0.5
  for (var x = -halfWidth + bounds.spacing * 0.5; x < halfWidth; x += bounds.spacing) {
    paths.push(sampleSegment({ x: x, y: -halfHeight }, { x: x, y: halfHeight }, bounds.sampleStep))
  }
  for (var y = -halfHeight + bounds.spacing * 0.5; y < halfHeight; y += bounds.spacing) {
    paths.push(sampleSegment({ x: -halfWidth, y: y }, { x: halfWidth, y: y }, bounds.sampleStep))
  }
  return paths
}

function diagonalEndpoints(offset, slope, halfWidth, halfHeight) {
  var candidates = []
  var leftY = slope * -halfWidth + offset
  var rightY = slope * halfWidth + offset
  var bottomX = (-halfHeight - offset) / slope
  var topX = (halfHeight - offset) / slope
  if (Math.abs(leftY) <= halfHeight) candidates.push({ x: -halfWidth, y: leftY })
  if (Math.abs(rightY) <= halfHeight) candidates.push({ x: halfWidth, y: rightY })
  if (Math.abs(bottomX) < halfWidth) candidates.push({ x: bottomX, y: -halfHeight })
  if (Math.abs(topX) < halfWidth) candidates.push({ x: topX, y: halfHeight })
  return candidates.length >= 2 ? [candidates[0], candidates[1]] : null
}

function buildDiamond(bounds) {
  var paths = []
  var halfWidth = bounds.width * 0.5
  var halfHeight = bounds.height * 0.5
  var span = halfWidth + halfHeight
  for (var slope = -1; slope <= 1; slope += 2) {
    for (var offset = -span + bounds.spacing * 0.5; offset < span; offset += bounds.spacing) {
      var endpoints = diagonalEndpoints(offset, slope, halfWidth, halfHeight)
      if (endpoints) paths.push(sampleSegment(endpoints[0], endpoints[1], bounds.sampleStep))
    }
  }
  return paths
}

function buildOrbit(bounds) {
  var paths = []
  var halfWidth = bounds.width * 0.5
  var halfHeight = bounds.height * 0.5
  var center = { x: halfWidth * 0.24, y: -halfHeight * 0.12 }
  var radiusX = halfWidth - Math.abs(center.x)
  var radiusY = halfHeight - Math.abs(center.y)
  for (var ring = 1; ring <= 6; ring += 1) {
    var points = []
    var scale = ring / 6
    var circumference = Math.PI * 2 * Math.sqrt((radiusX * radiusX + radiusY * radiusY) * 0.5) * scale
    var segments = Math.max(32, Math.ceil(circumference / bounds.sampleStep))
    for (var index = 0; index <= segments; index += 1) {
      var angle = index / segments * Math.PI * 2
      points.push({
        x: center.x + Math.cos(angle) * radiusX * scale,
        y: center.y + Math.sin(angle) * radiusY * scale
      })
    }
    paths.push(points)
  }
  return paths
}

function buildDepth(bounds) {
  var paths = []
  var halfWidth = bounds.width * 0.5
  var halfHeight = bounds.height * 0.5
  var frameCorners = []
  for (var frame = 0; frame < 6; frame += 1) {
    var scale = 1 - frame * 0.13
    var offsetY = -halfHeight * frame * 0.018
    var corners = [
      { x: -halfWidth * scale, y: -halfHeight * scale + offsetY },
      { x: halfWidth * scale, y: -halfHeight * scale + offsetY },
      { x: halfWidth * scale, y: halfHeight * scale + offsetY },
      { x: -halfWidth * scale, y: halfHeight * scale + offsetY }
    ]
    frameCorners.push(corners)
    paths.push(samplePolyline(corners, bounds.sampleStep, true))
  }
  for (var corner = 0; corner < 4; corner += 1) {
    paths.push(sampleSegment(frameCorners[0][corner], frameCorners[5][corner], bounds.sampleStep))
  }
  return paths
}

function buildBackgroundPaths(pattern, bounds) {
  if (pattern === 'lattice') return buildLattice(bounds)
  if (pattern === 'diamond') return buildDiamond(bounds)
  if (pattern === 'orbit') return buildOrbit(bounds)
  return buildDepth(bounds)
}

module.exports = {
  PATTERNS: PATTERNS,
  patternForProgress: patternForProgress,
  buildBackgroundPaths: buildBackgroundPaths
}
