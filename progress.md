# Capybara Chill Scene — Progress

## Original Prompt (preserved)

Transform the existing capybara idle toy into a polished "lofi capybara chill scene builder":
- Biome switching (Meadow / Riverside / Jungle)
- Companion animals per biome
- Day/night + rain toggles
- Side rating meter (neutral / good / great) with deterministic scoring
- Coherent ambient sandbox vibe — not a combat/farming/survival game

---

## 2026-03-26 — Full Architecture Rewrite

### What changed

**Removed (no longer fit the direction):**
- Market cap WebSocket / $CAPYSIM bubble
- Standing capybara FX (dramatic, conflicts with chill vibe)
- Passive "vibes" point accumulation
- Play.fun SDK integration
- Hat cycling on tap
- Socket.io dependency

**Ported and preserved:**
- GPU rain shader (ShaderMaterial, zero CPU per frame)
- GPU flower wind instancing (InstancedMesh + onBeforeCompile)
- Lofi music system (9 tracks, auto-advance, skip/mute)
- Sky dome gradient shader (day/night/biome reactive)
- Terrain generation + pond/sand
- OrbitControls camera
- Capybara head bone sway animation
- Mobile DPR + shadow quality detection

**New systems:**
- **EventBus** (`src/core/EventBus.js`) — pub/sub for all cross-module messaging
- **GameState** (`src/core/GameState.js`) — single source of truth for biome/companion/weather/time
- **Constants** (`src/core/Constants.js`) — all biome defs, companion defs, scoring config
- **WeatherSystem** — unified rain + day/night atmosphere transitions; stars at night
- **BiomeManager** — 3 biome environments using existing assets; instant switching via group visibility
- **CompanionManager** — 4 procedural companion actors (bee, firefly, frog, rabbit)
- **RatingSystem** — deterministic scoring: biome match + time match + weather match + special combos
- **UI** — BiomeSelector carousel, CompanionSelector strip, RatingMeter vertical bar, HUD controls

### File structure
```
src/
  core/      EventBus.js, GameState.js, Constants.js
  systems/   WeatherSystem.js, AudioManager.js, RatingSystem.js
  scene/     SceneManager.js, CapybaraActor.js, BiomeManager.js, CompanionManager.js
  ui/        BiomeSelector.js, CompanionSelector.js, RatingMeter.js, HUD.js
  main.js
index.html   (shell — CSS + HTML structure only)
```

---

## Current Game State

### Biomes (3 implemented)
| Biome | Atmosphere | Capy position | Companions |
|---|---|---|---|
| Meadow | Warm, open, flowers | (0, 0, 0) | Bee, Rabbit |
| Riverside | Cool, misty, pond focus | (0, 0, -5) | Firefly, Frog |
| Jungle | Dense trees, deep green | (0, 0, -2) | Bee, Firefly |

### Companions (4 implemented, procedural geometry)
| Companion | Mode | Prefers | Special combo bonus |
|---|---|---|---|
| Bee | hover_around | Day + Clear | Meadow + Day + Clear = +2 |
| Firefly | hover_around | Night | Night = +2 |
| Frog | sit_on_capy | Rain | Rain + Riverside = +2 |
| Rabbit | sit_on_capy | Day + Clear | Meadow + Day = +2 |

### Rating thresholds
- **Neutral (Chill)**: score < 3
- **Good (Vibing)**: 3–5
- **Great (Peak Capy)**: 6+

### Max possible score: 9 (companion base 3 + time 2 + weather 2 + combo 2)

---

## Design Flow

1. Player opens scene → meadow with solo capy, daytime, clear
2. Top carousel lets them switch biome (← / →)
3. Bottom strip shows biome-specific companions — tap to enable, tap again to solo
4. Top-right: skip track, mute all, rain toggle, night toggle
5. Right-side meter rises as conditions align with companion preferences
6. Night + firefly + riverside = peak rating

---

## Recent Changes

### 2026-03-26
- Complete rewrite from ~1550-line monolith to 12 modular ES files
- New UI: biome carousel + companion strip + rating meter
- 3 biomes, 4 companions, deterministic scoring
- Day/night system with star particles
- Removed: market cap, standing FX, hat cycling, Play.fun
- Started modernizing the pond/river water using a local ES module port of the `jbouny/ocean` shader so it works with the current Three.js import map instead of the repo's legacy global API.

