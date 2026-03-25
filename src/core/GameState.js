import { BIOMES, COMPANIONS } from './Constants.js';

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
  }

  getBiomeDef() {
    return BIOMES.find(b => b.id === this.biome);
  }

  getCompanionDef() {
    if (!this.companion) return null;
    return COMPANIONS.find(c => c.id === this.companion);
  }

  setNextBiome() {
    this.biomeIndex = (this.biomeIndex + 1) % BIOMES.length;
    this.biome = BIOMES[this.biomeIndex].id;
    // Clear companion if not available in new biome
    const def = this.getBiomeDef();
    if (this.companion && !def.companions.includes(this.companion)) {
      this.companion = null;
    }
  }

  setPrevBiome() {
    this.biomeIndex = (this.biomeIndex - 1 + BIOMES.length) % BIOMES.length;
    this.biome = BIOMES[this.biomeIndex].id;
    const def = this.getBiomeDef();
    if (this.companion && !def.companions.includes(this.companion)) {
      this.companion = null;
    }
  }
}

export const gameState = new GameState();
