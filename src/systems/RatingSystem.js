import { eventBus, Events } from '../core/EventBus.js';
import { SCORING, COMPANIONS } from '../core/Constants.js';
import { gameState } from '../core/GameState.js';

export class RatingSystem {
  calculate() {
    const { biome, companion, weather, time } = gameState;
    const thresholds = SCORING.thresholds;
    let score = 0;

    if (!companion) {
      // Solo capybara
      score = SCORING.soloBase;
      if (time === 'night')  score += SCORING.soloNightBonus;
      if (weather === 'rain') score += SCORING.soloRainBonus;
    } else {
      const def = COMPANIONS.find(c => c.id === companion);
      if (!def) { score = SCORING.soloBase; }
      else {
        score = SCORING.companionBase;

        // Time match
        if (def.preferTime === 'any' || def.preferTime === time) {
          score += SCORING.timeMatchBonus;
        }

        // Weather match
        if (def.preferWeather === 'any' || def.preferWeather === weather) {
          score += SCORING.weatherMatchBonus;
        }

        // Special combo
        if (def.specialCombo && this._comboMatches(def.specialCombo, biome, time, weather)) {
          score += SCORING.specialComboBonus;
        }
      }
    }

    let label = 'neutral';
    if (score >= thresholds.great) label = 'great';
    else if (score >= thresholds.good) label = 'good';

    const changed = gameState.rating !== label || gameState.ratingScore !== score;
    gameState.rating = label;
    gameState.ratingScore = score;

    if (changed) {
      eventBus.emit(Events.RATING_CHANGED, { label, score });
    }

    return { label, score };
  }

  _comboMatches(combo, biome, time, weather) {
    if (combo.biome   && combo.biome   !== biome)   return false;
    if (combo.time    && combo.time    !== time)     return false;
    if (combo.weather && combo.weather !== weather)  return false;
    return true;
  }

  // Max possible score for normalizing the meter bar (0–1)
  maxScore() {
    return SCORING.companionBase + SCORING.timeMatchBonus + SCORING.weatherMatchBonus + SCORING.specialComboBonus;
  }
}
