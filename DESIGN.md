# Geometry Fighter Design System

## 0. Reference Study

- The official [Steam release page](https://store.steampowered.com/app/8400/Geometry_Wars_Retro_Evolved/) establishes the dark reactive grid, white open-claw player, short gold projectile streams, and silhouette-first enemy readability.
- GameSpot's original-release visual analysis describes that player ship more precisely as two nested hexagons with the forward side removed. That observable construction, also visible in its gameplay capture, is the fighter-shape contract used below rather than a generic arrowhead.
- The official [Xbox store listing](https://www.xbox.com/en-us/games/store/geometry-wars-evolved/bp5g8k2m71pm) and its gameplay art confirm the core color families: cyan diamonds, green framed cubes, magenta crossed boxes, violet pinwheels, gold segmented snakes, and red/orange black-hole rings.
- The official [PewPew App Store listing](https://apps.apple.com/us/app/pewpew/id314964252) identifies its defining traits as multidirectional shooting, large enemy counts, five rule-driven modes, and sustained high frame rate. Its screenshots establish a cleaner pure-black field, thin luminous vector outlines, sparse magenta guides, grouped danger, and minimal telemetry.
- The official [PewPew Live site](https://pewpew.live/) reinforces fast, diversified play and retro-futurist vector graphics. Geometry Fighter borrows those high-level principles through original silhouettes, Assault pacing, and telegraphed edge formations; it does not reproduce PewPew assets, level layouts, or interface composition.
- Activision's official [Geometry Wars 3 iOS support page](https://support.activision.com/geometry-wars-3-dimensions/articles/geometry-wars-3-dimensions-for-ios) documents draggable, free, and fixed touch-stick layouts. Portrait therefore keeps a draggable floating stick instead of forcing the thumb to reach a fixed corner.
- Apple's [Archero developer story](https://apps.apple.com/hk/story/id1476782679?l=en-GB) records that its team selected pause-to-fire after iteration because it made moving, shooting, and evading possible with one hand. Geometry Fighter adopts the useful part of that finding: returning the thumb to the stick center stops movement but preserves the last deliberate firing heading.
- Apple's [Survivor.io guide](https://apps.apple.com/ph/iphone/story/id1641743438) distinguishes auto-targeting weapons from shotgun, sword, and bat attacks that follow movement direction. Geometry Fighter uses that directional contract for the default weapon and reserves continuous homing for temporary missiles and allies.
- PewPew Live's official App Store description calls out twin-stick precision. Landscape retains that model; portrait intentionally trades independent aim for a remembered directional sector so one thumb remains sufficient.

## 1. Atmosphere & Identity

Geometry Fighter is a dark neon arcade instrument: a near-black arena, electrically lit geometry, and concise telemetry should make every threat and reward readable at a glance. Its signature is the luminous grid reacting physically to combat through distortion, pulses, trails, and shockwaves.

## 2. Color

| Role | Token | Value | Usage |
|---|---|---:|---|
| Arena | `background` | `#000006` | Primary playfield |
| Grid | `grid` | `#2a7190` | Sparse resting grid lines |
| Grid energy | `gridHot` | `#15d8ff` | Distortion and strong grid feedback |
| Primary light | `white` | `#ffffff` | Player hull, borders, high-emphasis text |
| Reward / HUD | `hud` | `#b9ff36` | Score, supply, positive reward |
| Reward fill | `hudFill` | `rgba(185, 255, 54, 0.08)` | Translucent supply surface |
| Friendly | `cyan` | `#42efff` | Player systems, allies, ally fire |
| Friendly fill | `cyanFill` | `rgba(66, 239, 255, 0.15)` | Translucent ally surface |
| Enemy / hot | `magenta` | `#ff48ed` | Enemy identity and distortion |
| Success | `green` | `#4dff67` | Enemy variants and positive state |
| Exotic | `violet` | `#9d61ff` | Advanced enemies and level state |
| Projectile | `yellow` | `#ffe45c` | Standard player fire |
| Missile / charge | `orange` | `#ff9f2f` | Homing missiles and high-speed enemy tells |
| Danger | `red` | `#ff554d` | Black holes, damage, collapse |

Colors are centralized in `assets/scripts/design-tokens.ts`. Alpha variants may be derived for fills and glow, but semantic hues must come from this table.

Typography, touch geometry, and fighter primitives follow the same rule: Cocos consumes the typed token modules under `assets/scripts/`.

## 3. Typography

| Level | Size | Weight | Usage |
|---|---:|---:|---|
| Display | 30–74 px responsive | 700 | Title and game-over state |
| HUD value | 18–23 px | 700 | Score and primary telemetry |
| Message | 20–32 px | 700 | Timed combat state |
| Label | 10–15 px | 700 | HUD labels and controls |
| Body | 13–14 px | 400 | Chinese instructions and summaries |

- Telemetry and arcade titles: `monospace`.
- Chinese instructions: system `sans-serif`.
- HUD text stays short enough to remain on one line at 390 px portrait width; temporary weapon telemetry may use a second line in Cocos.

## 4. Spacing & Layout

- Base unit: 4 px.
- Arena inset: 8 px in Cocos design space.
- Portrait HUD edge: 20 px; landscape HUD edge: 28 px.
- Portrait HUD top: `max(18 px, safe-area top + 8 px)`; temporary combat messages begin 68 px below that anchor. Cocos applies the same rule in design-resolution units through `sys.getSafeAreaRect()`.
- The single movement control occupies the lower playfield; the lower-middle region remains clear so supply telemetry cannot be mistaken for a button.
- The renderer scales to the full viewport and uses centered world coordinates.
- Responsive targets: 390 × 844 portrait, 720 × 1280 design portrait, and 800 × 450 landscape developer mode.

## 5. Components

### Reactive Grid

- **Structure**: sparse star field, one low-contrast procedural grid pattern, and a luminous boundary. The background never adds an emphasized center axis.
- **Patterns**: progression cycles through `LATTICE`, `DIAMOND`, `ORBIT`, and `DEPTH`. Each remains a recognizable grid-world surface rather than an illustrated backdrop: orthogonal mesh, diagonal mesh, off-center elliptical field lines, and nested perspective frames.
- **States**: rest, progression swap, pulse, shockwave, and black-hole distortion. The active pattern index advances on every Assault wave and every weapon-tier upgrade.
- **Motion**: simulation-driven deformation remains continuous. A new progression pattern fades in over 800 ms so the swap reads as state feedback without flashing behind combat.
- **Accessibility**: the boundary remains white and readable without relying on glow. Resting pattern opacity stays below enemy fills, telegraphs, projectiles, and HUD strokes so background detail cannot mask a threat.

### Fighter

- **Variants**: player (white/cyan), ally (smaller cyan).
- **Player structure**: two concentric white open hexagons point toward the firing direction. The outer hull owns six vertices from the upper muzzle prong around the closed rear to the lower muzzle prong; the inset hull owns four vertices and repeats the same open-front claw. Neither hull closes, fills, gains a cockpit, or adds aircraft-like wings.
- **Physical scale**: the player hull is approximately 31 × 26 physical pixels with 2.2–2.8 px primary strokes. The cyan under-glow stays at or below 7 px with low alpha so the white claw remains dominant. Cocos converts those values through the current view scale so its 720-unit design canvas does not shrink the fighter on narrow phones.
- **States**: active, invulnerable flicker, destroyed, ally expiring.
- **Motion**: player velocity trail carries thrust feedback without adding a permanent tail flame to the original-style hull; allies orbit smoothly and aim independently.
- **Accessibility**: the player's paired open fronts point in the firing direction and remain distinct from every closed enemy polygon; allies retain their smaller circular-chevron silhouette so they cannot be mistaken for the player.

### Projectile

- **Variants**: standard yellow bolt, orange-white homing missile, cyan ally bolt.
- **States**: flight, curved pursuit, impact, boundary impact.
- **Motion**: missiles use bounded angular steering so course changes are visible and interruptible rather than snapping to a target.
- **Accessibility**: color, width, tail length, and missile silhouette all distinguish variants.

### Super Supply

- **Structure**: large circular orbital beacon, counter-rotating broken rings, effect-specific white core mark, four cardinal rays, and eight durability pips. Enemy silhouettes do not use this complete grammar.
- **States**: spawn scale-in, 8–1 hits remaining, collected burst, expired.
- **Motion**: opposing broken-ring rotations communicate a live pickup; each hit extinguishes one pip.
- **Accessibility**: circular orbit, white core, cardinal rays, larger scale, and pip count distinguish it from hostile polygons without relying on lime color.

### Enemy Family

- **Variants**: violet pinwheel wanderer, cyan diamond grunt, green framed-cube weaver, magenta crossed-box spinner, gold segmented snake with cyan head, orange/cyan repulsar, red/orange/violet black hole, dart, orbiter, crusher, splitter, and spawned shard.
- **Structure**: every class owns a distinct live vector silhouette derived from the original Geometry Wars family. New additions reuse that grammar through a chevron rocket (`dart`), gyroscope diamond (`orbiter`), armored double diamond (`crusher`), divided magenta octahedron (`splitter`), and small triangular fragment (`shard`).
- **States**: spawn, normal pursuit, class-specific maneuver, damage, destruction, and splitter fragmentation.
- **Motion**: darts alternate between tracking and short charge windows; orbiters hold a readable ring around the player; crushers pursue with high inertia; splitters drift inward and release three independently steered shards on destruction.
- **Accessibility**: class identity never depends on hue alone; silhouette, rotation, scale, durability, and motion pattern reinforce one another.

### Assault Director

- **Structure**: repeating 18-second waves cycle through `SWARM`, `FLANK`, `SPIRAL`, and `SIEGE`, then repeat at the current difficulty scale.
- **States**: 15.5-second reinforcement window followed by a 2.5-second recovery window; enemies already on the field remain dangerous during recovery.
- **Composition**: SWARM favors numerous light shapes, FLANK emphasizes fast lateral threats, SPIRAL emphasizes orbiting and rotating movement, and SIEGE favors durable or splitting targets.
- **Formation**: every batch chooses one arena edge and distributes its members across readable lanes. Segmented converging rings make each arrival visible before its collision becomes active.
- **HUD**: `A## LABEL Ns` reports wave number, directive, and time remaining without creating a second control target.

### HUD and Touch Controls

- **Structure**: score/high score, multiplier, lives, weapon tier, temporary special state, next-supply countdown, and one floating movement joystick.
- **States**: title, playing, paused, game over, missile, overdrive, ally wing, active directional sector, and center-hold fire.
- **Layout**: the arena may extend behind notches, while telemetry is anchored below the platform safe-area inset; transient messages stack below the telemetry band rather than overlapping it.
- **Interaction**: in portrait, a drag above the dead zone updates both movement and a smoothed remembered heading. Returning the knob to center stops movement but keeps firing along that heading while the touch remains held. Releasing the touch stops fire. Each volley may choose one live enemy or super supply inside a 52-degree forward sector, but every projectile becomes ballistic at spawn and never follows that target.
- **Physical tuning**: the floating stick uses a 48 px travel/ring, 17 px knob, 7 px dead zone, and 35 px response span. Cocos converts those physical pixels into design-resolution units with the current view scale.
- **Visible bounds**: landscape sticks anchor to the physical canvas bounds, not unused vertical design space, so each 48 px ring retains at least 26 px of bottom clearance.
- **Feedback**: while the floating stick is active, two faint rays and a connecting arc expose the eligible firing sector. The center ray shows the remembered heading even when the knob returns to center.
- **Accessibility**: the sector lowers thumb precision demands without hiding directional intent or selecting targets behind the player. The opening guidance fades during seconds 3.5–4.5 and is then removed from the battlefield. Keyboard and landscape twin-stick controls remain available for development.

## 6. Motion & Interaction

| Mechanism | Timing | Purpose |
|---|---:|---|
| Opening guidance | 3.5 s hold + 1 s fade | Teaches the gesture without permanently covering combat |
| Assault wave | 15.5 s active + 2.5 s recovery | Alternates pressure profiles while preserving a readable breath between reinforcements |
| Progression background swap | 800 ms opacity fade | Marks every new Assault wave or weapon tier without adding motion unrelated to game state |
| Arrival telegraph | 450–550 ms | Announces a grouped edge breach before enemies become collidable |
| Portrait heading response | 14 s⁻¹, retargetable | Smooths small thumb-angle jitter while preserving fast deliberate turns |
| Portrait directional fire | continuous while touch is held after movement magnitude > 0.18 once | Remembers the last deliberate heading so center hold becomes a stable fire stance |
| Directional assist sector | ±26°, 0.62 × long viewport axis | Selects one eligible target at volley time; selection favors the center ray and does not alter an in-flight bullet |
| Projectile tracking | continuous, 5.4 rad/s response | Shows missile acquisition and course correction |
| Supply spawn | 600 ms | Announces a target entering the arena |
| Chain detonation | 65 ms stagger | Makes the full-screen effect legible as a cascade |
| Missile mode | 5 s | Temporary weapon transformation |
| Overdrive | 8 s | Temporary nine-lane barrage |
| Ally wing | 12 s | Temporary autonomous support |
| Dart charge | 450 ms within a 1.35 s cycle | Telegraphs a high-speed triangular attack |
| Orbiter correction | continuous, distance-banded | Holds a legible ring rather than colliding as a normal chaser |
| Splitter fragmentation | immediate on destruction | Converts one hexagonal threat into three visible shards |

All motion represents gameplay state. Homing is reserved for the temporary missile power-up and allied ships. Default bullets may receive one launch-angle correction toward an eligible target inside the visible sector, then preserve that velocity for their entire flight. Motion updates are frame-delta based and remain retargetable every frame.

## 7. Depth & Surface

Strategy: mixed luminous depth. The arena is flat and near-black; entities gain depth through additive alpha, colored outline, and bounded glow. Filled surfaces stay translucent so the grid remains visible beneath gameplay objects. No raster image substitutes for live entities.

## 8. Accessibility Constraints & Accepted Debt

### Constraints

- Every friendly, hostile, projectile, and reward class differs by both silhouette and color.
- Critical state changes have a HUD message plus battlefield feedback.
- Chinese labels remain short and centered to avoid unnatural single-character wrapping.
- Pointer play needs only one continuous movement gesture; no secondary action target competes with movement.
- Passive super-supply timing is shown as status text rather than a button, so it does not imply direct activation.
- Score, lives, weapon state, and timed messages remain inside the platform safe area on notched screens.
- Per-frame cleanup preserves entity-array identities; particles are recycled after expiry so long sessions do not create avoidable garbage-collection spikes.
- Visual density remains capped, but optimization must preserve projectile count, enemy silhouettes, grid deformation, and primary destruction bursts before considering any effect reduction.

### Accepted Debt

| Item | Location | Why accepted | Owner / Exit |
|---|---|---|---|
| Automatic OS reduced-motion detection | Cocos WeChat runtime | The platform layer exposes no stable preference signal; pursuit motion is also gameplay-critical. | Revisit when the target exposes a suitable preference API; reduce decorative particles while preserving trajectories. |
