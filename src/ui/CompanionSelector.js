import { COMPANIONS, BIOMES } from '../core/Constants.js';
import { gameState } from '../core/GameState.js';
import { eventBus, Events } from '../core/EventBus.js';

// Bottom-center companion strip.
// Shows only companions available in the current biome.
// Clicking active companion deselects it.
export class CompanionSelector {
  constructor(container) {
    this._el = container;
    this._render();

    eventBus.on(Events.BIOME_CHANGED, () => this._render());
    eventBus.on(Events.COMPANION_CHANGED, () => this._highlightActive());
  }

  _render() {
    const biomeDef = BIOMES.find(b => b.id === gameState.biome);
    const available = biomeDef ? biomeDef.companions : [];
    const companions = COMPANIONS.filter(c => available.includes(c.id));

    this._el.innerHTML = '';
    if (companions.length === 0) {
      this._el.innerHTML = '<span class="companion-empty">Solo capy vibes</span>';
      return;
    }

    companions.forEach(def => {
      const btn = document.createElement('button');
      btn.className = 'companion-btn';
      btn.dataset.id = def.id;
      const unlocked = gameState.hasCompanion(def.id);
      btn.title = unlocked ? def.unlockLabel || def.name : `Locked • ${def.unlockCost} chill`;
      btn.innerHTML = `
        <span class="companion-emoji">${unlocked ? def.emoji : '🔒'}</span>
        <span class="companion-name">${unlocked ? def.name : 'Locked'}</span>
      `;
      btn.classList.toggle('locked', !unlocked);
      if (gameState.companion === def.id) btn.classList.add('active');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!gameState.hasCompanion(def.id)) return;
        const next = gameState.companion === def.id ? null : def.id;
        gameState.setCompanion(next);
        this._highlightActive();
        eventBus.emit(Events.COMPANION_CHANGED, { companion: next });
      });
      this._el.appendChild(btn);
    });
  }

  _highlightActive() {
    this._el.querySelectorAll('.companion-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.id === gameState.companion);
    });
  }
}
