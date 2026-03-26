import {
  BIOMES,
  COMPANIONS,
  INITIAL_UNLOCKED_BIOMES,
  INITIAL_UNLOCKED_COMPANIONS,
} from './Constants.js';

const STORAGE_KEY = 'capybara-chill-deluxe-save-v1';

class GameState {
  constructor() {
    this.biome = BIOMES[0].id;        // 'meadow'
    this.companion = null;             // companion id or null
    this.weather = 'clear';            // 'clear' | 'rain'
    this.time = 'day';                 // 'day' | 'night'
    this.rating = 'neutral';           // 'neutral' | 'good' | 'great'
    this.ratingScore = 0;
    this.muted = false;
    this.biomeIndex = 0;               // index into BIOMES array
    this.chillPoints = 0;
    this.unlockedBiomes = [...INITIAL_UNLOCKED_BIOMES];
    this.unlockedCompanions = [...INITIAL_UNLOCKED_COMPANIONS];
    this.milestones = {};
    this.activeInteraction = null;
    this.lastReward = null;
    this.peakMoment = false;
    this.peakMomentEndsAt = 0;
    this.peakMomentCooldownUntil = 0;

    this._load();
    this._normalizeSelections();
  }

  getBiomeDef() {
    return BIOMES.find(b => b.id === this.biome);
  }

  getCompanionDef() {
    if (!this.companion) return null;
    return COMPANIONS.find(c => c.id === this.companion);
  }

  hasBiome(id) {
    return this.unlockedBiomes.includes(id);
  }

  hasCompanion(id) {
    return this.unlockedCompanions.includes(id);
  }

  unlockBiome(id) {
    if (!id || this.hasBiome(id)) return false;
    this.unlockedBiomes.push(id);
    this.save();
    return true;
  }

  unlockCompanion(id) {
    if (!id || this.hasCompanion(id)) return false;
    this.unlockedCompanions.push(id);
    this.save();
    return true;
  }

  addChillPoints(amount, reason = 'reward') {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.chillPoints += Math.round(amount);
    this.lastReward = { amount: Math.round(amount), reason, at: Date.now() };
    this.save();
  }

  markMilestone(id, payload = {}) {
    this.milestones[id] = {
      completed: true,
      completedAt: Date.now(),
      ...payload,
    };
    this.save();
  }

  isMilestoneComplete(id) {
    return Boolean(this.milestones[id]?.completed);
  }

  setNextBiome() {
    const unlocked = BIOMES.filter((b) => this.hasBiome(b.id));
    const current = unlocked.findIndex((b) => b.id === this.biome);
    const next = unlocked[(current + 1 + unlocked.length) % unlocked.length];
    if (!next) return;
    this.setBiome(next.id);
  }

  setPrevBiome() {
    const unlocked = BIOMES.filter((b) => this.hasBiome(b.id));
    const current = unlocked.findIndex((b) => b.id === this.biome);
    const prev = unlocked[(current - 1 + unlocked.length) % unlocked.length];
    if (!prev) return;
    this.setBiome(prev.id);
  }

  setBiome(id) {
    const idx = BIOMES.findIndex((b) => b.id === id);
    if (idx < 0 || !this.hasBiome(id)) return false;
    this.biomeIndex = idx;
    this.biome = id;
    this._normalizeSelections();
    this.save();
    return true;
  }

  setCompanion(id) {
    if (!id) {
      this.companion = null;
      this.save();
      return true;
    }
    const def = COMPANIONS.find((c) => c.id === id);
    if (!def || !this.hasCompanion(id)) return false;
    const biome = this.getBiomeDef();
    if (!biome?.companions.includes(id)) return false;
    this.companion = id;
    this.save();
    return true;
  }

  _normalizeSelections() {
    if (!this.hasBiome(this.biome)) {
      this.biome = INITIAL_UNLOCKED_BIOMES[0];
    }
    this.biomeIndex = Math.max(0, BIOMES.findIndex((b) => b.id === this.biome));
    const def = this.getBiomeDef();
    if (
      this.companion &&
      (!this.hasCompanion(this.companion) || !def?.companions.includes(this.companion))
    ) {
      this.companion = null;
    }
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.unlockedBiomes)) this.unlockedBiomes = data.unlockedBiomes;
      if (Array.isArray(data.unlockedCompanions)) this.unlockedCompanions = data.unlockedCompanions;
      if (typeof data.chillPoints === 'number') this.chillPoints = data.chillPoints;
      if (data.milestones && typeof data.milestones === 'object') this.milestones = data.milestones;
      if (typeof data.biome === 'string') this.biome = data.biome;
      if (typeof data.companion === 'string' || data.companion === null) this.companion = data.companion;
      if (typeof data.weather === 'string') this.weather = data.weather;
      if (typeof data.time === 'string') this.time = data.time;
    } catch (err) {
      console.warn('Failed to load save state:', err);
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        biome: this.biome,
        companion: this.companion,
        weather: this.weather,
        time: this.time,
        chillPoints: this.chillPoints,
        unlockedBiomes: this.unlockedBiomes,
        unlockedCompanions: this.unlockedCompanions,
        milestones: this.milestones,
      }));
    } catch (err) {
      console.warn('Failed to save state:', err);
    }
  }
}

export const gameState = new GameState();
