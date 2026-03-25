# Asset Sourcing Plan

## Imported now

### Unity cache converted to GLB

- Source pack: `Animals FREE - Animated Low Poly 3D Models`
- Converted outputs: [`models/imported/ithappy-animals`](/Users/doobie/51%20Projects/Web/Projects/PlayFun/Capybara%20games/capybara-simulator/models/imported/ithappy-animals)
- Coverage:
  - Chicken
  - Deer
  - Dog
  - Horse
  - Kitty
  - Pinguin
  - Tiger

### Poly Pizza direct GLB downloads

- Downloaded outputs: [`models/imported/poly-pizza`](/Users/doobie/51%20Projects/Web/Projects/PlayFun/Capybara%20games/capybara-simulator/models/imported/poly-pizza)
- Coverage:
  - Rabbit
  - Frog
  - Gorilla
  - Elephant
  - Hippopotamus
  - Crocodile
  - Bee
  - Dragonfly

## Recommended packs for environment expansion

- [Quaternius lists on Poly Pizza](https://poly.pizza/u/Quaternius/Lists)
  - Verified source page listing `Animated Animal Pack`, `Stylized Nature MegaKit`, `Ultimate Stylized Nature Pack`, and `Cube World Kit`.
  - Best place to pull additional biome foliage and style-consistent animal replacements.

## Design notes

- `fireflies` should be implemented as particles or glow sprites, not imported as literal insect models.
- `bee` and `dragonfly` can act as hover-actor references for scene composition and anchor logic.
- Large companions like gorilla, elephant, hippo, and crocodile are best treated as static or gently animated scenic anchors first.
- If style consistency becomes a problem, prefer Quaternius packs for biomes and retain Poly Pizza animals only where the silhouette is especially strong.
