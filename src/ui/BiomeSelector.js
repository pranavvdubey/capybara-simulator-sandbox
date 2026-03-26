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
    const unlocked = BIOMES.filter((biome) => gameState.hasBiome(biome.id));
    const currentUnlockedIndex = Math.max(0, unlocked.findIndex((biome) => biome.id === gameState.biome));
    const prev = unlocked[(currentUnlockedIndex - 1 + unlocked.length) % unlocked.length] || BIOMES[gameState.biomeIndex];
    const cur  = unlocked[currentUnlockedIndex] || BIOMES[gameState.biomeIndex];
    const next = unlocked[(currentUnlockedIndex + 1) % unlocked.length] || BIOMES[gameState.biomeIndex];

    const prevBtn = this._el.querySelector('.biome-prev-name');
    const curBtn = this._el.querySelector('.biome-cur-name');
    const nextBtn = this._el.querySelector('.biome-next-name');

    prevBtn.textContent = labelForBiome(prev);
    prevBtn.dataset.biomeIndex = String(BIOMES.findIndex((biome) => biome.id === prev.id));
    curBtn.textContent = labelForBiome(cur);
    curBtn.dataset.biomeIndex = String(BIOMES.findIndex((biome) => biome.id === cur.id));
    nextBtn.textContent = labelForBiome(next);
    nextBtn.dataset.biomeIndex = String(BIOMES.findIndex((biome) => biome.id === next.id));

    [prevBtn, curBtn, nextBtn].forEach((btn) => {
      const biome = BIOMES[Number.parseInt(btn.dataset.biomeIndex, 10)];
      btn.classList.toggle('locked', !gameState.hasBiome(biome.id));
      btn.title = gameState.hasBiome(biome.id)
        ? `${biome.name} • ${biome.rewardLabel || biome.badge || ''}`
        : `Locked • ${biome.unlockCost} chill`;
    });
  }

  _render() {
    this._el.innerHTML = `
      <button class="biome-arrow biome-arrow-left" aria-label="Previous biome">&#8592;</button>
      <div class="biome-label-group">
        <button class="biome-name-btn biome-prev-name" type="button"></button>
        <button class="biome-name-btn biome-cur-name" type="button"></button>
        <button class="biome-name-btn biome-next-name" type="button"></button>
      </div>
      <button class="biome-arrow biome-arrow-right" aria-label="Next biome">&#8594;</button>
    `;
    this.refresh();
  }

  _bind() {
    const switchToIndex = (idx) => {
      if (!gameState.setBiome(BIOMES[idx].id)) return;
      this.refresh();
      eventBus.emit(Events.BIOME_CHANGED, { biome: gameState.biome });
    };

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

    this._el.querySelectorAll('.biome-name-btn').forEach((button) => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number.parseInt(button.dataset.biomeIndex ?? '', 10);
        if (Number.isNaN(idx) || idx === gameState.biomeIndex) return;
        switchToIndex(idx);
      });
    });
  }
}

function labelForBiome(biome) {
  return gameState.hasBiome(biome.id) ? biome.name : `Locked`;
}
