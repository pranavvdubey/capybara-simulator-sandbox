import * as THREE from 'three';
import { BIOMES } from '../core/Constants.js';

// Manages biome-specific environment objects.
// Each biome has a group that gets shown/hidden on switch.
// All assets are loaded upfront for instant transitions.
export class BiomeManager {
  constructor(scene, sceneManager) {
    this._scene    = scene;
    this._sm       = sceneManager;
    this._groups   = {};   // biomeId → THREE.Group
    this._models   = {};   // model name → scene (from loader)
    this._flowerMeshes = []; // instanced flower meshes (meadow)
    this._currentBiome = null;
    this._windTime = 0;
  }

  // Called after assets are loaded. models is the shared asset map.
  build(models) {
    this._models = models;
    for (const def of BIOMES) {
      const g = new THREE.Group();
      g.visible = false;
      this._scene.add(g);
      this._groups[def.id] = g;
      this._buildBiomeEnv(def, g);
    }
  }

  setBiome(biomeId, capy, weather) {
    // Hide all
    for (const id of Object.keys(this._groups)) {
      this._groups[id].visible = false;
    }
    // Show target
    if (this._groups[biomeId]) {
      this._groups[biomeId].visible = true;
    }
    this._currentBiome = biomeId;

    const def = BIOMES.find(b => b.id === biomeId);
    if (def) {
      // Move capybara
      if (capy) {
        capy.setGroundPos(def.capyPos.x, def.capyPos.z, (x, z) => this._sm.getTerrainY(x, z));
        capy.group.rotation.y = def.capyRotY;
      }
      // Update camera
      this._sm.applyBiome(def);
      // Tell weather system about new atmosphere baseline
      if (weather) weather.setBiomeAtmosphere(def);
    }
  }

  update(delta, elapsed) {
    this._windTime = elapsed;
    for (const mesh of this._flowerMeshes) {
      if (mesh.material && mesh.material.userData.uniforms) {
        mesh.material.userData.uniforms.windTime.value = elapsed;
      }
    }
  }

  // ── ENVIRONMENT BUILDERS ───────────────────────────────────────────────────

  _buildBiomeEnv(def, group) {
    switch (def.id) {
      case 'meadow':   this._buildMeadow(group);   break;
      case 'riverside': this._buildRiverside(group); break;
      case 'jungle':   this._buildJungle(group);   break;
    }
  }

  _place(name, x, y, z, scale, rotY, group) {
    const src = this._models[name];
    if (!src) return null;
    const clone = src.clone();
    clone.position.set(x, y, z);
    clone.scale.setScalar(scale);
    clone.rotation.y = rotY ?? (Math.random() * Math.PI * 2);
    clone.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    group.add(clone);
    return clone;
  }

  _buildMeadow(group) {
    const getTY = (x, z) => this._sm.getTerrainY(x, z);

    // Flowers (instanced, GPU wind)
    if (this._models['flower']) {
      this._buildFlowerInstances(group);
    }

    // Grass tufts
    const grassSpots = [[-4,2],[6,0],[-8,-3],[10,4],[-2,-6],[5,-5],[-7,6],[3,-8],[12,-2],[-11,0]];
    for (const [x, z] of grassSpots) {
      this._place('grass-turf', x, 0.05, z, 0.5 + Math.random() * 0.3, undefined, group);
    }

    // Palm trees (extract individual palms from cluster model)
    this._placePalms(group, [
      {x:-9,z:-10},{x:9,z:-9},{x:-6,z:-16},{x:7,z:-16},
      {x:-13,z:-12},{x:13,z:-11},{x:-14,z:-22},{x:12,z:-20},
      {x:-2,z:-24},{x:6,z:-26},{x:-8,z:-26},{x:14,z:-24},
      {x:-18,z:-10},{x:20,z:-12},
    ]);

    // Leafy trees
    const leafy = [
      {n:'tree1',x:-9,z:3,s:2.2},{n:'trees',x:-13,z:-3,s:1.4},{n:'tree2',x:-15,z:-10,s:1.5},
      {n:'tree1',x:13,z:2,s:1.8},{n:'trees',x:18,z:-8,s:1.0},
      {n:'trees',x:-18,z:-16,s:1.2},{n:'tree2',x:20,z:-14,s:1.3},
      {n:'trees',x:-12,z:-28,s:1.2},{n:'tree1',x:-4,z:-30,s:1.4},
      {n:'tree2',x:4,z:-32,s:1.3},{n:'trees',x:12,z:-28,s:1.2},
    ];
    for (const t of leafy) this._place(t.n, t.x, getTY(t.x,t.z), t.z, t.s, undefined, group);

    // Rocks
    const rocks = [
      {n:'rock2',x:-9,z:-2,s:1.5},{n:'rock2',x:-7,z:-11,s:1.5},
      {n:'rocks',x:-5,z:-15,s:1.2},{n:'rock2',x:8,z:-12,s:1.4},
    ];
    for (const r of rocks) this._place(r.n, r.x, getTY(r.x,r.z)-0.3, r.z, r.s, undefined, group);
  }

