import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { eventBus, Events } from './core/EventBus.js';
import { gameState } from './core/GameState.js';

import { SceneManager }     from './scene/SceneManager.js';
import { CapybaraActor }    from './scene/CapybaraActor.js';
import { BiomeManager }     from './scene/BiomeManager.js';
import { CompanionManager } from './scene/CompanionManager.js';

import { WeatherSystem } from './systems/WeatherSystem.js';
import { AudioManager }  from './systems/AudioManager.js';
import { RatingSystem }  from './systems/RatingSystem.js';
import { ProgressionSystem } from './systems/ProgressionSystem.js';
import { InteractionSystem } from './systems/InteractionSystem.js';

import { BiomeSelector }     from './ui/BiomeSelector.js';
import { CompanionSelector } from './ui/CompanionSelector.js';
import { RatingMeter }       from './ui/RatingMeter.js';
import { HUD }               from './ui/HUD.js';
import { JournalPanel } from './ui/JournalPanel.js';
import { InteractionPanel } from './ui/InteractionPanel.js';

// ── ASSET LIST ────────────────────────────────────────────────────────────────
const ASSET_KEYS = {
  'capybara':   'models/capybara-rigged.glb',
  'flower':     'models/flower.glb',
  'grass-turf': 'models/grass-turf.glb',
  'palm-trees': 'models/palm-trees.glb',
  'tree1':      'models/tree1.glb',
  'tree2':      'models/tree2.glb',
  'trees':      'models/trees.glb',
  'rocks':      'models/rocks.glb',
  'rock2':      'models/rock2.glb',
};

