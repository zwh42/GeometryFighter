# Geometry Fighter Design System

## 0. Reference Study

- The official [Steam release page](https://store.steampowered.com/app/8400/Geometry_Wars_Retro_Evolved/) establishes the dark reactive grid, white open-claw player, short gold projectile streams, and silhouette-first enemy readability.
- The official [Xbox store listing](https://www.xbox.com/en-us/games/store/geometry-wars-evolved/bp5g8k2m71pm) and its gameplay art confirm the core color families: cyan diamonds, green framed cubes, magenta crossed boxes, violet pinwheels, gold segmented snakes, and red/orange black-hole rings.
- The control reference remains twin-stick in landscape. Portrait adapts the missing aim stick by firing along the current movement vector, preserving directional intent without target tracking.

## 1. Atmosphere & Identity

Geometry Fighter is a dark neon arcade instrument: a near-black arena, electrically lit geometry, and concise telemetry should make every threat and reward readable at a glance. Its signature is the luminous grid reacting physically to combat through distortion, pulses, trails, and shockwaves.

## 2. Color

| Role | Token | Value | Usage |
|---|---|---:|---|
| Arena | `background` | `#01040c` | Primary playfield |
| Grid | `grid` | `#173b98` | Resting grid lines |
| Grid energy | `gridHot` | `#476dff` | Distortion and strong grid feedback |
| Primary light | `white` | `#f7ffff` | Player hull, borders, high-emphasis text |
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

Colors are centralized in `js/config.js` for the runtime renderer. Alpha variants may be derived for fills and glow, but semantic hues must come from this table.

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
- Arena inset: 15 px runtime / 8 px Cocos design space.
- Portrait HUD edge: 20 px; landscape HUD edge: 28 px.
- Portrait HUD top: `max(18 px, safe-area top + 8 px)`; temporary combat messages begin 68 px below that anchor. Cocos applies the same rule in design-resolution units through `sys.getSafeAreaRect()`.
- The single movement control occupies the lower playfield; the lower-middle region remains clear so supply telemetry cannot be mistaken for a button.
- The renderer scales to the full viewport and uses centered world coordinates in Cocos and screen coordinates in the standalone runtime.
- Responsive targets: 390 × 844 portrait, 720 × 1280 design portrait, and 800 × 450 landscape developer mode.

## 5. Components

### Reactive Grid

- **Structure**: star field, warped grid, luminous boundary.
- **States**: rest, pulse, shockwave, black-hole distortion.
- **Motion**: simulation-driven deformation; no layout animation.
- **Accessibility**: boundary remains white and readable without relying on glow.

### Fighter

- **Variants**: player (white/cyan), ally (smaller cyan).
- **States**: active, invulnerable flicker, destroyed, ally expiring.
- **Motion**: player velocity trail; allies orbit smoothly and aim independently.
- **Accessibility**: friendly silhouettes point in their firing direction and differ from enemy polygons.

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

### HUD and Touch Controls

- **Structure**: score/high score, multiplier, lives, weapon tier, temporary special state, next-supply countdown, and one floating movement joystick.
- **States**: title, playing, paused, game over, missile, overdrive, ally wing.
- **Layout**: the arena may extend behind notches, while telemetry is anchored below the platform safe-area inset; transient messages stack below the telemetry band rather than overlapping it.
- **Accessibility**: single-hand portrait fire follows the current movement direction; the opening guidance fades during seconds 3.5–4.5 and is then removed from the battlefield. Keyboard and landscape twin-stick controls remain available for development.

## 6. Motion & Interaction

| Mechanism | Timing | Purpose |
|---|---:|---|
| Opening guidance | 3.5 s hold + 1 s fade | Teaches the gesture without permanently covering combat |
| Portrait directional fire | continuous while movement magnitude > 0.22 | Converts the movement gesture into a bounded firing heading without enemy tracking |
| Projectile tracking | continuous, 5.4 rad/s response | Shows missile acquisition and course correction |
| Supply spawn | 600 ms | Announces a target entering the arena |
| Chain detonation | 65 ms stagger | Makes the full-screen effect legible as a cascade |
| Missile mode | 5 s | Temporary weapon transformation |
| Overdrive | 8 s | Temporary nine-lane barrage |
| Ally wing | 12 s | Temporary autonomous support |
| Dart charge | 450 ms within a 1.35 s cycle | Telegraphs a high-speed triangular attack |
| Orbiter correction | continuous, distance-banded | Holds a legible ring rather than colliding as a normal chaser |
| Splitter fragmentation | immediate on destruction | Converts one hexagonal threat into three visible shards |

All motion represents gameplay state. Homing is reserved for the temporary missile power-up and allied ships; the default player weapon never tracks enemies. Motion updates are frame-delta based and remain retargetable every frame.

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
| Automatic OS reduced-motion detection | WeChat Canvas and Cocos runtime | Existing platform layer exposes no stable cross-runtime preference signal; pursuit motion is also gameplay-critical. | Revisit when both targets expose the same preference API; reduce decorative particles while preserving trajectories. |
