import { FIGHTER_ART, STROKES } from './design-tokens.ts'

export interface FighterPoint {
  readonly forward: number
  readonly side: number
}

// The hull traces the original claw ship: both arms leave the rear center,
// sweep outward, then hook inward so the two tips open forward and nearly meet.
export const FIGHTER_OUTER_PATH: readonly FighterPoint[] = [
  { forward: -9, side: 0 },
  { forward: -1, side: -6.5 },
  { forward: 6, side: -11.5 },
  { forward: 13.5, side: -12 },
  { forward: 22, side: -4 },
  { forward: 14, side: -6 },
  { forward: 2, side: -3.7 },
  { forward: -9, side: 0 },
  { forward: 2, side: 3.7 },
  { forward: 14, side: 6 },
  { forward: 22, side: 4 },
  { forward: 13.5, side: 12 },
  { forward: 6, side: 11.5 },
  { forward: -1, side: 6.5 },
  { forward: -9, side: 0 }
]

// The bright cockpit mark sits between the arms like the original core glow.
export const FIGHTER_INNER_PATH: readonly FighterPoint[] = [
  { forward: 4, side: 0 },
  { forward: 0, side: -3 },
  { forward: -4, side: 0 },
  { forward: 0, side: 3 },
  { forward: 4, side: 0 }
]

export const FIGHTER_THRUSTER_PATH: readonly FighterPoint[] = [
  { forward: -8, side: 5 },
  { forward: -19, side: 0 },
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