async function main() {
  // ── DOM REFS ───────────────────────────────────────────────────────────────
  const loadEl   = document.getElementById('loading');
  const loadBar  = document.getElementById('loadBar');
  const loadText = document.getElementById('loadText');
  const hudEl    = document.getElementById('hud');

  // ── INIT SCENE ────────────────────────────────────────────────────────────
  const sm      = new SceneManager();
  const weather = new WeatherSystem();
  weather.init(sm.scene, sm.camera, sm.sun, sm.hemi, sm.ambient, sm.skyMat);

  const audio = new AudioManager();
  audio.init();
  weather.audio = audio;

  // ── LOAD ASSETS ───────────────────────────────────────────────────────────
  const loader = new GLTFLoader();
  const models = {};
  const total  = Object.keys(ASSET_KEYS).length;
  let   loaded = 0;

  for (const [key, path] of Object.entries(ASSET_KEYS)) {
    try {
      loadText.textContent = `loading ${key}...`;
      const gltf = await new Promise((res, rej) => loader.load(path, res, undefined, rej));
      models[key] = gltf.scene;
    } catch (e) {
      console.warn(`Failed to load ${key}:`, e);
    }
    loaded++;
    loadBar.style.width = `${(loaded / total) * 100}%`;
  }

  // ── CAPYBARA ──────────────────────────────────────────────────────────────
  loadText.textContent = 'placing capybara...';
  const capy = new CapybaraActor();
  await capy.load(loader, sm.scene);
  sm.setFocusAnchor(capy);

  // ── BIOME ENVIRONMENT ─────────────────────────────────────────────────────
  const biomeManager = new BiomeManager(sm.scene, sm);
  biomeManager.build(models);
  biomeManager.setBiome(gameState.biome, capy, weather);

  // ── COMPANION MANAGER ─────────────────────────────────────────────────────
  const companions = new CompanionManager(sm.scene);
  companions.setCapybara(capy);

  // ── RATING ────────────────────────────────────────────────────────────────
  const rating = new RatingSystem();
  const progression = new ProgressionSystem();
  const interactions = new InteractionSystem(sm.scene, capy, companions);

  // ── UI ────────────────────────────────────────────────────────────────────
  const biomeSelector     = new BiomeSelector(document.getElementById('biome-selector'));
  const companionSelector = new CompanionSelector(document.getElementById('companion-selector'));
  const ratingMeter       = new RatingMeter(document.getElementById('rating-meter'), rating);
  const hud               = new HUD(document.getElementById('controls'));
  const journal           = new JournalPanel(document.getElementById('journal-panel'));
  const interactionPanel  = new InteractionPanel(document.getElementById('interaction-panel'));
  void journal;
  void interactionPanel;

  const syncMood = () => {
    sm.setPostProcessingMood({
      biomeId: gameState.biome,
      weather: gameState.weather,
      time: gameState.time,
      rating: gameState.rating,
    });
  };

  // ── EVENT WIRING ──────────────────────────────────────────────────────────
  eventBus.on(Events.BIOME_CHANGED, ({ biome }) => {
    biomeManager.setBiome(biome, capy, weather);
    // Clear companion (selector already cleared state via GameState)
    companions.setCompanion(gameState.companion);
    ratingMeter.recalculate();
    eventBus.emit(Events.PROGRESSION_CHANGED, progression.snapshot());
    audio.setBiomeAmbience(biome);
    syncMood();
  });

  eventBus.on(Events.COMPANION_CHANGED, ({ companion }) => {
    companions.setCompanion(companion);
    ratingMeter.recalculate();
    eventBus.emit(Events.PROGRESSION_CHANGED, progression.snapshot());
    syncMood();
  });

  eventBus.on(Events.WEATHER_CHANGED, ({ weather: w }) => {
    weather.setRain(w === 'rain');
    ratingMeter.recalculate();
    syncMood();
  });

  eventBus.on(Events.TIME_CHANGED, ({ time }) => {
    weather.setNight(time === 'night');
    companions.setNight(time === 'night');
    ratingMeter.recalculate();
    syncMood();
  });

  eventBus.on(Events.RATING_CHANGED, (data) => {
    progression.onRatingChanged(data);
  });

  eventBus.on(Events.INTERACTION_TRIGGERED, ({ type }) => {
    interactions.trigger(type);
  });

  eventBus.on(Events.PEAK_MOMENT_STARTED, ({ biome }) => {
    sm.setPeakMoment(true);
    interactions.startPeakMoment(biome);
    syncMood();
  });

  eventBus.on(Events.PEAK_MOMENT_ENDED, () => {
    sm.setPeakMoment(false);
    interactions.endPeakMoment();
    syncMood();
  });

  // Initial rating
  ratingMeter.recalculate();
  audio.setBiomeAmbience(gameState.biome);
  eventBus.emit(Events.PROGRESSION_CHANGED, progression.snapshot());
  syncMood();

  // ── HIDE LOADING ──────────────────────────────────────────────────────────
  loadEl.style.display = 'none';
  hudEl.style.display  = 'flex';

  // ── GAME LOOP ─────────────────────────────────────────────────────────────
  const clock = new THREE.Clock();
  let elapsed = 0;

  const step = (delta) => {
    elapsed += delta;

    capy.update(delta, elapsed);
    companions.update(delta, elapsed);
    biomeManager.update(delta, elapsed);
    weather.update(delta, elapsed);
    interactions.update(delta, elapsed);
    progression.update(elapsed);
    audio.update(delta);

    sm.render(delta, elapsed);
  };

  window.advanceTime = (ms = 16.667) => {
    const total = Math.max(ms, 16.667);
    const steps = Math.max(1, Math.round(total / 16.667));
    const delta = (total / 1000) / steps;
    for (let i = 0; i < steps; i++) step(delta);
  };

  window.render_game_to_text = () => {
    const focusTarget = capy.getHeadWorldPos();
    return JSON.stringify({
      coordinateSystem: 'world space, +x right, +y up, -z forward into the scene',
      biome: gameState.biome,
      companion: gameState.companion,
      weather: gameState.weather,
      time: gameState.time,
      rating: gameState.rating,
      ratingScore: gameState.ratingScore,
      chillPoints: gameState.chillPoints,
      unlockedBiomes: gameState.unlockedBiomes,
      unlockedCompanions: gameState.unlockedCompanions,
      activeInteraction: gameState.activeInteraction,
      peakMoment: gameState.peakMoment,
      camera: {
        x: Number(sm.camera.position.x.toFixed(2)),
        y: Number(sm.camera.position.y.toFixed(2)),
        z: Number(sm.camera.position.z.toFixed(2)),
      },
      focusTarget: {
        x: Number(focusTarget.x.toFixed(2)),
        y: Number(focusTarget.y.toFixed(2)),
        z: Number(focusTarget.z.toFixed(2)),
      },
    });
  };

  sm.renderer.setAnimationLoop(() => {
    const delta = Math.min(clock.getDelta(), 0.1); // cap — no death spirals
    step(delta);
  });
}

main().catch(err => {
  console.error('Fatal error during startup:', err);
  const loadText = document.getElementById('loadText');
  if (loadText) loadText.textContent = 'Error loading — check console';
});
