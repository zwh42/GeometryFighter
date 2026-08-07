# Original Fighter Fidelity Design

## Target

Make the controllable fighter immediately read like the original *Geometry Wars: Retro Evolved* ship in both Canvas and Cocos runtimes, while retaining Geometry Fighter's live vector rendering and cyan glow system.

## Reference anatomy

The original-release description and gameplay capture agree on one defining construction: two nested hexagons, each missing its forward side. The open ends face the firing direction and turn an otherwise neutral hexagon into a white claw.

## Options considered

1. **Long arrow with swept wings**: strong heading readability, but reads like a generic aircraft and overstates details absent from the original.
2. **Twin open hexagons**: closest to the documented and visible original structure; remains legible at small mobile scale. Selected.
3. **Detailed cockpit and engine assembly**: visually rich, but conflicts with the original's minimal vector grammar and overlaps enemy complexity.

## Rendering contract

- Outer hull: six-point open path, from upper muzzle prong around the closed rear to lower muzzle prong.
- Inner hull: four-point inset open path following the same direction.
- Surface: white strokes, cyan bounded glow, no fill and no `closePath`.
- Thrust: existing velocity trail only; no permanent flame attached to the hull.
- Rotation: both paths face the current player firing angle.
- Parity: Canvas and Cocos use the same local proportions and vertex order.

## Verification

- Renderer test asserts the two path vertex counts and absence of closed paths.
- TypeScript checks and Cocos build guard the native implementation.
- Fresh portrait and landscape screenshots from both runtimes are compared against the saved original-release reference crop.
