import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  BlendFunction,
  BloomEffect,
  BrightnessContrastEffect,
  ChromaticAberrationEffect,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  HueSaturationEffect,
  NoiseEffect,
  RenderPass,
  SMAAEffect,
  VignetteEffect,
} from 'postprocessing';
import { BIOMES } from '../core/Constants.js';
import { OceanWater } from './OceanWater.js';

// Owns: renderer, camera, OrbitControls, lights, terrain, sky, pond
// Does NOT own biome-specific props — BiomeManager handles those
export class SceneManager {
  constructor() {
    this._isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
    this._focusAnchor = null;
    this._focusPoint = new THREE.Vector3();
    this._cameraTargetPos = new THREE.Vector3();
    this._cameraTargetLook = new THREE.Vector3();
    this._peakMoment = 0;
    this._peakTarget = 0;
    this._postState = {
      bloom:       0.22,
      noise:       0.012,
      vignette:    0.16,
      aberration:  0.00018,
      contrast:    0.02,
      saturation:  0.12,
      dofBokeh:    2.8,
    };
    this._postTarget = { ...this._postState };

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this._isMobile,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this._isMobile ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = this._isMobile ? THREE.BasicShadowMap : THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const startBiome = BIOMES[0];
    this.scene.background = new THREE.Color(startBiome.bg);
    this.scene.fog = new THREE.FogExp2(new THREE.Color(startBiome.bg), startBiome.fogDensity);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(startBiome.cameraPos.x, startBiome.cameraPos.y, startBiome.cameraPos.z);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this._applyBiomeCamera(startBiome);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.autoRotate = false;

    // Lights
    this.sun = new THREE.DirectionalLight(0xfff4d6, startBiome.sunIntensity);
    this.sun.position.set(10, 20, 5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this._isMobile ? 512 : 1024, this._isMobile ? 512 : 1024);
    this.sun.shadow.camera.left   = -20;
    this.sun.shadow.camera.right  = 20;
    this.sun.shadow.camera.top    = 20;
    this.sun.shadow.camera.bottom = -20;
    this.sun.shadow.camera.near   = 0.5;
    this.sun.shadow.camera.far    = 60;
    this.sun.shadow.bias = -0.001;
    this.scene.add(this.sun);

    this.hemi = new THREE.HemisphereLight(
      new THREE.Color(startBiome.hemiSky),
      new THREE.Color(startBiome.hemiGround),
      0.8,
    );
    this.scene.add(this.hemi);

    this.ambient = new THREE.AmbientLight(0x607060, startBiome.ambientIntensity);
    this.scene.add(this.ambient);

    // Terrain & static env
    this.skyMat = null;
    this.pondWater = null;
    this._buildBase();
    this._buildPostProcessing();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.composer?.setSize(window.innerWidth, window.innerHeight);
    });
  }

  applyBiome(biomeDef) {
    this._applyBiomeCamera(biomeDef);
  }

  setFocusAnchor(anchor) {
    this._focusAnchor = anchor;
  }

  setPostProcessingMood({
    biomeId = BIOMES[0].id,
    weather = 'clear',
    time = 'day',
    rating = 'neutral',
  } = {}) {
    const isNight = time === 'night';
    const isRain  = weather === 'rain';
    const ratingBoost = rating === 'great' ? 0.12 : rating === 'good' ? 0.05 : 0;

    let bloom      = 0.18;
    let noise      = 0.01;
    let vignette   = 0.14;
    let aberration = 0.00012;
    let contrast   = 0.015;
    let saturation = 0.10;
    let dofBokeh   = 2.6;

    // Biome modifiers
    if (biomeId === 'jungle') {
      bloom      += 0.06;
      vignette   += 0.03;
      saturation += 0.14;  // lush greens
      dofBokeh    = 3.8;   // heavy bokeh, dense canopy feel
    } else if (biomeId === 'riverside') {
      bloom      += 0.02;
      noise      += 0.004;
      saturation += 0.06;
      dofBokeh    = 3.0;
    } else if (biomeId === 'mountain' || biomeId === 'snowy') {
      contrast   += 0.025;
      bloom      += 0.02;
      saturation -= 0.06;  // crisp, cooler
      dofBokeh    = 2.2;   // crisp mountain air, shallow bokeh
    } else if (biomeId === 'meadow') {
      saturation += 0.08;
      dofBokeh    = 2.8;
    } else if (biomeId === 'lofi-desk') {
      saturation -= 0.04;  // lofi desaturation
      vignette   += 0.04;
      dofBokeh    = 3.5;   // cozy close-up feel
    }

    if (isNight) {
      bloom      += 0.08;
      noise      += 0.008;
      vignette   += 0.06;
      aberration += 0.00014;
      contrast   += 0.025;
      saturation -= 0.10;  // desaturate at night
      dofBokeh   += 0.6;   // more dreamy blur at night
    }

    if (isRain) {
      bloom      -= 0.03;
      noise      += 0.02;
      vignette   += 0.04;
      aberration += 0.00012;
      contrast   += 0.01;
      saturation -= 0.06;  // grey-ish overcast
    }

    bloom      += ratingBoost * 0.45;
    contrast   += ratingBoost * 0.15;
    saturation += ratingBoost * 0.20;  // vibrant when vibe is great

    this._postTarget.bloom      = bloom;
    this._postTarget.noise      = noise;
    this._postTarget.vignette   = vignette;
    this._postTarget.aberration = aberration;
    this._postTarget.contrast   = contrast;
    this._postTarget.saturation = saturation;
    this._postTarget.dofBokeh   = dofBokeh;
  }

  setPeakMoment(enabled) {
    this._peakTarget = enabled ? 1 : 0;
  }

  _applyBiomeCamera(def) {
    const t = new THREE.Vector3(def.orbitTarget.x, def.orbitTarget.y, def.orbitTarget.z);
    this._cameraTargetLook.copy(t);
    this.controls.target.copy(t);
    this.controls.minDistance = def.minDist;
    this.controls.maxDistance = def.maxDist;
    this.controls.minPolarAngle = def.minPolar;
    this.controls.maxPolarAngle = def.maxPolar;
    this._cameraTargetPos.set(
      def.orbitTarget.x + def.cameraPos.x,
      def.cameraPos.y,
      def.orbitTarget.z + def.cameraPos.z,
    );
    if (!this._cameraInitialized) {
      this.camera.position.copy(this._cameraTargetPos);
      this._cameraInitialized = true;
    }
  }

  getTerrainY(x, z) {
    if (z > -10) return 0;
    if (z > -16) return 0;
    if (z > -30) {
      const t = (z + 16) / (-14);
      return t * t * 3.0;
    }
    return 3.0;
  }

  _buildBase() {
    // ── TERRAIN ──
    const groundGeo = new THREE.PlaneGeometry(140, 120, 50, 40);
    groundGeo.rotateX(-Math.PI / 2);
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      let y = this.getTerrainY(x, z);
      const edgeDist = Math.abs(x) - 25;
      if (edgeDist > 0) y += edgeDist * 0.2;
      pos.setY(i, y);
    }
    groundGeo.computeVertexNormals();
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const distToPond = Math.sqrt(x * x + (z + 13) * (z + 13));
      let r, g, b;
      if (distToPond < 7) {
        const t = Math.max(0, 1 - distToPond / 7);
        r = 0.22 + t * 0.55; g = 0.42 + t * 0.12; b = 0.16 + t * 0.20;
      } else {
        r = 0.20 + Math.random() * 0.02;
        g = 0.42 + Math.random() * 0.03;
        b = 0.15;
      }
      colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    ground.receiveShadow = true;
    this.scene.add(ground);

    // ── SKY DOME ──
    const skyGeo = new THREE.SphereGeometry(200, 32, 16);
    const startBiome = BIOMES[0];
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor:    { value: new THREE.Color(startBiome.skyTop) },
        bottomColor: { value: new THREE.Color(startBiome.skyBot) },
        offset:   { value: 10 },
        exponent: { value: 0.4 },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h,0.0),exponent), 0.0)), 1.0);
        }
      `,
    });
    this.scene.add(new THREE.Mesh(skyGeo, this.skyMat));

    // ── POND ──
    const sandGeo = new THREE.CircleGeometry(10, 32);
    sandGeo.rotateX(-Math.PI / 2);
    const sandMesh = new THREE.Mesh(sandGeo, new THREE.MeshLambertMaterial({ color: 0xc4a86a }));
    sandMesh.position.set(0, 0.005, -13);
    sandMesh.receiveShadow = true;
    this.scene.add(sandMesh);

    // PlaneGeometry gives enough vertices for wave displacement (vs CircleGeometry's 1 ring)
    const waterGeo = new THREE.PlaneGeometry(16, 16, 40, 40);
    waterGeo.rotateX(-Math.PI / 2);
    const water = new OceanWater(this.renderer, this.scene, this.camera, waterGeo, {
      textureWidth:  this._isMobile ? 256 : 512,
      textureHeight: this._isMobile ? 256 : 512,
      alpha:          0.84,
      waterColor:     0x4f96a6,
      sunColor:       0xf7e7c8,
      distortionScale: 9.5,
      noiseScale:     0.35,
      waterRadius:    8.0,
      fog:            true,
    });
    water.position.set(0, 0.01, -13);
    water.receiveShadow = true;
    this.pondWater = water;
    this.scene.add(water);
  }

  _buildPostProcessing() {
    this.composer = new EffectComposer(this.renderer, {
      multisampling: 0,
    });
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // ── Depth of Field (desktop only) ──
    if (!this._isMobile) {
      this.dofEffect = new DepthOfFieldEffect(this.camera, {
        focusDistance: 0.0,
        focalLength:   0.055,
        bokehScale:    this._postState.dofBokeh,
        height:        480,
      });
      this.dofPass = new EffectPass(this.camera, this.dofEffect);
      this.composer.addPass(this.dofPass);
    }

    // ── Core effects ──
    this.bloomEffect = new BloomEffect({
      blendFunction:       BlendFunction.SCREEN,
      mipmapBlur:          true,
      intensity:           this._postState.bloom,
      luminanceThreshold:  0.72,
      luminanceSmoothing:  0.18,
      radius:              0.7,
    });
    this.chromaticAberrationEffect = new ChromaticAberrationEffect({
      offset:            new THREE.Vector2(0, 0),
      radialModulation:  true,
      modulationOffset:  0.35,
    });
    this.brightnessContrastEffect = new BrightnessContrastEffect({
      brightness: 0.0,
      contrast:   this._postState.contrast,
    });
    this.noiseEffect = new NoiseEffect({
      blendFunction: BlendFunction.OVERLAY,
      premultiply:   true,
    });
    this.noiseEffect.blendMode.opacity.value = this._postState.noise;
    this.vignetteEffect = new VignetteEffect({
      eskil:    false,
      offset:   0.24,
      darkness: this._postState.vignette,
    });
    this.hueSatEffect = new HueSaturationEffect({
      hue:        0,
      saturation: this._postState.saturation,
    });

    // SMAA must be in its own pass (convolution — cannot merge with ChromaticAberration)
    if (!this._isMobile) {
      this.smaaEffect = new SMAAEffect();
      this.composer.addPass(new EffectPass(this.camera, this.smaaEffect));
    }

    // Main effects pass — bloom, CA, BC, noise, vignette, huesat
    this.postPass = new EffectPass(
      this.camera,
      this.bloomEffect,
      this.chromaticAberrationEffect,
      this.brightnessContrastEffect,
      this.noiseEffect,
      this.vignetteEffect,
      this.hueSatEffect,
    );
    this.composer.addPass(this.postPass);
  }

  _updatePostProcessing(delta, elapsed) {
    const ease = 1 - Math.exp(-delta * 3.5);
    this._peakMoment += (this._peakTarget - this._peakMoment) * ease;

    for (const key of Object.keys(this._postState)) {
      this._postState[key] += (this._postTarget[key] - this._postState[key]) * ease;
    }

    const pulse = 1 + Math.sin(elapsed * 0.55) * 0.025 + this._peakMoment * 0.08;
    this.bloomEffect.intensity = this._postState.bloom * pulse + this._peakMoment * 0.08;
    this.bloomEffect.luminanceMaterial.threshold = THREE.MathUtils.clamp(
      0.78 - this._postState.contrast * 0.35,
      0.68, 0.8,
    );
    this.bloomEffect.luminanceMaterial.smoothing = 0.16 + this._postState.contrast * 0.2;
    this.chromaticAberrationEffect.offset.set(
      this._postState.aberration * 0.45,
      this._postState.aberration,
    );
    this.brightnessContrastEffect.contrast       = this._postState.contrast;
    this.noiseEffect.blendMode.opacity.value     = this._postState.noise;
    this.vignetteEffect.darkness                 = this._postState.vignette;
    this.hueSatEffect.saturation                 = this._postState.saturation;

    // DoF: auto-focus on capybara head, bokeh scale per biome/mood
    if (this.dofEffect) {
      if (this._focusAnchor?.getHeadWorldPos && this.dofEffect.target?.copy) {
        const headPos = this._focusAnchor.getHeadWorldPos();
        this.dofEffect.target.copy(headPos);
      }
      this.dofEffect.bokehScale = this._postState.dofBokeh;
    }
  }

  _updateCamera(delta, elapsed) {
    const ease = 1 - Math.exp(-delta * 3.0);
    this.camera.position.lerp(this._cameraTargetPos, ease);
    this.controls.target.lerp(this._cameraTargetLook, ease);

    if (this._peakMoment > 0.001) {
      const anchor = this._focusAnchor?.getHeadWorldPos?.(new THREE.Vector3()) || this.controls.target;
      const orbit = new THREE.Vector3(
        Math.cos(elapsed * 0.8) * 0.3,
        0.15 + Math.sin(elapsed * 1.6) * 0.08,
        Math.sin(elapsed * 0.8) * 0.3,
      ).multiplyScalar(this._peakMoment);
      this.camera.position.add(orbit);
      this.controls.target.lerp(anchor, 0.08);
    }
  }

  render(delta = 1 / 60, elapsed = 0) {
    this._updateCamera(delta, elapsed);
    this.controls.update();
    this._updatePostProcessing(delta, elapsed);
    this.pondWater?.update(elapsed, this.sun);
    this.composer.render(delta);
  }
}
