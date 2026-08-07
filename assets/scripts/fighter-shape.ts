export interface FighterPoint {
  forward: number
  side: number
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

export const FIGHTER_HULL_COLOR = '#ffffff'
export const FIGHTER_GLOW_COLOR = '#42efff'
export const FIGHTER_OUTER_STROKE = 2.8
export const FIGHTER_INNER_STROKE = 1.5
export const FIGHTER_OUTER_GLOW_STROKE = 7
export const FIGHTER_INNER_GLOW_STROKE = 4
export const FIGHTER_GLOW_ALPHA = 42
