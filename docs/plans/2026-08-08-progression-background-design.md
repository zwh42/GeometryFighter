# Progression Background Design

## Goal

Replace the visually dominant purple center cross with a quiet, Geometry Wars-inspired procedural field that changes whenever the player enters a new Assault wave or weapon tier.

## Design

- Keep the near-black arena, sparse stars, white/cyan boundary, combat ripples, and black-hole deformation.
- Cycle four reusable live-vector patterns: orthogonal lattice, diagonal diamond mesh, off-center elliptical orbit lines, and nested depth frames.
- Derive the pattern stage from `wave + weaponTier - 2`, so both wave completion and score-based upgrades advance the background.
- Fade the new pattern in for 800 ms. The transition is gameplay state feedback, not ambient decoration.
- Use one shared pattern contract in the standalone runtime and Cocos implementation. The shapes remain procedural and resize to the live arena.
- Keep sharp grid alpha low and glow alpha lower. The arena boundary, entities, bullets, spawn telegraphs, and HUD retain stronger strokes.

## Verification

- Unit tests prove that each wave or tier increment selects the next pattern and that the four-pattern cycle repeats.
- TypeScript and JavaScript validation remain clean.
- Fresh portrait and landscape captures cover all four patterns and a live-combat state; visual review checks that no center cross remains and threats remain dominant.
