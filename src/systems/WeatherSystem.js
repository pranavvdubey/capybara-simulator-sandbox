import * as THREE from 'three';
import { NIGHT, RAIN_OVERLAY } from '../core/Constants.js';

// Manages rain particles (GPU), day/night, and atmosphere transitions.
// Receives biome colors via setBiomeAtmosphere() when biome changes.
export class WeatherSystem {
  constructor() {
    this._scene    = null;
    this._camera   = null;
    this._skyMat   = null;
    this._sun      = null;
    this._hemi     = null;
    this._ambient  = null;

    // Weather state
    this._rainT      = 0;   // 0=dry, 1=full rain
    this._rainTarget = 0;
    this._rainSpeed  = 0.3;
    this._rainParticles = null;
    this._rainUniforms  = null;

    // Day/night state
    this._nightT      = 0;   // 0=day, 1=night
    this._nightTarget = 0;
    this._nightSpeed  = 0.35;

    // Stars (night)
    this._stars = null;

    // Snow
    this._snowParticles = null;
    this._snowUniforms  = null;

    // Current biome atmosphere baseline (day, clear)
    this._biomeBg       = new THREE.Color(0xc8dce8);
    this._biomeFogDen   = 0.014;
    this._biomeSkyTop   = new THREE.Color(0x87CEEB);
    this._biomeSkyBot   = new THREE.Color(0xd0ddd0);
    this._biomeSunInt   = 1.2;
    this._biomeHemiSky  = new THREE.Color(0xd4e8f0);
    this._biomeHemiGnd  = new THREE.Color(0x3a5f2a);
    this._biomeAmbInt   = 0.4;

    // Audio ref (set by main)
    this.audio = null;
  }

  init(scene, camera, sun, hemi, ambient, skyMat) {
    this._scene   = scene;
    this._camera  = camera;
    this._sun     = sun;
    this._hemi    = hemi;
    this._ambient = ambient;
    this._skyMat  = skyMat;

    this._buildRain();
    this._buildStars();
  }

  // Called by BiomeManager when biome changes; sets day-clear atmosphere baseline
  setBiomeAtmosphere(biomeDef) {
    this._biomeBg.set(biomeDef.bg);
    this._biomeFogDen = biomeDef.fogDensity;
    this._biomeSkyTop.set(biomeDef.skyTop);
    this._biomeSkyBot.set(biomeDef.skyBot);
    this._biomeSunInt = biomeDef.sunIntensity;
    this._biomeHemiSky.set(biomeDef.hemiSky);
    this._biomeHemiGnd.set(biomeDef.hemiGround);
    this._biomeAmbInt = biomeDef.ambientIntensity;
  }

  setRain(enabled) {
    this._rainTarget = enabled ? 1 : 0;
  }

  setSnow(enabled) {
    if (enabled && !this._snowParticles) {
      this._buildSnow();
    }
    if (this._snowParticles) {
      this._snowParticles.visible = !!enabled;
    }
  }

  setNight(enabled) {
    this._nightTarget = enabled ? 1 : 0;
  }

