import { INTERACTIONS } from '../core/Constants.js';
import { eventBus, Events } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';

export class InteractionPanel {
  constructor(container) {
    this._el = container;
    this._render();

    eventBus.on(Events.BIOME_CHANGED, () => this._render());
    eventBus.on(Events.INTERACTION_STATE_CHANGED, () => this._render());
    eventBus.on(Events.PEAK_MOMENT_STARTED, () => this._render());
    eventBus.on(Events.PEAK_MOMENT_ENDED, () => this._render());
  }

  _render() {
    const config = INTERACTIONS[gameState.biome];
    if (!config) {
      this._el.innerHTML = '';
      return;
    }

    const keys = ['relax', 'treat', 'play'];
    this._el.innerHTML = keys.map((key) => {
      const item = config[key];
      const active = gameState.activeInteraction === key;
      return `
        <button class="interaction-btn ${active ? 'active' : ''}" data-action="${key}" type="button">
          <span class="interaction-label">${item.label}</span>
          <span class="interaction-title">${item.title}</span>
          <span class="interaction-reward">+${item.reward}</span>
        </button>
      `;
    }).join('');

    this._el.querySelectorAll('.interaction-btn').forEach((button) => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        eventBus.emit(Events.INTERACTION_TRIGGERED, { type: button.dataset.action });
      });
    });
  }
}
