import { BIOMES } from '../core/Constants.js';
import { gameState } from '../core/GameState.js';
import { eventBus, Events } from '../core/EventBus.js';

// Top-center biome carousel.
// Shows: [prev-name] ← [CURRENT NAME] → [next-name]
export class BiomeSelector {
  constructor(container) {
    this._el = container;
    this._render();
    this._bind();
  }

  refresh() {
    const idx  = gameState.biomeIndex;
    const prev = BIOMES[(idx - 1 + BIOMES.length) % BIOMES.length];
    const cur  = BIOMES[idx];
    const next = BIOMES[(idx + 1) % BIOMES.length];

    this._el.querySelector('.biome-prev-name').textContent = prev.name;
    this._el.querySelector('.biome-cur-name').textContent  = cur.name;
    this._el.querySelector('.biome-next-name').textContent = next.name;
  }

  _render() {
    this._el.innerHTML = `
      <button class="biome-arrow biome-arrow-left" aria-label="Previous biome">&#8592;</button>
      <div class="biome-label-group">
        <span class="biome-prev-name"></span>
        <span class="biome-cur-name"></span>
        <span class="biome-next-name"></span>
      </div>
      <button class="biome-arrow biome-arrow-right" aria-label="Next biome">&#8594;</button>
    `;
    this.refresh();
  }

  _bind() {
    this._el.querySelector('.biome-arrow-left').addEventListener('click', (e) => {
      e.stopPropagation();
      gameState.setPrevBiome();
      this.refresh();
      eventBus.emit(Events.BIOME_CHANGED, { biome: gameState.biome });
    });
    this._el.querySelector('.biome-arrow-right').addEventListener('click', (e) => {
      e.stopPropagation();
      gameState.setNextBiome();
      this.refresh();
      eventBus.emit(Events.BIOME_CHANGED, { biome: gameState.biome });
    });
  }
}
