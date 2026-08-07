# PewPew-Inspired Assault Refresh

## Goal

Move Geometry Fighter closer to the clean, frantic vector-shooter feel of PewPew without copying its assets, screens, or individual modes. Preserve the existing portrait single-hand control, enemy roster, scoring, supplies, and super weapons.

## Chosen Direction

The refresh uses an Assault director instead of a new mode menu. A run cycles through four 18-second directives: SWARM adds light enemies in larger groups, FLANK favors fast darts and weaving approaches, SPIRAL favors orbiters and rotating threats, and SIEGE introduces durable, splitting, and repulsing targets. Reinforcements stop during the final 2.5 seconds of each wave, although surviving enemies remain active. This gives the continuous survival run recognizable phrases without interrupting it with modal transitions.

Each batch shares an arena edge and is distributed along that edge. Enemies remain non-collidable during a short arrival phase, shown by two segmented rings and four rotating ticks. The HUD exposes wave number, directive, and remaining time as compact telemetry.

## Visual System

The arena shifts to near-black with a wider, dimmer magenta grid and brighter center guides. Star density and glow weight are reduced so entity outlines carry the visual hierarchy. Enemies remain original procedural silhouettes, but their surfaces are transparent and their sharp pass uses thinner strokes. Cyan, magenta, green, violet, yellow, orange, and red still encode behavior families.

## Runtime Parity

The standalone WeChat Canvas runtime and the Cocos Creator runtime implement the same wave duration, active/recovery split, directive order, batch bonus, HUD telemetry, grouped edge arrival, and telegraph grammar. Their existing coordinate systems and balance constants remain separate.

## Verification

- Unit tests cover directive rotation, recovery timing, grouped edge spawns, and segmented arrival rings.
- JavaScript syntax and TypeScript compilation must pass.
- Manual QA must observe the title treatment, first SWARM group, recovery pause, FLANK transition, wave telemetry, and visible arrival telegraphs on a portrait gameplay surface.
