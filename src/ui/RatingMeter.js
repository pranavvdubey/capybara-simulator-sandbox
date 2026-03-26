import { eventBus, Events } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';

// Right-side vertical rating bar.
// Fill level reflects score / maxScore.
// Label shows neutral / good / great.
const COLORS = {
  neutral: '#6a8a7a',
  good:    '#8abc8a',
  great:   '#c4e86a',
};

const LABELS = {
  neutral: 'Chill',
  good:    'Vibing',
  great:   'Peak Capy',
};

export class RatingMeter {
  constructor(container, ratingSystem) {
    this._el = container;
    this._rs = ratingSystem;
    this._render();
    eventBus.on(Events.RATING_CHANGED, (data) => this._update(data));
  }

  // Call after any state change to force recalc + redraw
  recalculate() {
    const result = this._rs.calculate();
    this._update(result);
  }

  _render() {
    this._el.innerHTML = `
      <div class="meter-label-top"></div>
      <div class="meter-track">
        <div class="meter-fill"></div>
        <div class="meter-markers">
          <div class="meter-marker" data-level="great"><span>Great</span></div>
          <div class="meter-marker" data-level="good"><span>Good</span></div>
          <div class="meter-marker" data-level="neutral"><span>Chill</span></div>
        </div>
      </div>
      <div class="meter-label-bot">Vibe</div>
    `;
    this._update({ label: 'neutral', score: 1 });
  }

  _update({ label, score }) {
    const maxScore = this._rs.maxScore();
    const pct = Math.min(score / maxScore, 1) * 100;
    const fill = this._el.querySelector('.meter-fill');
    const top  = this._el.querySelector('.meter-label-top');
    if (fill) {
      fill.style.height = `${pct}%`;
      fill.style.background = COLORS[label] || COLORS.neutral;
    }
    if (top) {
      top.textContent = LABELS[label] || label;
      top.style.color = COLORS[label] || COLORS.neutral;
    }
    this._el.classList.toggle('peak', label === 'great');

    // Highlight active marker
    this._el.querySelectorAll('.meter-marker').forEach(m => {
      m.classList.toggle('active', m.dataset.level === label);
    });
  }
}