---

## Known Issues / Weak Spots

- **Companion models are procedural**: bee/firefly/frog/rabbit are built from Three.js primitives. They read as the right animals but aren't polished art.
- **Weather lerp uses exponential approach**: Slightly different feel from original linear approach. Transitions are smooth but slower at the end.
- **Biome camera jump**: On biome switch, camera teleports to new position rather than smoothly animating. Could add a camera lerp.
- **No capy_on_companion mode**: Large animal companions (horse, tiger, croc) where capy rides on top are not yet implemented — needs GLB assets + CapybaraActor position override.
- **Riverside biome camera**: May need tuning — the orbit target shifts to z=-5 which could clip the pond edge.

---

## Suggested Next Steps

1. **Source GLB companions** — Horse + Tiger from FBX conversion (see `docs/fbx-to-glb-pipeline.md`), Frog/Rabbit from Quaternius pack. This immediately improves visual quality.
2. **Implement capy_on_companion** — Add `setPosition()` to CapybaraActor, detect placement mode in CompanionManager, lift capy to companion's back.
3. **Camera lerp on biome switch** — Instead of teleporting, animate camera position over ~0.8s.
4. **Add ambient sounds per biome** — Frogs/insects for riverside, birds for jungle, wind for meadow.
5. **More biomes** — Desert (armadillo companion?), Autumn Forest, Snowy Mountain.
6. **Polish companion VFX** — Firefly trail particles, bee wing blur texture, frog water ripple on riverside.
7. **Mobile touch feel** — Test companion tap UX on actual devices; verify bottom strip doesn't clip.

---

## Points of Improvement

- Rating meter animation could have more character (bounce, glow pulse on threshold cross)
- Biome selector arrows could show biome preview color instead of plain text
- Night transition could add a moon disc to the sky dome
- Riverside could show water reflections (simple, use MeshStandardMaterial with roughness 0.1)
- Companion hover paths could be more organic (Lissajous figure instead of plain circle)

---

## Asset Status

| Asset | Status | Notes |
|---|---|---|
| capybara-rigged.glb | ✅ In use | Head bone sway, scales to 1m |
| flower.glb | ✅ In use | Instanced, GPU wind shader, Meadow only |
| grass-turf.glb | ✅ In use | All biomes |
| palm-trees.glb | ✅ In use | Individual palm extraction, Meadow only |
| tree1/tree2/trees.glb | ✅ In use | All biomes, density varies |
| rocks/rock2.glb | ✅ In use | Riverside heavier, Jungle lighter |
| lofi_loop_01-09.mp3 | ✅ In use | Auto-advance, skip/mute |
| rain_01.mp3 | ✅ In use | Fades with rain toggle |
| thunder_01.mp3 | ❌ Removed | Was for standing FX, no longer needed |
| capybara-standing.glb | ❌ Removed | Was for market cap FX |
| hats/ | ❌ Removed | Hat cycling removed |
| .asset-imports/ FBX pack | ⏳ Pending | See docs/fbx-to-glb-pipeline.md |

## Verification

- Browser preview: visible in preview panel at time of writing
- Not yet verified: mobile layout, biome switch camera on actual device
- Not yet verified: flower wind shader compatibility (uses onBeforeCompile, may need needsUpdate)

---

## 2026-03-26 — Post FX Repair

### What changed

- Removed the broken custom fullscreen post stack that was making Meadow look washed out and "inside out".
- Switched `SceneManager` to use `pmndrs/postprocessing` directly through the browser import map.
- Kept the stack intentionally restrained: bloom, vignette, noise, brightness/contrast, and very light chromatic aberration.
- Fixed the local `OceanWater` fog vertex shader so water renders correctly during post-processing.
- Disabled composer multisampling to avoid framebuffer blit warnings in software-WebGL test runs.

### Verification

- Meadow/day now renders with normal perspective and sane ground color again.
- Rain/night still render and respond to control toggles.
- Captured screenshots:
  - `output/postfx-day.png`
  - `output/postfx-rain.png`
  - `output/postfx-rain-night.png`

### Remaining issues

- Rain sprites are still very blocky/overbright in captures, especially in rain/night. This appears to be separate from the post stack and likely lives in `WeatherSystem`'s rain sprite shader/material tuning.

