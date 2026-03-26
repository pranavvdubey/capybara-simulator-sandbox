class EventBus {
  constructor() { this._listeners = {}; }

  on(event, handler) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(handler);
    return () => this.off(event, handler);
  }

  once(event, handler) {
    const wrapper = (...args) => { handler(...args); this.off(event, wrapper); };
    return this.on(event, wrapper);
  }

  off(event, handler) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(h => h !== handler);
  }

  emit(event, data) {
    (this._listeners[event] || []).forEach(h => {
      try { h(data); } catch (e) { console.error(`EventBus error on ${event}:`, e); }
    });
  }
}

export const eventBus = new EventBus();

export const Events = {
  BIOME_CHANGED:      'biome:changed',
  COMPANION_CHANGED:  'companion:changed',
  WEATHER_CHANGED:    'weather:changed',
  TIME_CHANGED:       'time:changed',
  RATING_CHANGED:     'rating:changed',
  PROGRESSION_CHANGED:'progression:changed',
  INTERACTION_TRIGGERED:'interaction:triggered',
  INTERACTION_STATE_CHANGED:'interaction:state-changed',
  PEAK_MOMENT_STARTED:'peak-moment:started',
  PEAK_MOMENT_ENDED:  'peak-moment:ended',
  AUDIO_SKIP:         'audio:skip',
  AUDIO_MUTE:         'audio:mute',
};
