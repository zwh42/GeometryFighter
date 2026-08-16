# Geometry Fighter Design System

## 0. Reference Study

- The official [Steam release page](https://store.steampowered.com/app/8400/Geometry_Wars_Retro_Evolved/) establishes the dark reactive grid, white open-claw player, short gold projectile streams, and silhouette-first enemy readability.
- The shipped review snapshot immediately preceding 2026-08-07 19:43 (`be22ffa`) was the binding combat-art reference until the 1.6.6 review feedback (2026-08-16) superseded two primitives: the player hull now traces the original claw silhouette, and the homing missile drops its triangular head for the original round energy-orb language. The same day's 1.7.0 feedback superseded the orb once more: the homing missile now draws a real missile — fuselage, nose cone, swept fins, exhaust flame, and smoke contrail. All other reviewed accents survive.
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

Colors are centralized in `assets/scripts/design-tokens.ts`. The reviewed combat silhouettes retain their exact legacy accents in `FIGHTER_ART`, `PROJECTILE_ART`, `ALLY_ART`, `SUPER_WEAPON_ART`, `ENEMY_ART_COLOR`, and `SUPER_EVENT_ART`; alpha variants may be derived for glow.

Typography, touch geometry, and fighter primitives follow the same rule: the standalone WebGL renderer consumes the typed token modules under `assets/scripts/`.

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
- HUD text stays short enough to remain on one line at 390 px portrait width; temporary weapon telemetry may use a second line in the HUD raster layer.

## 4. Spacing & Layout

- Base unit: 4 px.
- Arena inset: 8 px in design space.
- HUD edges: `max(28 design units, safe-area side + 12 design units)` so outlines and figures never touch a clipped screen edge.
- Portrait HUD top: `max(24 design units, safe-area top + 12 design units, WeChat menu-button bottom + 12 design units)`; both telemetry columns share this anchor so the right column sits completely below the mini-game capsule. The runtime obtains the capsule from `wx.getMenuButtonBoundingClientRect()` and converts it into design-resolution units.
- The single movement control occupies the lower playfield; the lower-middle region remains clear so supply telemetry cannot be mistaken for a button.
- The renderer scales to the full viewport and uses centered world coordinates.
- Responsive targets: 390 × 844 portrait, 720 × 1280 design portrait, and 800 × 450 landscape developer mode.

## 5. Components

### Reactive Grid

- **Structure**: sparse star field, one low-contrast procedural grid pattern, and a luminous boundary. The background never adds an emphasized center axis.
- **Physics**: every lattice intersection is an under-damped spring (stiffness 90, damping 7.5, ζ≈0.4). Disturbances displace target offsets and the lattice overshoots and wobbles back like fabric, so the arena stays alive between shocks.
- **Influences**: explosion ripples and black-hole wells displace the target; the player hull presses a speed-scaled dimple (radius 180) into the mesh; every projectile injects `0.12×` its speed as a velocity kick inside radius 80, so bullet streams plough visible wakes; respawn slams a cyan shockwave through the field.
- **Patterns**: progression cycles through `LATTICE`, `DIAMOND`, `ORBIT`, and `DEPTH`. Each remains a recognizable grid-world surface rather than an illustrated backdrop: orthogonal mesh, diagonal mesh, off-center elliptical field lines, and nested perspective frames.
- **States**: rest, progression swap, pulse, shockwave, and black-hole distortion. The active pattern index advances on every Assault wave and every weapon-tier upgrade.
- **Motion**: simulation-driven deformation remains continuous. A new progression pattern fades in over 800 ms so the swap reads as state feedback without flashing behind combat.
- **Accessibility**: the boundary remains white and readable without relying on glow. Resting pattern opacity stays below enemy fills, telegraphs, projectiles, and HUD strokes so background detail cannot mask a threat.

### Geom (Multiplier Crystal)

- **Structure**: a small rotating lime diamond (`GEOM_ART`) dropped by destroyed enemies — one per light kill, up to four from a black hole. It scatters, drifts, and expires after 8 seconds; the final two seconds blink toward expiry.
- **Economy**: each collected geom raises the score multiplier one step per six crystals, up to ×25. Losing a life resets the multiplier and the collected count while leaving uncollected crystals on the field.
- **Collection**: crystals inside a 160-unit radius magnetize to the player with distance-scaled pull and collect on contact — zero extra input, one thumb stays sufficient.
- **Constraint**: chain-detonation kills drop no crystals, so the clear-screen super remains an escape rather than a multiplier jackpot.
- **Accessibility**: crystal size (≈5 px) and orbit keep it distinct from every enemy silhouette and from the large ringed super supply; color never carries the difference alone.

### Fighter

- **Variants**: player (white/cyan), ally (smaller cyan).
- **Player structure**: the hull traces the original claw ship — one closed polyline whose two arms leave the rear center, sweep outward to the shoulders, then hook inward so the two sharp tips open forward and nearly meet at the nose. A small diamond cockpit mark repeats the bright core glow between the arms, while a separate green three-point exhaust mark sits behind the hull. Paths remain open and unfilled.
- **Display scale**: the reviewed hull geometry and enemy family are rendered at `1.6×` their legacy drawing size for phone readability. The player remains visually distinct through its open hull and cyan-white palette; drawing scale stays independent from the current view-scaled collision geometry.
- **States**: active, invulnerable flicker, destroyed, ally expiring.
- **Motion**: the green exhaust mark and player velocity trail carry thrust feedback; allies orbit smoothly and aim independently.
- **Accessibility**: the claw's forward-opening tips and rear exhaust point in the firing direction and remain distinct from every closed enemy polygon; allies retain their smaller circular-chevron silhouette so they cannot be mistaken for the player.

### Projectile

- **Variants**: standard yellow bolt, orange-white homing missile, cyan ally bolt, and cyan/magenta overdrive energy pulse.
- **Reviewed model**: standard tails remain 20 px with 12 px glow and 2.8 px core. The 1.7.0 homing missile draws a real missile: a slender fuselage with a rounded nose cone and bright sensor tip, two swept tail fins, an orange flickering exhaust flame with a white-hot core, and a four-segment fading smoke contrail that sways behind the round — nothing in the inventory reads as an arrow. Overdrive replaces the standard bolt with a round white plasma core, cyan containment ring, and parallel magenta stabilizer rails.
- **States**: flight, curved pursuit, impact, boundary impact.
- **Motion**: missiles use bounded angular steering so course changes are visible and interruptible rather than snapping to a target; the flame flickers and the contrail sways every frame.
- **Accessibility**: color, width, tail length, and missile silhouette all distinguish variants.

### Super Supply

- **Structure**: large circular orbital beacon, counter-rotating broken rings, effect-specific white core mark, four cardinal rays, and eight durability pips. Enemy silhouettes do not use this complete grammar.
- **Reviewed model**: the beacon retains the `#bcff49` glow, `#dbff95` shell, and `#f5ffe0` core from `be22ffa`; detonation uses six spokes, overload uses the stepped lightning mark, and ally deployment uses the triangular core with a center dot.
- **States**: spawn scale-in, 8–1 hits remaining, collected burst, expired.
- **Motion**: opposing broken-ring rotations communicate a live pickup; each hit extinguishes one pip.
- **Accessibility**: circular orbit, white core, cardinal rays, larger scale, and pip count distinguish it from hostile polygons without relying on lime color.

### Enemy Family

- **Variants**: violet pinwheel wanderer, cyan diamond grunt, green framed-cube weaver, magenta crossed-box spinner, gold segmented snake with cyan head, orange/cyan repulsar, and red/orange/violet black hole.
- **Structure**: every live class owns a distinct vector silhouette from the reviewed combat grammar: pinwheel arms, crossed diamonds, framed cube, segmented chain, directional repulsor shell, or concentric gravity rings.
- **States**: spawn, normal pursuit, class-specific maneuver, damage, and destruction.
- **Motion**: wanderers drift, grunts pursue directly (speed scaling up to 2.05× base as the run matures), weavers weave and sidestep closing fire within 120 units (260 impulse, 0.7 s cooldown), spinners orbit while rotating, snakes follow a segmented leader, repulsars maintain distance, and black holes devour. A black hole pulls enemies from 300 units with inverse-linear force, swallows them for no score, grows, and erupts at critical mass into a six-grunt ring with shockwave, flash, and shake.
- **Fairness**: every edge spawn re-rolls until it lands at least 250 units from the player or exhausts five attempts.
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
- **Physical tuning**: the floating stick uses a 48 px travel/ring, 17 px knob, 7 px dead zone, and 35 px response span. The runtime converts those physical pixels into design-resolution units with the current view scale.
- **Visible bounds**: landscape sticks anchor to the physical canvas bounds, not unused vertical design space, so each 48 px ring retains at least 26 px of bottom clearance.
- **Feedback**: while the floating stick is active, two faint rays and a connecting arc expose the eligible firing sector. The center ray shows the remembered heading even when the knob returns to center.
- **Accessibility**: the sector lowers thumb precision demands without hiding directional intent or selecting targets behind the player. The opening guidance fades during seconds 3.5–4.5 and is then removed from the battlefield. Keyboard and landscape twin-stick controls remain available for development.

## 6. Motion & Interaction

| Mechanism | Timing | Purpose |
|---|---|---|
| Opening guidance | 3.5 s hold + 1 s fade | Teaches the gesture without permanently covering combat |
| Assault wave | 15.5 s active + 2.5 s recovery | Alternates pressure profiles while preserving a readable breath between reinforcements |
| Progression background swap | 800 ms opacity fade | Marks every new Assault wave or weapon tier without adding motion unrelated to game state |
| Arrival telegraph | 450–550 ms | Announces a grouped edge breach before enemies become collidable |
| Portrait heading response | 14 s⁻¹, retargetable | Smooths small thumb-angle jitter while preserving fast deliberate turns |
| Portrait directional fire | continuous while touch is held after movement magnitude > 0.18 once | Remembers the last deliberate heading so center hold becomes a stable fire stance |
| Directional assist sector | ±26°, 0.62 × long viewport axis | Selects one eligible target at volley time; selection favors the center ray and does not alter an in-flight bullet |
| Projectile tracking | continuous, 5.4 rad/s response | Shows missile acquisition and course correction |
| Grid spring response | stiffness 90, damping 7.5 | Lattice overshoots and wobbles back after every shock, wake, and hull press |
| Bullet grid wake | 0.12 × bullet speed, radius 80 | Every projectile ploughs a visible furrow through the mesh |
| Geom magnet | 240–2340 px s⁻² inside 160 units | Pulls dropped crystals to the player without a second gesture |
| Geom lifetime | 8 s, final 2 s blinking | Rewards prompt sweeps without littering the field |
| Multiplier growth | +1 per 6 geoms, ceiling ×25, reset on death | Restores the risk-reward loop of sweeping through danger |
| Death slow motion | 0.9 s, time scale 0.32→1 | Reads the collapse beat without breaking the run's flow |
| Screen shake | ≤30 units, exp decay 5.5 s⁻¹ | Impact feedback on kills (≤7), supers (13), and death (18) while the HUD stays stable |
| Death flash | α 80, decays 2.4 s⁻¹ | One white blink frames the loss; black-hole eruption flashes at 0.7 strength |
| Respawn shockwave | cyan ripple + 24-particle burst | Re-entry into the grid reads as a slam, not a fade |
| Supply spawn | 600 ms | Announces a target entering the arena |
| Chain detonation | 65 ms stagger | Makes the full-screen effect legible as a cascade |
| Missile mode | 5 s | Temporary weapon transformation |
| Overdrive | 8 s | Temporary nine-lane barrage |
| Ally wing | 12 s | Temporary autonomous support |

All motion represents gameplay state. Homing is reserved for the temporary missile power-up and allied ships. Default bullets may receive one launch-angle correction toward an eligible target inside the visible sector, then preserve that velocity for their entire flight. Motion updates are frame-delta based and remain retargetable every frame.

## 7. Depth & Surface

Strategy: mixed luminous depth. The arena is flat and near-black; entities gain depth through additive alpha, colored outline, and bounded glow. Filled surfaces stay translucent so the grid remains visible beneath gameplay objects. No raster image substitutes for live entities.

## 8. Standalone WebGL Renderer (1.7.0)

The Cocos Creator engine was removed to eliminate the frame-time degradation its immediate-mode `Graphics` component showed after several minutes of play. The replacement stack under `assets/scripts/`:

- **VectorRenderer** tessellates every battlefield primitive into one preallocated grow-only `Float32Array` (6 floats per vertex: position + RGBA). A full combat frame is a single `drawArrays` call; nothing allocates after warmup, so long sessions cannot drift into GC stutter.
- **GlSurface** owns the WebGL 1.0 context: one shader for the world batch, one textured pass for HUD labels, and a screen-shake camera offset uniform.
- **TextSurface** rasterizes labels onto offscreen 2D canvases only when their string or color changes, then uploads them as textures.
- **platform.ts** is the only engine seam: WeChat (`wx.createCanvas`, offscreen 2D, touch, storage, safe area) on one side, browsers (pointer events, `localStorage`) on the other. The game code stays platform-free and unit-testable under Node.
- The WeChat main bundle drops from roughly 5 MB of engine code to about 150 KB; the music subpackage is unchanged.
- The browser preview build (`build/web-preview`) runs the identical bundle for visual QA, with `?demo=play|missile` hands-free hooks.

## 9. Accessibility Constraints & Accepted Debt

### Constraints

- Every friendly, hostile, projectile, and reward class differs by both silhouette and color.
- Critical state changes have a HUD message plus battlefield feedback.
- Chinese labels remain short and centered to avoid unnatural single-character wrapping.
- Pointer play needs only one continuous movement gesture; no secondary action target competes with movement.
- Passive super-supply timing is shown as status text rather than a button, so it does not imply direct activation.
- Score, lives, weapon state, and timed messages remain inside the platform safe area on notched screens.
- Per-frame cleanup preserves entity-array identities; particles are recycled after expiry so long sessions do not create avoidable garbage-collection spikes.
- Visual density remains capped, but optimization must preserve projectile count, enemy silhouettes, grid deformation, and primary destruction bursts before considering any effect reduction.
- A three-tier adaptive quality governor protects frame rate first: a rolling frame-cost average above 21.5 ms steps down (particle budget 640 → 448 → 256, glow passes shed from grid/particles/ripples, then bullets/enemies), and a sustained average below 15.2 ms steps back up. Enemy core strokes and the player silhouette never shed their glow before everything else has already been reduced.

### Accepted Debt

| Item | Location | Why accepted | Owner / Exit |
|---|---|---|---|
| Automatic OS reduced-motion detection | WeChat mini-game runtime | The platform layer exposes no stable preference signal; pursuit motion is also gameplay-critical. | Revisit when the target exposes a suitable preference API; reduce decorative particles while preserving trajectories. |
