import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BIOMES } from '../core/Constants.js';

// Owns: renderer, camera, OrbitControls, lights, terrain, sky, pond
// Does NOT own biome-specific props — BiomeManager handles those
export class SceneManager {
  constructor() {
    this._isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;

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
    this.sun    = new THREE.DirectionalLight(0xfff4d6, startBiome.sunIntensity);
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
    this._buildBase();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  applyBiome(biomeDef) {
    this._applyBiomeCamera(biomeDef);
  }

  _applyBiomeCamera(def) {
    const t = new THREE.Vector3(def.orbitTarget.x, def.orbitTarget.y, def.orbitTarget.z);
    this.controls.target.copy(t);
    this.controls.minDistance = def.minDist;
    this.controls.maxDistance = def.maxDist;
    this.controls.minPolarAngle = def.minPolar;
    this.controls.maxPolarAngle = def.maxPolar;
    // Animate camera to new position
    this.camera.position.set(
      def.orbitTarget.x + def.cameraPos.x,
      def.cameraPos.y,
      def.orbitTarget.z + def.cameraPos.z,
    );
  }

  // Returns a function getTerrainY(x, z) for use by other systems
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

    const waterGeo = new THREE.CircleGeometry(8, 32);
    waterGeo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(waterGeo, new THREE.MeshLambertMaterial({
      color: 0x6aaebb, transparent: true, opacity: 0.65,
    }));
    water.position.set(0, 0.01, -13);
    this.scene.add(water);
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