---

## 2026-03-26 — Wagner Visual Pass

### What changed

- Replaced the newer `postprocessing` dependency with a local `Wagner`-style composer in `src/post/WagnerComposer.js`.
- Added a Wagner-inspired chain: bright-pass extraction, separable bloom blur, then a composite pass with bloom, chromatic aberration, vignette, grain, and scene-tinted grading.
- Preserved the existing `setPostProcessingMood()` API so biome/time/weather/rating still drive the visual intensity without rewiring the rest of the app.

### Notes

- Source reference: https://github.com/spite/Wagner
- This is a modernized local adaptation, not a raw drop-in of the original global-script repo.
- Still needs screenshot-based tuning after a live browser run, especially for rainy and night scenes.

---

## 2026-03-26 — Interaction And Lofi Layout Pass

### What changed

- Raised the rabbit sit anchor substantially so it reads above the capybara instead of sinking into it.
- Removed penguin from the Snowy Peak companion carousel so it no longer appears as a selectable option.
- Made previous/current/next biome labels directly clickable in addition to the arrow buttons.
- Added lightweight motion trails for the bee and eagle using pooled translucent sphere segments.
- Added `capyHeightOffset` biome support and used it to place the capybara on the lofi desk surface.
- Added a side table in the lofi room and moved the mug/plant cluster onto furniture instead of leaving them at floor level.
- Upscaled the laptop and lemonade companions significantly for the lofi desk scene.

### Still to verify

- Check the lofi desk camera framing with the capybara now elevated on the desk.
- Confirm the rabbit height still looks correct across meadow, mountain, and snowy.
- Confirm the bee/eagle trails read as intentional and not too bright in motion.

### Verification completed

- Verified Lofi Desk via bundled Playwright client capture at `output/web-game-client/shot-0.png`: capybara is on the desk surface, biome labels are clickable, and the enlarged laptop/lemonade options remain available.
- Verified bee trail visually at `output/manual-checks/meadow-bee.png`.
- Verified rabbit elevation visually on Mountain Top at `output/manual-checks/mountain-rabbit.png`.
- Verified eagle trail visually at `output/manual-checks/mountain-eagle.png`.
- Verified Snowy Peak selector contents via `output/manual-checks/snowy-buttons.json`: only rabbit is exposed, penguin no longer appears.

---

## 2026-03-26 — Chill Sandbox Deluxe Pass

### What changed

- Extended `GameState` with progression data: chill points, unlocks, milestones, active interaction state, and peak-moment timers.
- Added biome mastery metadata, interaction definitions, and unlock rewards in `src/core/Constants.js`.
- Added `ProgressionSystem` for mastery rewards and `Peak Moment` triggering.
- Added `InteractionSystem` for short biome-aware `Relax`, `Treat`, and `Play` moments with scene VFX and chill-point rewards.
- Added a judge-facing HUD expansion:
  - `JournalPanel` for biome objective, reward, and progression status
  - `InteractionPanel` for the three action buttons
  - lock-state treatment in biome and companion selectors
  - chill-point readout in the control cluster
- Added smooth camera lerp and peak-moment camera treatment in `SceneManager`.
- Added lightweight synthesized biome ambience in `AudioManager`.
- Tuned rain rendering to be less blocky and less overbright in screenshots.
- Converted the Mountain `Eagle` into a hero perch companion with `capy_on_companion` behavior.
- Replaced the README with submission-facing documentation instead of the upstream joke copy.

### Verification

- Verified clean load and updated HUD shell via Playwright capture:
  - `output/web-game-client/shot-0.png`
  - `output/web-game-client/state-0.json`
- Verified Meadow mastery loop:
  - selecting `Bee` in Meadow pushes rating to `great`
  - unlocks `Mountain Top`
  - updates chill points and unlock state
  - artifacts:
    - `output/web-game-meadow/shot-0.png`
    - `output/web-game-meadow/state-0.json`

### Remaining gaps

- The Mountain eagle perch path was implemented, but I did not finish a stable automated capture for that exact scenario before stopping.
- Companion art is still largely procedural; the new progression/interaction structure is ready for higher-fidelity assets later.
- The interaction panel and companion strip share the bottom band on smaller screens and may still need spacing polish on narrow mobile widths.
