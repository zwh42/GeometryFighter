const COLORS = {
  background: '#000006',
  grid: '#4a1046',
  gridHot: '#15d8ff',
  white: '#ffffff',
  hud: '#b9ff36',
  hudFill: 'rgba(185, 255, 54, 0.08)',
  cyan: '#42efff',
  cyanFill: 'rgba(66, 239, 255, 0.15)',
  green: '#4dff67',
  magenta: '#ff48ed',
  violet: '#9d61ff',
  yellow: '#ffe45c',
  orange: '#ff9f2f',
  red: '#ff554d'
}

const WORLD = {
  margin: 15,
  gridSize: 46,
  maxBullets: 320,
  maxEnemies: 75,
  maxParticles: 1300,
  playerSpeed: 245,
  bulletSpeed: 570,
  fireRate: 0.105,
  aimInputThreshold: 0.18,
  aimHeadingResponse: 14,
  aimAssistHalfAngle: Math.PI * 26 / 180,
  aimAssistRangeRatio: 0.62,
  missileDuration: 5,
  missileSpeed: 460,
  missileTurnRate: 5.4,
  supplyHits: 8,
  supplyIntervalMin: 18,
  supplyIntervalMax: 28,
  overloadDuration: 8,
  overloadFireRate: 0.042,
  allyDuration: 12,
  maxAllies: 5,
  tutorialHold: 3.5,
  tutorialDuration: 4.5
}

const HUD = {
  portraitTop: 18,
  landscapeTop: 24,
  safeGap: 8,
  statusOffset: 50,
  messageOffset: 68
}

const ENEMY = {
  wanderer: { radius: 11, speed: 62, hp: 1, score: 50, color: COLORS.violet },
  grunt: { radius: 12, speed: 74, hp: 1, score: 100, color: COLORS.cyan },
  weaver: { radius: 12, speed: 84, hp: 1, score: 150, color: COLORS.green },
  spinner: { radius: 13, speed: 68, hp: 2, score: 200, color: COLORS.magenta },
  snake: { radius: 10, speed: 88, hp: 3, score: 300, color: COLORS.yellow },
  repulsar: { radius: 15, speed: 56, hp: 4, score: 500, color: COLORS.orange },
  blackhole: { radius: 18, speed: 18, hp: 14, score: 1000, color: COLORS.red },
  dart: { radius: 9, speed: 126, hp: 1, score: 180, color: COLORS.orange },
  orbiter: { radius: 12, speed: 82, hp: 2, score: 240, color: COLORS.violet },
  crusher: { radius: 17, speed: 48, hp: 7, score: 650, color: COLORS.red },
  splitter: { radius: 15, speed: 64, hp: 3, score: 420, color: COLORS.magenta },
  shard: { radius: 6, speed: 132, hp: 1, score: 60, color: COLORS.magenta }
}

module.exports = {
  COLORS: COLORS,
  WORLD: WORLD,
  HUD: HUD,
  ENEMY: ENEMY
}