  _buildRiverside(group) {
    const getTY = (x, z) => this._sm.getTerrainY(x, z);

    // Rocks along banks — more prominent
    const rocks = [
      {n:'rock2',x:-9,z:-7,s:1.5},{n:'rocks',x:-5,z:-13,s:1.3},
      {n:'rock2',x:-11,z:-11,s:1.8},{n:'rock2',x:8,z:-8,s:1.4},
      {n:'rocks',x:6,z:-14,s:1.0},{n:'rock2',x:12,z:-10,s:1.6},
      {n:'rock2',x:-14,z:-18,s:1.2},{n:'rock2',x:15,z:-20,s:1.4},
    ];
    for (const r of rocks) this._place(r.n, r.x, getTY(r.x,r.z)-0.3, r.z, r.s, undefined, group);

    // Trees in background
    const trees = [
      {n:'tree1',x:-9,z:1,s:2.0},{n:'tree2',x:10,z:0,s:1.8},
      {n:'trees',x:-14,z:-8,s:1.3},{n:'trees',x:16,z:-6,s:1.2},
      {n:'trees',x:-10,z:-22,s:1.2},{n:'tree1',x:8,z:-24,s:1.3},
    ];
    for (const t of trees) this._place(t.n, t.x, getTY(t.x,t.z), t.z, t.s, undefined, group);

    // Reeds (thin cylinders in and around pond)
    const reedMat = new THREE.MeshLambertMaterial({ color: 0x8a9a5a });
    const reedSpots = [
      [-4,-12],[-5,-14],[4,-11],[6,-13],[-3,-10],[3,-9],[-7,-13],[7,-12],
    ];
    for (const [x, z] of reedSpots) {
      const height = 0.8 + Math.random() * 0.6;
      const geo = new THREE.CylinderGeometry(0.04, 0.06, height, 5);
      const mesh = new THREE.Mesh(geo, reedMat);
      mesh.position.set(x + (Math.random()-0.5)*0.4, height/2 - 0.05, z + (Math.random()-0.5)*0.4);
      mesh.rotation.z = (Math.random()-0.5)*0.15;
      group.add(mesh);

      // Reed head (small oval)
      const headGeo = new THREE.SphereGeometry(0.07, 5, 4);
      headGeo.scale(0.6, 2.5, 0.6);
      const head = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: 0x5a4020 }));
      head.position.set(mesh.position.x, mesh.position.y + height/2, mesh.position.z);
      group.add(head);
    }

    // Some grass tufts
    const grassSpots = [[-6,-5],[5,-6],[-3,0],[4,2],[-8,1]];
    for (const [x, z] of grassSpots) {
      this._place('grass-turf', x, 0.05, z, 0.5, undefined, group);
    }
  }

  _buildJungle(group) {
    const getTY = (x, z) => this._sm.getTerrainY(x, z);

    // Very dense trees, pulled in closer around the capybara
    const leafy = [
      {n:'tree1',x:-5,z:2,s:2.5},{n:'tree2',x:5,z:1,s:2.3},
      {n:'trees',x:-8,z:-2,s:1.8},{n:'trees',x:9,z:-1,s:1.7},
      {n:'tree1',x:-4,z:-6,s:2.0},{n:'tree2',x:5,z:-5,s:1.9},
      {n:'trees',x:-11,z:-5,s:1.5},{n:'trees',x:12,z:-4,s:1.6},
      {n:'tree1',x:-2,z:5,s:2.2},{n:'tree2',x:3,z:4,s:2.0},
      {n:'trees',x:-13,z:-10,s:1.4},{n:'trees',x:14,z:-8,s:1.3},
      {n:'tree1',x:-6,z:-12,s:1.8},{n:'tree2',x:7,z:-11,s:1.7},
      {n:'trees',x:-16,z:-16,s:1.2},{n:'trees',x:17,z:-14,s:1.2},
      {n:'tree1',x:0,z:-18,s:1.5},{n:'trees',x:-8,z:-20,s:1.3},
    ];
    for (const t of leafy) this._place(t.n, t.x, getTY(t.x,t.z), t.z, t.s, undefined, group);

    // Rocks
    const rocks = [{n:'rock2',x:-8,z:-4,s:1.2},{n:'rock2',x:7,z:-3,s:1.3},{n:'rocks',x:-3,z:-8,s:1.0}];
    for (const r of rocks) this._place(r.n, r.x, getTY(r.x,r.z)-0.2, r.z, r.s, undefined, group);

    // Some ground grass tufts
    const grassSpots = [[-3,-1],[4,0],[-5,3],[2,-4],[0,3]];
    for (const [x, z] of grassSpots) {
      this._place('grass-turf', x, 0.05, z, 0.4, undefined, group);
    }
  }

  _placePalms(group, positions) {
    const src = this._models['palm-trees'];
    if (!src) return;
    const palmGroups = [];
    src.traverse(c => {
      if (c.name && c.name.match(/^PalmTree_\d$/) && c.type === 'Group') {
        palmGroups.push(c);
      }
    });
    if (palmGroups.length === 0) return;

    for (const pos of positions) {
      const srcPalm = palmGroups[Math.floor(Math.random() * palmGroups.length)];
      const clone = srcPalm.clone();
      const palmBox = new THREE.Box3().setFromObject(clone);
      const center = palmBox.getCenter(new THREE.Vector3());
      clone.position.sub(center);
      const wrapper = new THREE.Group();
      wrapper.add(clone);
      const y = this._sm.getTerrainY(pos.x, pos.z);
      wrapper.position.set(pos.x, y + 0.5, pos.z);
      const s = 0.8 + Math.random() * 0.4;
      wrapper.scale.setScalar(s);
      wrapper.rotation.y = Math.random() * Math.PI * 2;
      wrapper.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
      group.add(wrapper);
    }
  }

  _buildFlowerInstances(group) {
    const srcMeshes = [];
    this._models['flower'].traverse(c => {
      if (c.isMesh && c.material) srcMeshes.push(c);
    });
    if (srcMeshes.length === 0) return;

    const COUNT = 400;
    const dummy = new THREE.Object3D();
    const matrices = [];
    const windPhases    = new Float32Array(COUNT);
    const windStrengths = new Float32Array(COUNT);
    let idx = 0;
    const clusters = [[0,0],[-4,2],[5,-1],[-2,-3],[3,4],[-6,-2],[7,2],[-3,5],[1,-5],[6,-4]];

    for (let attempt = 0; attempt < 1500 && idx < COUNT; attempt++) {
      const c = clusters[Math.floor(Math.random() * clusters.length)];
      const x = c[0] + (Math.random() - 0.5) * 8;
      const z = c[1] + (Math.random() - 0.5) * 5;
      if (z < -7 || z > 8) continue;
      if (Math.sqrt(x * x + z * z) < 1.2) continue;
      const scale = 0.30 + Math.random() * 0.2;
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());
      windPhases[idx]    = Math.random() * Math.PI * 2;
      windStrengths[idx] = 0.06 + Math.random() * 0.05;
      idx++;
    }

    const wpSlice = windPhases.slice(0, idx);
    const wsSlice = windStrengths.slice(0, idx);

    for (const srcMesh of srcMeshes) {
      const geo = srcMesh.geometry.clone();
      const localMat = new THREE.Matrix4().compose(srcMesh.position, srcMesh.quaternion, srcMesh.scale);
      geo.applyMatrix4(localMat);

      const mat = srcMesh.material.clone();
      if (mat.name === 'Flowers') {
        mat.map = null;
        mat.color.set(0xc4a0e0);
      }
      mat.userData.uniforms = { windTime: { value: 0 } };
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.windTime = mat.userData.uniforms.windTime;
        shader.vertexShader = `
          attribute float aWindPhase;
          attribute float aWindStrength;
          uniform float windTime;
        ` + shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float wX = sin(windTime * 1.5 + aWindPhase) * aWindStrength;
          float wZ = sin(windTime * 1.2 + aWindPhase * 0.7) * aWindStrength * 0.6;
          transformed.x += transformed.y * wX;
          transformed.z += transformed.y * wZ;`
        );
      };

      const mesh = new THREE.InstancedMesh(geo, mat, idx);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      for (let i = 0; i < idx; i++) mesh.setMatrixAt(i, matrices[i]);
      mesh.instanceMatrix.needsUpdate = true;
      geo.setAttribute('aWindPhase',    new THREE.InstancedBufferAttribute(wpSlice.slice(), 1));
      geo.setAttribute('aWindStrength', new THREE.InstancedBufferAttribute(wsSlice.slice(), 1));
      group.add(mesh);
      this._flowerMeshes.push(mesh);
    }
  }
}
