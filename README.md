# Capybara Chill Scene Deluxe

A polished capybara sandbox built for quick visual payoff, cozy interaction loops, and clear progression.

## What It Is

This fork turns the original idle capybara toy into a compact chill-world builder:

- Switch between biomes with distinct atmosphere and audio
- Pair the capybara with biome-specific companions
- Chase biome mastery goals to unlock new spaces and companions
- Trigger short interaction moments: `Relax`, `Treat`, and `Play`
- Hit a perfect combo to launch a temporary `Peak Moment`

The design goal is simple: strong first impression, readable scope, and no systems bloat.

## Current Feature Set

- Modular ES module architecture under [`src`](/Users/doobie/51 Projects/Web/Projects/PlayFun/Capybara games/capybara-simulator/src)
- Unlockable biome progression with chill-point rewards
- Companion unlocks with visible locked/unlocked UI states
- Journal panel with current biome objective and reward hint
- Interaction panel with three biome-aware actions
- Peak-moment spectacle state with camera and VFX lift
- Smooth biome camera travel instead of hard camera jumps
- Ambient biome audio bed plus lofi music and weather audio
- Improved rain readability for captures
- Hero companion payoff on Mountain Top via the eagle perch

## What To Try First

1. Select the `Bee` in Meadow.
2. Stay on `day` + `clear` to hit `Peak Capy`.
3. Watch Meadow mastery unlock `Mountain Top`.
4. Use `Play` in Meadow to see the interaction loop.
5. Switch to Mountain Top and equip the `Eagle` for the hero perch moment.

## Controls

- Top center: biome selector
- Bottom center: companion selector
- Bottom left: `Relax`, `Treat`, `Play`
- Top right: chill counter, skip, mute, rain, night
- Right edge: vibe meter

## Running Locally

```bash
python3 -m http.server 4173
```

Then open [http://127.0.0.1:4173](http://127.0.0.1:4173).

## Verification Artifacts

Recent captures live under:

- [`output/web-game-client`](/Users/doobie/51 Projects/Web/Projects/PlayFun/Capybara games/capybara-simulator/output/web-game-client)
- [`output/web-game-meadow`](/Users/doobie/51 Projects/Web/Projects/PlayFun/Capybara games/capybara-simulator/output/web-game-meadow)

## Notes

- Progression is stored in browser local storage for the current device/browser session history.
- The project still uses lightweight procedural companion art in several places; the progression and interaction layer is already structured so higher-fidelity companion assets can replace those meshes later.
