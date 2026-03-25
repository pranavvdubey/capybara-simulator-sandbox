import { eventBus, Events } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';

// Top-right controls: skip, mute, rain, night
export class HUD {
  constructor(container) {
    this._el = container;
    this._render();
    this._bind();

    eventBus.on(Events.RATING_CHANGED, () => this._syncWeatherTime());
  }

  _render() {
    this._el.innerHTML = `
      <button id="btn-skip" title="Skip track">
        <svg viewBox="0 0 24 24"><polygon points="5,4 15,12 5,20"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
      </button>
      <button id="btn-mute" title="Mute / Unmute">
        <svg viewBox="0 0 24 24" id="mute-icon">
          <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
          <path d="M15.54 8.46a5 5 0 010 7.07"/>
          <path d="M19.07 4.93a10 10 0 010 14.14"/>
        </svg>
      </button>
      <button id="btn-rain" title="Toggle rain">
        <svg viewBox="0 0 24 24"><path d="M20 17.58A5 5 0 0018 8h-1.26A8 8 0 104 16.25"/><line x1="8" y1="16" x2="8" y2="20"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="16" y1="16" x2="16" y2="20"/></svg>
      </button>
      <button id="btn-night" title="Toggle night">
        <svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
      </button>
    `;
  }

  _bind() {
    this._el.querySelector('#btn-skip').addEventListener('click', (e) => {
      e.stopPropagation();
      eventBus.emit(Events.AUDIO_SKIP);
    });

    this._el.querySelector('#btn-mute').addEventListener('click', (e) => {
      e.stopPropagation();
      gameState.muted = !gameState.muted;
      this._updateMuteIcon();
      eventBus.emit(Events.AUDIO_MUTE);
    });

    this._el.querySelector('#btn-rain').addEventListener('click', (e) => {
      e.stopPropagation();
      gameState.weather = gameState.weather === 'rain' ? 'clear' : 'rain';
      this._syncWeatherTime();
      eventBus.emit(Events.WEATHER_CHANGED, { weather: gameState.weather });
    });

    this._el.querySelector('#btn-night').addEventListener('click', (e) => {
      e.stopPropagation();
      gameState.time = gameState.time === 'night' ? 'day' : 'night';
      this._syncWeatherTime();
      eventBus.emit(Events.TIME_CHANGED, { time: gameState.time });
    });
  }

  _syncWeatherTime() {
    const rainBtn  = this._el.querySelector('#btn-rain');
    const nightBtn = this._el.querySelector('#btn-night');
    if (rainBtn)  rainBtn.classList.toggle('active',  gameState.weather === 'rain');
    if (nightBtn) nightBtn.classList.toggle('active',  gameState.time    === 'night');
  }

  _updateMuteIcon() {
    const icon = this._el.querySelector('#mute-icon');
    if (!icon) return;
    if (gameState.muted) {
      icon.innerHTML = `
        <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
        <line x1="23" y1="9" x2="17" y2="15"/>
        <line x1="17" y1="9" x2="23" y2="15"/>
      `;
    } else {
      icon.innerHTML = `
        <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
        <path d="M15.54 8.46a5 5 0 010 7.07"/>
        <path d="M19.07 4.93a10 10 0 010 14.14"/>
      `;
    }
  }
}