  update(delta, elapsed) {
    // Lerp transitions
    this._rainT  = this._lerp(this._rainT,  this._rainTarget,  this._rainSpeed  * delta);
    this._nightT = this._lerp(this._nightT, this._nightTarget, this._nightSpeed * delta);

    const r = this._rainT;
    const n = this._nightT;

    // ── Rain GPU particles ──
    if (this._rainUniforms) {
      this._rainUniforms.time.value    = elapsed;
      this._rainUniforms.camPos.value.copy(this._camera.position);
      this._rainUniforms.opacity.value = r * 0.8;
    }

    // ── Compute blended atmosphere ──
    // Step 1: biome baseline
    const bg       = this._biomeBg.clone();
    const fogDen   = this._biomeFogDen;
    const skyTop   = this._biomeSkyTop.clone();
    const skyBot   = this._biomeSkyBot.clone();
    let   sunInt   = this._biomeSunInt;
    const hemiSky  = this._biomeHemiSky.clone();
    let   ambInt   = this._biomeAmbInt;

    // Step 2: apply rain overlay
    const rainBg      = new THREE.Color(RAIN_OVERLAY.bgShift);
    const rainSkyTop  = new THREE.Color(RAIN_OVERLAY.skyTopShift);
    const rainSkyBot  = new THREE.Color(RAIN_OVERLAY.skyBotShift);
    bg.lerp(rainBg, r * 0.7);
    skyTop.lerp(rainSkyTop, r);
    skyBot.lerp(rainSkyBot, r);
    sunInt  *= (1 - r * RAIN_OVERLAY.sunReduce * 0.8);
    ambInt  += r * RAIN_OVERLAY.ambientAdd;
    const fogFinal = fogDen + r * RAIN_OVERLAY.fogAdd;

    // Step 3: apply night overlay
    const nightBg      = new THREE.Color(NIGHT.bg);
    const nightSkyTop  = new THREE.Color(NIGHT.skyTop);
    const nightSkyBot  = new THREE.Color(NIGHT.skyBot);
    const nightHemi    = new THREE.Color(NIGHT.hemiSky);
    bg.lerp(nightBg, n);
    skyTop.lerp(nightSkyTop, n);
    skyBot.lerp(nightSkyBot, n);
    hemiSky.lerp(nightHemi, n);
    sunInt  = sunInt * (1 - n) + NIGHT.moonIntensity * n;
    ambInt  = ambInt * (1 - n) + NIGHT.ambientIntensity * n;

    // Apply to scene
    this._scene.background.copy(bg);
    this._scene.fog.color.copy(bg); // fog matches sky
    this._scene.fog.density = fogFinal + n * 0.004;

    if (this._skyMat) {
      this._skyMat.uniforms.topColor.value.copy(skyTop);
      this._skyMat.uniforms.bottomColor.value.copy(skyBot);
    }

    this._sun.intensity     = sunInt;
    this._hemi.color.copy(hemiSky);
    this._ambient.intensity = ambInt;

    // Stars visibility
    if (this._stars) {
      this._stars.material.opacity = n * 0.9;
    }

    // Snow particles
    if (this._snowUniforms) {
      this._snowUniforms.time.value   = elapsed;
      this._snowUniforms.camPos.value.copy(this._camera.position);
    }

    // Rain audio
    if (this.audio) {
      this.audio.setRainVolume(r);
    }
  }

  _lerp(cur, target, step) {
    if (Math.abs(cur - target) < 0.001) return target;
    return cur + (target - cur) * Math.min(step * 3.5, 1);
    // Note: step is already delta*speed so we use it directly
  }

  _buildRain() {
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const count = isMobile ? 1100 : 2200;

    const speeds    = new Float32Array(count);
    const seedsY    = new Float32Array(count);
    const xzOffsets = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      speeds[i]        = 8 + Math.random() * 6;
      seedsY[i]        = Math.random();
      xzOffsets[i * 2]   = (Math.random() - 0.5) * 50;
      xzOffsets[i * 2+1] = (Math.random() - 0.5) * 50;
    }

