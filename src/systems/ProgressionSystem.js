import { BIOME_MILESTONES, PEAK_MOMENT } from '../core/Constants.js';
import { eventBus, Events } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';

export class ProgressionSystem {
  constructor() {
    this._lastMilestoneKey = null;
  }

  update() {
    const now = performance.now() / 1000;
    if (gameState.peakMoment && now >= gameState.peakMomentEndsAt) {
      gameState.peakMoment = false;
      gameState.activeInteraction = null;
      eventBus.emit(Events.PEAK_MOMENT_ENDED, { biome: gameState.biome });
      eventBus.emit(Events.INTERACTION_STATE_CHANGED, { activeInteraction: null });
      gameState.save();
    }
  }

  onRatingChanged({ label }) {
    const biome = gameState.biome;
    const milestone = BIOME_MILESTONES[biome];
    if (!milestone) return;

    if (label === 'great' && this._matchesMilestone(milestone.combo)) {
      if (!gameState.isMilestoneComplete(biome)) {
        const reward = milestone.reward;
        for (const unlockBiome of reward.biomes || []) gameState.unlockBiome(unlockBiome);
        for (const unlockCompanion of reward.companions || []) gameState.unlockCompanion(unlockCompanion);
        gameState.addChillPoints(reward.chillPoints || 0, `${biome}-mastery`);
        gameState.markMilestone(biome, {
          rewardLabel: milestone.title,
          reward: reward,
        });
      }

      if (elapsedReady(gameState.peakMomentCooldownUntil)) {
        this._triggerPeakMoment(biome);
      }

      eventBus.emit(Events.PROGRESSION_CHANGED, this.snapshot());
      return;
    }

    this._lastMilestoneKey = null;
  }

  snapshot() {
    return {
      chillPoints: gameState.chillPoints,
      unlockedBiomes: [...gameState.unlockedBiomes],
      unlockedCompanions: [...gameState.unlockedCompanions],
      milestones: { ...gameState.milestones },
      biome: gameState.biome,
    };
  }

  _matchesMilestone(combo) {
    const checks = [
      !combo.biome || combo.biome === gameState.biome,
      !combo.companion || combo.companion === gameState.companion,
      !combo.time || combo.time === 'any' || combo.time === gameState.time,
      !combo.weather || combo.weather === 'any' || combo.weather === gameState.weather,
      !combo.rating || combo.rating === gameState.rating,
    ];
    return checks.every(Boolean);
  }

  _triggerPeakMoment(biome) {
    const now = performance.now() / 1000;
    gameState.peakMoment = true;
    gameState.activeInteraction = 'peak-moment';
    gameState.peakMomentEndsAt = now + PEAK_MOMENT.duration;
    gameState.peakMomentCooldownUntil = now + PEAK_MOMENT.cooldown;
    gameState.addChillPoints(PEAK_MOMENT.chillBonus, `${biome}-peak-moment`);
    eventBus.emit(Events.PEAK_MOMENT_STARTED, { biome, duration: PEAK_MOMENT.duration });
    eventBus.emit(Events.INTERACTION_STATE_CHANGED, { activeInteraction: 'peak-moment' });
    gameState.save();
  }
}

function elapsedReady(cooldownUntil) {
  const now = performance.now() / 1000;
  return !cooldownUntil || now >= cooldownUntil;
}
