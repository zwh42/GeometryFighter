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
  scoreTop: 34,
  statusTop: 30,
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
  fighterGlowAlpha: 42,
  fighterOuterGlow: 7,
  fighterOuter: 2.8,
  fighterInnerGlow: 4,
  fighterInner: 1.5
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
