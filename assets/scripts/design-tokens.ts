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
  // displayLineHeight must equal LAYOUT.labelHeight: the title is one line and
  // the rasterizer centers line k at (k + 0.5) * lineHeight, so only a full
  // height lineHeight puts that line at the label quad's center.
  display: 92,
  displayLineHeight: 160,
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
  defaultBottom: 78,
  defaultSide: 90
} as const

export const LAYOUT = {
  arenaInset: 8,
  scoreEdge: 28,
  hudMinimumTop: 24,
  hudSafePadding: 12,
  hudColumnGap: 16,
  titleY: 82,
  subtitleY: -42,
  promptY: -116,
  messageY: 142,
  scoreWidth: 260,
  scoreHeight: 80,
  labelWidth: 900,
  labelHeight: 160
} as const

export const COMBAT_ART_SCALE = 1.6

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
  glowWidth: 12,
  coreWidth: 2.8,
  overloadTail: 16,
  overloadGlowWidth: 18,
  overloadRailWidth: 2.2,
  overloadCoreRadius: 4.8,
  overloadRingRadius: 7.2,
  overloadRailOffset: 3.8,
  overloadRailLength: 12,
  bulletGlow: '#ffef49',
  missileGlow: '#ff892a',
  overloadGlow: COLORS.cyan,
  overloadCore: COLORS.white,
  overloadAccent: COLORS.magenta,
  core: '#fffdd7'
} as const

// The homing missile reads as a real missile: slender fuselage with a rounded
// nose cone, swept tail fins, a flickering exhaust flame, and a fading smoke
// contrail — never as an arrow shaft with a head.
export const MISSILE_ART = {
  hull: '#fff3df',
  glow: PROJECTILE_ART.missileGlow,
  flame: '#ff7a1f',
  flameCore: '#ffe9a8',
  hullStroke: 1.8,
  glowStroke: 11,
  noseForward: 11,
  noseShoulderForward: 8.4,
  noseShoulderSide: 1.5,
  bodyForward: 5.2,
  bodySide: 2.4,
  tailForward: -8.2,
  tailSide: 2.4,
  capForward: -9.4,
  capSide: 1.3,
  finRootForward: -4.6,
  finRootSide: 2.3,
  finTipForward: -10.2,
  finTipSide: 5.4,
  finTrailForward: -8.4,
  finTrailSide: 2.1,
  nozzleForward: -8.6,
  nozzleSide: 1.9,
  flameBaseForward: -9.8,
  flameBaseSide: 1.8,
  flameCoreSide: 0.9,
  flameLength: 7.5,
  flameFlicker: 3.2,
  flameCoreLength: 4.4,
  contrailStart: 14,
  contrailSpan: 22,
  contrailSegments: 4,
  contrailWidth: 2.4,
  contrailSway: 1.6
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

export const GEOM_ART = {
  core: '#d8ff7a',
  glow: '#a6ff4d',
  radius: 5.4,
  glowWidth: 9,
  coreWidth: 1.6,
  glowAlpha: 55
} as const
