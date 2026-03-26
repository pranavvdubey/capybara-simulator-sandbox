import { BIOME_MILESTONES, BIOMES } from '../core/Constants.js';
import { eventBus, Events } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';

export class JournalPanel {
  constructor(container) {
    this._el = container;
    this._render();

    eventBus.on(Events.BIOME_CHANGED, () => this._render());
    eventBus.on(Events.PROGRESSION_CHANGED, () => this._render());
    eventBus.on(Events.RATING_CHANGED, () => this._render());
    eventBus.on(Events.PEAK_MOMENT_STARTED, () => this._render());
    eventBus.on(Events.PEAK_MOMENT_ENDED, () => this._render());
  }

  _render() {
    const biome = BIOMES.find((b) => b.id === gameState.biome);
    const milestone = BIOME_MILESTONES[gameState.biome];
    const complete = gameState.isMilestoneComplete(gameState.biome);
    const rewardText = milestone?.reward?.biomes?.length || milestone?.reward?.companions?.length
      ? [ ...(milestone.reward.biomes || []), ...(milestone.reward.companions || []) ].join(' + ')
      : biome?.rewardLabel || 'Spectacle unlocked';

    this._el.innerHTML = `
      <div class="journal-top">
        <div>
          <div class="journal-kicker">Chill Journal</div>
          <div class="journal-title">${biome?.name || 'Biome'} ${complete ? 'Mastered' : 'Objective'}</div>
        </div>
        <div class="journal-points">${gameState.chillPoints}<span> chill</span></div>
      </div>
      <div class="journal-hint">${milestone?.hint || 'Build a great combo to earn rewards.'}</div>
      <div class="journal-progress ${complete ? 'complete' : ''}">
        <span>${complete ? 'Unlocked' : 'Reward'}</span>
        <strong>${rewardText}</strong>
      </div>
      <div class="journal-flags">
        <span class="journal-flag ${gameState.rating === 'great' ? 'active' : ''}">Peak vibe</span>
        <span class="journal-flag ${gameState.peakMoment ? 'active' : ''}">Peak moment</span>
        <span class="journal-flag">${gameState.unlockedBiomes.length}/${BIOMES.length} biomes</span>
      </div>
    `;
  }
}
