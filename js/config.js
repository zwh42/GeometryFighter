const COLORS = {
  background: '#000006',
  grid: '#2a7190',
  gridHot: '#15d8ff',
  white: '#ffffff',
  hud: '#b9ff36',
  cyan: '#42efff',
  green: '#4dff67',
  magenta: '#ff48ed',
  violet: '#9d61ff',
  yellow: '#ffe45c',
  orange: '#ff9f2f',
  red: '#ff554d'
}

const WORLD = {
  margin: 15,
  gridSize: 30,
  maxBullets: 180,
  maxEnemies: 75,
  maxParticles: 720,
  playerSpeed: 245,
  bulletSpeed: 570,
  fireRate: 0.105,
  aimInputThreshold: 0.18,
  aimHeadingResponse: 14,
  aimAssistHalfAngle: Math.PI * 26 / 180,
  aimAssistRangeRatio: 0.62
}

const TYPOGRAPHY = {
  popup: { size: 13, weight: 'bold', family: 'monospace' },
  hudLabel: { size: 13, weight: 'bold', family: 'monospace' },
  hudValue: { size: 22, weight: 'bold', family: 'monospace' },
  hudMultiplier: { size: 15, weight: 'bold', family: 'monospace' },
  message: { size: 20, weight: 'bold', family: 'monospace' },
  controlLabel: { size: 10, weight: 'bold', family: 'monospace' },
  pauseTitle: { size: 34, weight: 'bold', family: 'monospace' },
  body: { size: 14, weight: 'normal', family: 'sans-serif' },
  bodyCompact: { size: 13, weight: 'normal', family: 'sans-serif' },
  title: { minSize: 30, maxSize: 54, weight: 'bold', family: 'monospace' },
  subtitle: { size: 13, weight: 'bold', family: 'monospace' },
  prompt: { size: 16, weight: 'bold', family: 'monospace' },
  gameOverTitle: { size: 38, weight: 'bold', family: 'monospace' },
  gameOverScore: { size: 18, weight: 'bold', family: 'monospace' },
  gameOverPrompt: { size: 15, weight: 'bold', family: 'monospace' }
}

const TOUCH = {
  travel: 48,
  ringRadius: 48,
  knobRadius: 17,
  deadZone: 7,
  responseSpan: 35,
  sectorRadius: 66,
  headingRay: 58,
  bombRadius: 28,
  bombHitRadius: 36,
  bombOffset: 58,
  defaultBottom: 78,
  defaultSide: 90,
  portraitActivationYRatio: 0.5,
  stickStroke: 1.4,
  stickGlow: 7,
  sectorStroke: 1,
  sectorGlow: 5,
  bombStroke: 1.5,
  bombGlow: 8
}

const FIGHTER = {
  outerPath: [[18, -8], [3, -13], [-13, -7], [-13, 7], [3, 13], [18, 8]],
  innerPath: [[10, -3.5], [-4, -7], [-4, 7], [10, 3.5]],
  outerStroke: 2.8,
  innerStroke: 1.5,
  glowBlur: 7
}

const ENEMY = {
  wanderer: { radius: 11, speed: 62, hp: 1, score: 50, color: COLORS.violet },
  grunt: { radius: 12, speed: 74, hp: 1, score: 100, color: COLORS.cyan },
  weaver: { radius: 12, speed: 84, hp: 1, score: 150, color: COLORS.green },
  spinner: { radius: 13, speed: 68, hp: 2, score: 200, color: COLORS.magenta },
  snake: { radius: 10, speed: 88, hp: 3, score: 300, color: COLORS.yellow },
  repulsar: { radius: 15, speed: 56, hp: 4, score: 500, color: COLORS.orange },
  blackhole: { radius: 18, speed: 18, hp: 14, score: 1000, color: COLORS.red }
}

module.exports = {
  COLORS: COLORS,
  WORLD: WORLD,
  TYPOGRAPHY: TYPOGRAPHY,
  TOUCH: TOUCH,
  FIGHTER: FIGHTER,
  ENEMY: ENEMY
}
