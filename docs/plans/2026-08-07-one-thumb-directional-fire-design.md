# One-thumb directional fire design

## Problem

Directly binding projectile heading to every movement-vector change makes portrait play twitchy and forces the same thumb to choose between dodging and maintaining an exact firing line. Full auto-targeting would be easier, but would remove the directional intent requested for the default weapon.

## Compared patterns

- **Archero pause-to-fire**: excellent one-hand clarity, but fully stationary auto-aim is too passive for a continuous arena shooter.
- **Survivor.io direction-linked weapons**: preserves player direction, but needs tolerance and direction memory to feel reliable on a small floating stick.
- **Geometry Wars 3 / PewPew twin stick**: highest precision, but requires a second thumb and consumes too much portrait playfield.

## Selected interaction

Use one draggable floating stick. A deliberate drag controls movement and updates a smoothed firing heading. Once a heading exists, returning to center stops the ship while the held touch continues fire in that remembered direction. Each volley can correct its launch angle to one live target inside a narrow forward sector; the projectile never changes course afterward. Touch release stops fire.

## Acceptance boundaries

- A target behind or outside the sector cannot affect the shot.
- A target inside the sector can affect only the launch angle, not an in-flight bullet.
- Center hold keeps firing only after the player has supplied a direction during the current round.
- The visible sector and tutorial copy explain the interaction without remaining on screen after onboarding.
- Landscape twin-stick behavior remains unchanged.
