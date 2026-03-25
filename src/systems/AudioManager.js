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
}
