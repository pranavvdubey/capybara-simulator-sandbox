import { eventBus, Events } from '../core/EventBus.js';

const TRACKS = [
  'audio/lofi_loop_01.mp3', 'audio/lofi_loop_02.mp3', 'audio/lofi_loop_03.mp3',
  'audio/lofi_loop_04.mp3', 'audio/lofi_loop_05.mp3', 'audio/lofi_loop_06.mp3',
  'audio/lofi_loop_07.mp3', 'audio/lofi_loop_08.mp3', 'audio/lofi_loop_09.mp3',
];
const MUSIC_VOL = 0.3;
const RAIN_VOL  = 0.4;

export class AudioManager {
  constructor() {
    this._muted = false;
    this._savedVol = MUSIC_VOL;
    this._trackIdx = Math.floor(Math.random() * TRACKS.length);
    this._audio = null;
    this._rainAudio = null;
    this._started = false;
    this._ambientCtx = null;
    this._ambientMaster = null;
    this._ambientSources = {};
    this._ambientTargets = { meadow: 0, riverside: 0, jungle: 0, mountain: 0, snowy: 0, 'lofi-desk': 0 };
    this._peakGain = 0;
  }

  init() {
    this._audio = new Audio(TRACKS[this._trackIdx]);
    this._audio.volume = MUSIC_VOL;
    this._audio.addEventListener('ended', () => this._nextTrack());

    this._rainAudio = new Audio('audio/rain_01.mp3');
    this._rainAudio.loop = true;
    this._rainAudio.volume = 0;

    // Start on first user interaction (browser autoplay policy)
    const start = () => {
      if (!this._started) {
        this._started = true;
        this._ensureAmbient();
        this._ambientCtx?.resume?.().catch?.(() => {});
        this._audio.play().catch(() => {});
      }
      document.removeEventListener('click', start);
      document.removeEventListener('touchstart', start);
    };
    document.addEventListener('click', start);
    document.addEventListener('touchstart', start);
    this._audio.play().catch(() => {}); // may silently fail until interaction

    eventBus.on(Events.AUDIO_SKIP, () => this._skipTrack());
    eventBus.on(Events.AUDIO_MUTE, () => this._toggleMute());
    eventBus.on(Events.BIOME_CHANGED, ({ biome }) => this.setBiomeAmbience(biome));
    eventBus.on(Events.PEAK_MOMENT_STARTED, () => this.setPeakMoment(true));
    eventBus.on(Events.PEAK_MOMENT_ENDED, () => this.setPeakMoment(false));
  }

  setRainVolume(t) {
    // t = 0 (dry) to 1 (full rain)
    if (!this._rainAudio) return;
    if (t > 0 && this._rainAudio.paused) {
      this._rainAudio.play().catch(() => {});
    }
    this._rainAudio.volume = this._muted ? 0 : t * RAIN_VOL;
    if (t === 0 && !this._rainAudio.paused) this._rainAudio.pause();
  }

  setBiomeAmbience(biome) {
    if (this._started) this._ensureAmbient();
    for (const key of Object.keys(this._ambientTargets)) {
      this._ambientTargets[key] = key === biome ? 1 : 0;
    }
  }

  setPeakMoment(enabled) {
    this._peakGain = enabled ? 1 : 0;
  }

  update(delta) {
    if (!this._ambientCtx) return;
    for (const [key, node] of Object.entries(this._ambientSources)) {
      const target = (this._ambientTargets[key] || 0) * (this._muted ? 0 : 1);
      node.gain.gain.value += (target - node.gain.gain.value) * Math.min(1, delta * 2.2);
    }
    if (this._ambientMaster) {
      const target = this._muted ? 0 : 0.08 + this._peakGain * 0.03;
      this._ambientMaster.gain.value += (target - this._ambientMaster.gain.value) * Math.min(1, delta * 2.5);
    }
  }

  get muted() { return this._muted; }

  _nextTrack() {
    this._trackIdx = (this._trackIdx + 1) % TRACKS.length;
    const vol = this._audio.volume;
    this._audio = new Audio(TRACKS[this._trackIdx]);
    this._audio.volume = vol;
    this._audio.addEventListener('ended', () => this._nextTrack());
    this._audio.play().catch(() => {});
  }

  _skipTrack() {
    const wasPlaying = !this._audio.paused;
    const vol = this._audio.volume;
    this._audio.pause();
    this._trackIdx = (this._trackIdx + 1) % TRACKS.length;
    this._audio = new Audio(TRACKS[this._trackIdx]);
    this._audio.volume = vol;
    this._audio.addEventListener('ended', () => this._nextTrack());
    if (wasPlaying) this._audio.play().catch(() => {});
  }

  _toggleMute() {
    this._muted = !this._muted;
    if (this._muted) {
      this._savedVol = this._audio.volume || MUSIC_VOL;
      this._audio.volume = 0;
      if (this._rainAudio) this._rainAudio.volume = 0;
    } else {
      this._audio.volume = this._savedVol;
    }
  }

  _ensureAmbient() {
    if (this._ambientCtx || !window.AudioContext) return;
    this._ambientCtx = new window.AudioContext();
    this._ambientMaster = this._ambientCtx.createGain();
    this._ambientMaster.gain.value = 0.08;
    this._ambientMaster.connect(this._ambientCtx.destination);
    this._ambientSources.meadow = this._createOscLayer('triangle', 220, 0.03);
    this._ambientSources.riverside = this._createNoiseLayer(800, 0.05);
    this._ambientSources.jungle = this._createOscLayer('sawtooth', 180, 0.02);
    this._ambientSources.mountain = this._createOscLayer('sine', 140, 0.025);
    this._ambientSources.snowy = this._createNoiseLayer(1200, 0.04);
    this._ambientSources['lofi-desk'] = this._createOscLayer('triangle', 260, 0.028);
  }

  _createOscLayer(type, freq, depth) {
    const osc = this._ambientCtx.createOscillator();
    const lfo = this._ambientCtx.createOscillator();
    const lfoGain = this._ambientCtx.createGain();
    const filter = this._ambientCtx.createBiquadFilter();
    const gain = this._ambientCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    lfo.type = 'sine';
    lfo.frequency.value = 0.08 + Math.random() * 0.06;
    lfoGain.gain.value = freq * depth;
    filter.type = 'lowpass';
    filter.frequency.value = freq * 2.1;
    gain.gain.value = 0;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this._ambientMaster);
    osc.start();
    lfo.start();
    return { gain };
  }

  _createNoiseLayer(filterFreq, level) {
    const buffer = this._ambientCtx.createBuffer(1, this._ambientCtx.sampleRate * 2, this._ambientCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
    const source = this._ambientCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = this._ambientCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this._ambientCtx.createGain();
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this._ambientMaster);
    source.start();
    return { gain, level };
  }
}
