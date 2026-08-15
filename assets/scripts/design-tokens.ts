export const COLORS = {
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
} as const

export const TYPOGRAPHY = {
  display: 74,
  displayLineHeight: 72,
  hudPrimary: 23,
  hudSecondary: 18,
  subtitle: 22,
  prompt: 20,
  message: 32,
  lineHeightExtra: 4,
  outlineWidth: 2
} as const

export const TOUCH = {
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
  defaultSide: 90
} as const

export const LAYOUT = {
  arenaInset: 8,
  scoreEdge: 16,
  hudMinimumTop: 18,
  hudSafePadding: 8,
  titleY: 82,
  subtitleY: -42,
  promptY: -116,
  messageY: 142,
  scoreWidth: 260,
  scoreHeight: 80,
  labelWidth: 900,
  labelHeight: 160
} as const

export const STROKES = {
  gridGlow: 7,
  gridBoundaryGlow: 14,
  gridMain: 1.15,
  gridBoundary: 2.2,
  particleGlow: 3.2,
  rippleGlow: 16,
  rippleMain: 2.4,
  bulletGlow: 12,
  bulletMain: 2.8,
  enemyGlow: 12,
  enemyMain: 2.4,
  control: 1.4,
  controlRing: 2,
  fighterGlowAlpha: 66,
  fighterOuterGlow: 13,
  fighterOuter: 2.6,
  fighterInnerGlow: 8,
  fighterInner: 1.4
} as const

export interface GridLineStyle {
  readonly lineWidth: number
  readonly color: string
  readonly alpha: number
}

export const GRID_LINES = {
  glow: { lineWidth: STROKES.gridGlow, color: COLORS.gridHot, alpha: 23 },
  main: { lineWidth: STROKES.gridMain, color: COLORS.gridHot, alpha: 72 }
} as const satisfies Record<string, GridLineStyle>

export const FIGHTER_ART = {
  hull: '#e8ffff',
  glow: '#5cebff',
  thruster: '#5dffba'
} as const

export const PROJECTILE_ART = {
  bulletTail: 20,
  missileTail: 30,
  glowWidth: 12,
  coreWidth: 2.8,
  missileRadius: 7,
  bulletGlow: '#ffef49',
  missileGlow: '#ff892a',
  core: '#fffdd7',
  missileCore: '#fffce2'
} as const

export const ALLY_ART = {
  glow: '#43f6ff',
  glowAlpha: 62,
  core: '#b0ffff',
  glowWidth: 10,
  coreWidth: 1.8,
  coreRadius: 5.5,
  nose: 12,
  wingForward: 3,
  wingSide: 7,
  tailForward: -7,
  tailSide: 4
} as const

export const SUPER_WEAPON_ART = {
  glow: '#bcff49',
  glowAlpha: 68,
  core: '#dbff95',
  icon: '#f5ffe0',
  iconGlowAlpha: 62,
  radius: 22,
  glowWidth: 13,
  coreWidth: 2.2,
  shellPadding: 4,
  orbitInset: 3,
  orbitGap: 6,
  rayStart: 8,
  rayEnd: 16,
  durabilityOrbit: 8,
  durabilityRadius: 2,
  detonationSpokes: 6,
  detonationInner: 3,
  detonationOuter: 11,
  alliesRadius: 9,
  iconRadius: 2.6
} as const

export const ENEMY_ART_RADIUS = {
  wanderer: 9,
  grunt: 13,
  weaver: 14,
  spinner: 15,
  snake: 15,
  repulsar: 18,
  blackhole: 26
} as const

export const ENEMY_ART_COLOR = {
  wanderer: '#9d61ff',
  grunt: '#43f6ff',
  weaver: '#73ff80',
  spinner: '#ff48ed',
  snake: '#ffe45c',
  repulsar: '#ff9f2f',
  blackhole: '#ff506d'
} as const

export const SUPER_EVENT_ART = {
  detonation: '#ff6d77',
  overload: '#fff36a',
  allies: '#43f6ff'
} as const
