const COLORS = {
  background: '#01040c',
  grid: '#173b98',
  gridHot: '#476dff',
  white: '#f7ffff',
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
  maxParticles: 1300,
  playerSpeed: 245,
  bulletSpeed: 570,
  fireRate: 0.105
}

const ENEMY = {
  wanderer: { radius: 11, speed: 62, hp: 1, score: 50, color: COLORS.cyan },
  grunt: { radius: 12, speed: 74, hp: 1, score: 100, color: COLORS.magenta },
  weaver: { radius: 12, speed: 84, hp: 1, score: 150, color: COLORS.green },
  spinner: { radius: 13, speed: 68, hp: 2, score: 200, color: COLORS.violet },
  snake: { radius: 10, speed: 88, hp: 3, score: 300, color: COLORS.yellow },
  repulsar: { radius: 15, speed: 56, hp: 4, score: 500, color: COLORS.red },
  blackhole: { radius: 18, speed: 18, hp: 14, score: 1000, color: COLORS.red }
}

module.exports = {
  COLORS: COLORS,
  WORLD: WORLD,
  ENEMY: ENEMY
}