    const geo = new THREE.BufferGeometry();
    const dummyPos = new Float32Array(count * 3);
    geo.setAttribute('position',  new THREE.BufferAttribute(dummyPos, 3));
    geo.setAttribute('aSpeed',    new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute('aSeedY',    new THREE.BufferAttribute(seedsY, 1));
    geo.setAttribute('aXZOffset', new THREE.BufferAttribute(xzOffsets, 2));

    // Raindrop sprite
    const canvas = document.createElement('canvas');
    canvas.width = 12; canvas.height = 160;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0,   'rgba(180,205,225,0)');
    grad.addColorStop(0.15,'rgba(205,225,245,0.18)');
    grad.addColorStop(0.45,'rgba(230,242,255,0.58)');
    grad.addColorStop(0.8, 'rgba(205,225,245,0.12)');
    grad.addColorStop(1,   'rgba(180,205,225,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(5, 0, 2, 160);
    const tex = new THREE.CanvasTexture(canvas);

    this._rainUniforms = {
      time:    { value: 0 },
      camPos:  { value: new THREE.Vector3() },
      opacity: { value: 0 },
      map:     { value: tex },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this._rainUniforms,
      vertexShader: `
        attribute float aSpeed;
        attribute float aSeedY;
        attribute vec2  aXZOffset;
        uniform float time;
        uniform vec3  camPos;
        uniform float opacity;
        varying float vAlpha;
        void main() {
          float y = mod(aSeedY * 26.0 - time * aSpeed, 27.0) - 2.0;
          vec3 wp = vec3(camPos.x + aXZOffset.x, y, camPos.z + aXZOffset.y);
          vec4 mvPos = viewMatrix * vec4(wp, 1.0);
          gl_Position  = projectionMatrix * mvPos;
          gl_PointSize = 340.0 / -mvPos.z;
          vAlpha = opacity;
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        varying float vAlpha;
        void main() {
          vec4 t = texture2D(map, gl_PointCoord);
          if (t.a < 0.01) discard;
          gl_FragColor = vec4(t.rgb, t.a * vAlpha);
        }
      `,
      transparent: true,
      depthWrite:  false,
      blending:    THREE.NormalBlending,
    });

    this._rainParticles = new THREE.Points(geo, mat);
    this._rainParticles.frustumCulled = false;
    this._scene.add(this._rainParticles);
  }

  _buildSnow() {
    const count = 900;
    const speeds = new Float32Array(count);
    const seeds  = new Float32Array(count);
    const xzOff  = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      speeds[i]      = 0.35 + Math.random() * 0.55;
      seeds[i]       = Math.random();
      xzOff[i * 2]   = (Math.random() - 0.5) * 40;
      xzOff[i * 2+1] = (Math.random() - 0.5) * 40;
    }

    const geo = new THREE.BufferGeometry();
    const dummy = new Float32Array(count * 3);
    geo.setAttribute('position',  new THREE.BufferAttribute(dummy, 3));
    geo.setAttribute('aSpeed',    new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute('aSeedY',    new THREE.BufferAttribute(seeds, 1));
    geo.setAttribute('aXZOffset', new THREE.BufferAttribute(xzOff, 2));

    this._snowUniforms = {
      time:    { value: 0 },
      camPos:  { value: new THREE.Vector3() },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this._snowUniforms,
      vertexShader: `
        attribute float aSpeed;
        attribute float aSeedY;
        attribute vec2  aXZOffset;
        uniform float time;
        uniform vec3  camPos;
        void main() {
          float y = mod(aSeedY * 18.0 - time * aSpeed, 19.0) + 0.5;
          float drift = sin(time * 0.4 + aSeedY * 6.28) * 1.2;
          vec3 wp = vec3(camPos.x + aXZOffset.x + drift, y, camPos.z + aXZOffset.y);
          vec4 mvPos = viewMatrix * vec4(wp, 1.0);
          gl_Position  = projectionMatrix * mvPos;
          gl_PointSize = 280.0 / -mvPos.z;
        }
      `,
      fragmentShader: `
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = dot(uv, uv);
          if (d > 0.25) discard;
          float alpha = (0.25 - d) * 4.0 * 0.88;
          gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
        }
      `,
      transparent: true,
      depthWrite:  false,
    });

    this._snowParticles = new THREE.Points(geo, mat);
    this._snowParticles.frustumCulled = false;
    this._scene.add(this._snowParticles);
  }

  _buildStars() {
    const count = 1200;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Random point on sphere of radius 180
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 175 + Math.random() * 10;
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)); // upper hemisphere only
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.4,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this._stars = new THREE.Points(geo, mat);
    this._stars.frustumCulled = false;
    this._scene.add(this._stars);
  }
}
