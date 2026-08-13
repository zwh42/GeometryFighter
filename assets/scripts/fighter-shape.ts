import { COLORS, STROKES } from './design-tokens.ts'

export interface FighterPoint {
  readonly forward: number
  readonly side: number
}

export const FIGHTER_OUTER_PATH: readonly FighterPoint[] = [
  { forward: 18, side: -8 },
  { forward: 3, side: -13 },
  { forward: -13, side: -7 },
  { forward: -13, side: 7 },
  { forward: 3, side: 13 },
  { forward: 18, side: 8 }
]

export const FIGHTER_INNER_PATH: readonly FighterPoint[] = [
  { forward: 10, side: -3.5 },
  { forward: -4, side: -7 },
  { forward: -4, side: 7 },
  { forward: 10, side: 3.5 }
]

export const FIGHTER_HULL_COLOR = COLORS.white
export const FIGHTER_GLOW_COLOR = COLORS.cyan
export const FIGHTER_OUTER_STROKE = STROKES.fighterOuter
export const FIGHTER_INNER_STROKE = STROKES.fighterInner
export const FIGHTER_OUTER_GLOW_STROKE = STROKES.fighterOuterGlow
export const FIGHTER_INNER_GLOW_STROKE = STROKES.fighterInnerGlow
export const FIGHTER_GLOW_ALPHA = STROKES.fighterGlowAlpha
