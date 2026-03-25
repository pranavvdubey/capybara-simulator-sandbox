// ─── BIOME DEFINITIONS ────────────────────────────────────────────────────────
// Each biome controls: environment visuals, capybara position, camera, companions

export const BIOMES = [
  {
    id: 'meadow',
    name: 'Meadow',
    // Which env layer groups to show (defined in BiomeManager)
    envLayers: ['flowers', 'palms', 'grass'],
    // Capybara world position for this biome
    capyPos: { x: 0, z: 0 },
    capyRotY: 0,
    // OrbitControls target & constraints
    orbitTarget: { x: 0, y: 0.5, z: 0 },
    cameraPos: { x: 3.5, y: 1.8, z: 4 },
    minDist: 3, maxDist: 12,
    minPolar: Math.PI / 4, maxPolar: Math.PI / 2.05,
    // Atmosphere (day)
    bg:       '#c8dce8',
    fogDensity: 0.014,
    skyTop:   '#87CEEB',
    skyBot:   '#d0ddd0',
    sunIntensity: 1.2,
    hemiSky:  '#d4e8f0',
    hemiGround: '#3a5f2a',
    ambientIntensity: 0.4,
    // Companions available in this biome
    companions: ['bee', 'rabbit'],
  },
  {
    id: 'riverside',
    name: 'Riverside',
    envLayers: ['rocks', 'reeds'],
    capyPos: { x: 0, z: -5 },
    capyRotY: 0,
    orbitTarget: { x: 0, y: 0.5, z: -5 },
    cameraPos: { x: 3, y: 1.8, z: -1 },
    minDist: 3, maxDist: 10,
    minPolar: Math.PI / 5, maxPolar: Math.PI / 2.05,
    bg:       '#a8c0d4',
    fogDensity: 0.018,
    skyTop:   '#7aaabf',
    skyBot:   '#b0c0be',
    sunIntensity: 0.9,
    hemiSky:  '#b8d0e0',
    hemiGround: '#3a5040',
    ambientIntensity: 0.5,
    companions: ['firefly', 'frog'],
  },
  {
    id: 'jungle',
    name: 'Jungle',
    envLayers: ['dense-trees'],
    capyPos: { x: 0, z: -2 },
    capyRotY: 0,
    orbitTarget: { x: 0, y: 0.5, z: -2 },
    cameraPos: { x: 2.5, y: 1.8, z: 2 },
    minDist: 2, maxDist: 8,
    minPolar: Math.PI / 4, maxPolar: Math.PI / 2.05,
    bg:       '#7a9878',
    fogDensity: 0.022,
    skyTop:   '#4a7a60',
    skyBot:   '#5a7050',
    sunIntensity: 0.7,
    hemiSky:  '#a0c890',
    hemiGround: '#2a4a20',
    ambientIntensity: 0.55,
    companions: ['bee', 'firefly'],
  },
];

// ─── COMPANION DEFINITIONS ─────────────────────────────────────────────────────
// placementMode: 'hover_around' | 'sit_on_capy'
// preferTime: 'day' | 'night' | 'any'
// preferWeather: 'clear' | 'rain' | 'any'

export const COMPANIONS = [
  {
    id: 'bee',
    name: 'Bee',
    emoji: '🐝',
    placementMode: 'hover_around',
    allowedBiomes: ['meadow', 'jungle'],
    preferTime: 'day',
    preferWeather: 'clear',
    hoverRadius: 1.4,
    hoverHeight: 1.6,
    hoverSpeed: 0.6,   // orbit cycles per second * 2π
    specialCombo: { biome: 'meadow', time: 'day', weather: 'clear' },
  },
  {
    id: 'firefly',
    name: 'Firefly',
    emoji: '✨',
    placementMode: 'hover_around',
    allowedBiomes: ['riverside', 'jungle'],
    preferTime: 'night',
    preferWeather: 'any',
    hoverRadius: 1.0,
    hoverHeight: 1.4,
    hoverSpeed: 0.4,
    specialCombo: { time: 'night' },
  },
  {
    id: 'frog',
    name: 'Frog',
    emoji: '🐸',
    placementMode: 'sit_on_capy',
    allowedBiomes: ['riverside'],
    preferTime: 'any',
    preferWeather: 'rain',
    sitAnchor: { x: 0, y: 0.72, z: 0.0 },  // world offset from capy group position
    specialCombo: { weather: 'rain', biome: 'riverside' },
  },
  {
    id: 'rabbit',
    name: 'Rabbit',
    emoji: '🐰',
    placementMode: 'sit_on_capy',
    allowedBiomes: ['meadow'],
    preferTime: 'day',
    preferWeather: 'clear',
    sitAnchor: { x: 0, y: 0.72, z: 0.0 },
    specialCombo: { biome: 'meadow', time: 'day' },
  },
];

// ─── SCORING ───────────────────────────────────────────────────────────────────
export const SCORING = {
  // Solo (no companion) base score
  soloBase: 1,
  // Bonus for solo at night / in rain
  soloNightBonus: 2,
  soloRainBonus: 1,
  // With companion: base (companion is always in its biome so biome match guaranteed)
  companionBase: 3,
  timeMatchBonus: 2,
  weatherMatchBonus: 2,
  specialComboBonus: 2,
  // Thresholds
  thresholds: { neutral: 0, good: 3, great: 6 },
};

// ─── ATMOSPHERE ────────────────────────────────────────────────────────────────
export const NIGHT = {
  bg:         '#0d1520',
  fogDensity: 0.025,
  skyTop:     '#080c18',
  skyBot:     '#14202e',
  sunIntensity: 0.05,
  moonIntensity: 0.25,
  ambientIntensity: 0.15,
  hemiSky:    '#1a2840',
  hemiGround: '#0a1008',
};

export const RAIN_OVERLAY = {
  bgShift:      '#5a6268',
  fogAdd:       0.010,
  skyTopShift:  '#505860',
  skyBotShift:  '#788080',
  sunReduce:    0.8,    // fraction to reduce sun by
  ambientAdd:   0.15,
};
