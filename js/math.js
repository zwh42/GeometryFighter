function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function length(x, y) {
  return Math.sqrt(x * x + y * y)
}

function normalize(x, y) {
  var size = length(x, y)
  if (size < 0.0001) return { x: 0, y: 0, length: 0 }
  return { x: x / size, y: y / size, length: size }
}

function distanceSquared(a, b) {
  var dx = a.x - b.x
  var dy = a.y - b.y
  return dx * dx + dy * dy
}

function circlesOverlap(a, b) {
  var radius = a.radius + b.radius
  return distanceSquared(a, b) <= radius * radius
}

function randomRange(min, max) {
  return min + Math.random() * (max - min)
}

function randomInt(min, max) {
  return Math.floor(randomRange(min, max + 1))
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function angleDelta(from, to) {
  var delta = (to - from + Math.PI) % (Math.PI * 2) - Math.PI
  return delta < -Math.PI ? delta + Math.PI * 2 : delta
}

function directionalTargetAngle(origin, heading, targets, halfAngle, maxRange) {
  var selectedAngle = heading
  var selectedScore = Infinity
  for (var i = 0; i < targets.length; i += 1) {
    var target = targets[i]
    var dx = target.x - origin.x
    var dy = target.y - origin.y
    var distance = length(dx, dy)
    if (distance < 0.0001 || distance > maxRange) continue
    var angle = Math.atan2(dy, dx)
    var error = Math.abs(angleDelta(heading, angle))
    if (error > halfAngle) continue
    var missDistance = Math.max(0, Math.sin(error) * distance - (target.radius || 0))
    var score = missDistance + distance * 0.06
    if (score < selectedScore) {
      selectedAngle = angle
      selectedScore = score
    }
  }
  return selectedAngle
}

function difficultyAt(seconds) {
  var phase = Math.floor(seconds / 18)
  return {
    phase: phase,
    spawnInterval: clamp(2.15 - seconds * 0.012, 0.52, 2.15),
    batch: clamp(1 + Math.floor(seconds / 28), 1, 6),
    cap: clamp(12 + Math.floor(seconds * 0.48), 12, 75),
    speedScale: clamp(1 + seconds * 0.0045, 1, 1.72)
  }
}

var ASSAULT_DURATION = 18
var ASSAULT_ACTIVE_DURATION = 15.5
var ASSAULTS = [
  { key: 'swarm', label: 'SWARM', batchBonus: 2 },
  { key: 'flank', label: 'FLANK', batchBonus: 1 },
  { key: 'spiral', label: 'SPIRAL', batchBonus: 1 },
  { key: 'siege', label: 'SIEGE', batchBonus: 0 }
]

function assaultAt(seconds) {
  var safeSeconds = Math.max(0, seconds)
  var phase = Math.floor(safeSeconds / ASSAULT_DURATION)
  var profile = ASSAULTS[phase % ASSAULTS.length]
  var localTime = safeSeconds - phase * ASSAULT_DURATION
  return {
    phase: phase,
    wave: phase + 1,
    key: profile.key,
    label: profile.label,
    batchBonus: profile.batchBonus,
    active: localTime < ASSAULT_ACTIVE_DURATION,
    timeLeft: ASSAULT_DURATION - localTime
  }
}

function weaponTierForScore(score) {
  if (score >= 60000) return 4
  if (score >= 30000) return 3
  if (score >= 10000) return 2
  return 1
}

function scoreFor(base, multiplier) {
  return Math.round(base * clamp(multiplier, 1, 10))
}

function crossedThreshold(previous, current, threshold, interval) {
  if (current < threshold) return 0
  var before = previous < threshold ? -1 : Math.floor((previous - threshold) / interval)
  var after = Math.floor((current - threshold) / interval)
  return Math.max(0, after - before)
}

module.exports = {
  clamp: clamp,
  lerp: lerp,
  length: length,
  normalize: normalize,
  distanceSquared: distanceSquared,
  circlesOverlap: circlesOverlap,
  randomRange: randomRange,
  randomInt: randomInt,
  pick: pick,
  angleDelta: angleDelta,
  directionalTargetAngle: directionalTargetAngle,
  difficultyAt: difficultyAt,
  assaultAt: assaultAt,
  weaponTierForScore: weaponTierForScore,
  scoreFor: scoreFor,
  crossedThreshold: crossedThreshold
}
