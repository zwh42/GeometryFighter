import { FIGHTER_ART, STROKES } from './design-tokens.ts'

export interface FighterPoint {
  readonly forward: number
  readonly side: number
}

export const FIGHTER_OUTER_PATH: readonly FighterPoint[] = [
  { forward: 19, side: -10 },
  { forward: 7, side: -5 },
  { forward: 1, side: -12 },
  { forward: -12, side: -10 },
  { forward: -5, side: 0 },
  { forward: -12, side: 10 },
  { forward: 1, side: 12 },
  { forward: 7, side: 5 },
  { forward: 19, side: 10 }
]

export const FIGHTER_INNER_PATH: readonly FighterPoint[] = [
  { forward: 7, side: -5 },
  { forward: -5, side: 0 },
  { forward: 7, side: 5 }
]

export const FIGHTER_THRUSTER_PATH: readonly FighterPoint[] = [
  { forward: -8, side: 5 },
  { forward: -18, side: 0 },
  { forward: -8, side: -5 }
]

export const FIGHTER_HULL_COLOR = FIGHTER_ART.hull
export const FIGHTER_GLOW_COLOR = FIGHTER_ART.glow
export const FIGHTER_THRUSTER_COLOR = FIGHTER_ART.thruster
export const FIGHTER_OUTER_STROKE = STROKES.fighterOuter
export const FIGHTER_INNER_STROKE = STROKES.fighterInner
export const FIGHTER_OUTER_GLOW_STROKE = STROKES.fighterOuterGlow
export const FIGHTER_INNER_GLOW_STROKE = STROKES.fighterInnerGlow
export const FIGHTER_GLOW_ALPHA = STROKES.fighterGlowAlpha
