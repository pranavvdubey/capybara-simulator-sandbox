import * as THREE from 'three';
import { BIOMES } from '../core/Constants.js';
import { OceanWater } from './OceanWater.js';

export class BiomeManager {
  constructor(scene, sceneManager) {
    this._scene   = scene;
    this._sm      = sceneManager;
    this._groups  = {};
    this._models  = {};
    this._flowerMeshes = [];
    this._animatedWaters = [];
    this._currentBiome = null;
    this._weather      = null;
  }

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
    this._weather = weather;
    for (const id of Object.keys(this._groups)) {
      this._groups[id].visible = false;
    }
    if (this._groups[biomeId]) this._groups[biomeId].visible = true;
    this._currentBiome = biomeId;

    const def = BIOMES.find(b => b.id === biomeId);
    if (!def) return;

    if (capy) {
      capy.setGroundPos(def.capyPos.x, def.capyPos.z, (x, z) => this._sm.getTerrainY(x, z));
      capy.group.rotation.y = def.capyRotY || 0;
    }
    this._sm.applyBiome(def);
    if (weather) {
      weather.setBiomeAtmosphere(def);
      weather.setSnow(def.autoSnow === true);
    }
  }

  update(delta, elapsed) {
    for (const mesh of this._flowerMeshes) {
      if (mesh.material?.userData?.uniforms) {
        mesh.material.userData.uniforms.windTime.value = elapsed;
      }
    }
    for (const water of this._animatedWaters) {
      water.update(elapsed, this._sm.sun);
    }
  }

  // ── ENVIRONMENT BUILDERS ──────────────────────────────────────────────────

  _buildBiomeEnv(def, group) {
    switch (def.id) {
      case 'meadow':    this._buildMeadow(group);    break;
      case 'riverside': this._buildRiverside(group); break;
      case 'jungle':    this._buildJungle(group);    break;
      case 'mountain':  this._buildMountain(group);  break;
      case 'snowy':     this._buildSnowy(group);     break;
      case 'lofi-desk': this._buildLofiDesk(group);  break;
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

  // ── MEADOW ────────────────────────────────────────────────────────────────
  _buildMeadow(group) {
    const getTY = (x, z) => this._sm.getTerrainY(x, z);

    if (this._models['flower']) this._buildFlowerInstances(group);

    const grass = [[-4,2],[6,0],[-8,-3],[10,4],[-2,-6],[5,-5],[-7,6],[3,-8],[12,-2],[-11,0]];
    for (const [x,z] of grass) this._place('grass-turf', x, 0.05, z, 0.5+Math.random()*0.3, undefined, group);

    this._placePalms(group, [
      {x:-9,z:-10},{x:9,z:-9},{x:-6,z:-16},{x:7,z:-16},
      {x:-13,z:-12},{x:13,z:-11},{x:-14,z:-22},{x:12,z:-20},
      {x:-2,z:-24},{x:6,z:-26},{x:-8,z:-26},{x:14,z:-24},
    ]);

    const leafy = [
      {n:'tree1',x:-9,z:3,s:2.2},{n:'trees',x:-13,z:-3,s:1.4},{n:'tree2',x:-15,z:-10,s:1.5},
      {n:'tree1',x:13,z:2,s:1.8},{n:'trees',x:18,z:-8,s:1.0},
      {n:'trees',x:-18,z:-16,s:1.2},{n:'tree2',x:20,z:-14,s:1.3},
      {n:'trees',x:-12,z:-28,s:1.2},{n:'tree1',x:-4,z:-30,s:1.4},
      {n:'tree2',x:4,z:-32,s:1.3},{n:'trees',x:12,z:-28,s:1.2},
    ];
    for (const t of leafy) this._place(t.n, t.x, getTY(t.x,t.z), t.z, t.s, undefined, group);

    const rocks = [
      {n:'rock2',x:-9,z:-2,s:1.5},{n:'rock2',x:-7,z:-11,s:1.5},
      {n:'rocks',x:-5,z:-15,s:1.2},{n:'rock2',x:8,z:-12,s:1.4},
    ];
    for (const r of rocks) this._place(r.n, r.x, getTY(r.x,r.z)-0.3, r.z, r.s, undefined, group);
  }

  // ── RIVERSIDE — actual winding river ─────────────────────────────────────
  _buildRiverside(group) {
    const getTY = (x, z) => this._sm.getTerrainY(x, z);

    // ── GROUND OVERLAY (sandy riverbank terrain) ──
    const bankGeo = new THREE.PlaneGeometry(80, 60, 1, 1);
    bankGeo.rotateX(-Math.PI / 2);
    const bankMesh = new THREE.Mesh(bankGeo,
      new THREE.MeshLambertMaterial({ color: 0x9aaa7a }));
    bankMesh.position.y = 0.005;
    bankMesh.receiveShadow = true;
    group.add(bankMesh);

    // ── WINDING RIVER ──
    // Centerline: sweeps from top-left background, curves down and right through scene
    const riverPath = [
      {x:-22, z:-28}, {x:-16, z:-22}, {x:-10, z:-16},
      {x:-5,  z:-10}, {x:-1,  z:-6},  {x:3,   z:-3},
      {x:8,   z:-2},  {x:14,  z:-4},  {x:20,  z:-8},
    ];
    const riverWidth = 4.5;
    this._buildRiverMesh(group, riverPath, riverWidth, {
      type: 'water',
      yOff: 0.008,
    });

    // Sandy banks (slightly wider path, sand-colored)
    this._buildRiverMesh(group, riverPath, riverWidth + 3.5, {
      type: 'bank',
      color: 0xc8b880,
      yOff: 0.003,
      opacity: 0.95,
    });

    // ── ROCKS along the banks ──
    const rocks = [
      {n:'rock2',x:-12,z:-17,s:1.4},{n:'rocks',x:-7,z:-11,s:1.1},
      {n:'rock2',x:-4,z:-7,s:1.3}, {n:'rock2',x:5,z:-4,s:1.2},
      {n:'rock2',x:10,z:-3,s:1.5},{n:'rocks',x:15,z:-5,s:1.0},
      {n:'rock2',x:-14,z:-14,s:1.6},{n:'rock2',x:9,z:-8,s:1.3},
    ];
    for (const r of rocks) this._place(r.n, r.x, getTY(r.x,r.z)-0.2, r.z, r.s, undefined, group);

    // ── REEDS in and near the river ──
    const reedMat  = new THREE.MeshLambertMaterial({ color: 0x7a9a4a });
    const headMat  = new THREE.MeshLambertMaterial({ color: 0x5a3a18 });
    const reedPos = [
      [-6,-8],[-4,-9],[-2,-5],[1,-4],[4,-2],[7,-3],
      [-8,-13],[-5,-12],[-9,-10],[6,-6],[11,-5],
    ];
    for (const [rx, rz] of reedPos) {
      for (let k = 0; k < 2; k++) {
        const h = 0.9 + Math.random() * 0.7;
        const jx = rx + (Math.random()-0.5)*0.8;
        const jz = rz + (Math.random()-0.5)*0.8;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, h, 5), reedMat);
        stem.position.set(jx, h/2, jz);
        stem.rotation.z = (Math.random()-0.5)*0.2;
        group.add(stem);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 5, 4), headMat);
        head.scale.set(0.6, 2.2, 0.6);
        head.position.set(jx, h + 0.12, jz);
        group.add(head);
      }
    }

    // ── TREES in background ──
    const trees = [
      {n:'tree1',x:-18,z:-26,s:1.8},{n:'tree2',x:-10,z:-30,s:1.6},
      {n:'trees',x:0,z:-32,s:1.4}, {n:'tree1',x:10,z:-30,s:1.5},
      {n:'trees',x:18,z:-26,s:1.3},{n:'tree2',x:-24,z:-20,s:1.7},
      {n:'tree1',x:24,z:-18,s:1.6},{n:'trees',x:-20,z:-14,s:1.4},
      {n:'tree2',x:20,z:-12,s:1.5},
    ];
    for (const t of trees) this._place(t.n, t.x, getTY(t.x,t.z), t.z, t.s, undefined, group);

    // ── FOREGROUND GRASS ──
    for (const [x,z] of [[-5,2],[2,1],[-3,3],[5,1],[0,4],[-8,0]]) {
      this._place('grass-turf', x, 0.05, z, 0.6, undefined, group);
    }
  }

  // Builds a winding river mesh from a list of centerline points
  _buildRiverMesh(group, path, width, options = {}) {
    const positions = [];
    const indices   = [];
    const uvs       = [];
    const {
      type = 'water',
      color = 0x5a9abb,
      yOff = 0.008,
      opacity = 0.72,
    } = options;

    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      let dx, dz;
      if (i === 0) {
        dx = path[1].x - p.x; dz = path[1].z - p.z;
      } else if (i === path.length - 1) {
        dx = p.x - path[i-1].x; dz = p.z - path[i-1].z;
      } else {
        dx = path[i+1].x - path[i-1].x; dz = path[i+1].z - path[i-1].z;
      }
      const len = Math.sqrt(dx*dx + dz*dz) || 1;
      const px = -dz / len * width / 2;
      const pz =  dx / len * width / 2;

      positions.push(p.x + px, yOff, p.z + pz);
      positions.push(p.x - px, yOff, p.z - pz);

      const u = i / (path.length - 1);
      uvs.push(0, u, 1, u);

      if (i < path.length - 1) {
        const b = i * 2;
        indices.push(b, b+1, b+2, b+1, b+3, b+2);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    let mesh;
    if (type === 'water') {
      mesh = new OceanWater(this._sm.renderer, this._scene, this._sm.camera, geo, {
        textureWidth: this._sm._isMobile ? 256 : 512,
        textureHeight: this._sm._isMobile ? 256 : 512,
        alpha: opacity,
        waterColor: color,
        sunColor: 0xf2e7ca,
        distortionScale: 8.0,
        noiseScale: 0.45,
        fog: true,
      });
      this._animatedWaters.push(mesh);
    } else {
      const mat = new THREE.MeshLambertMaterial({
        color, transparent: true, opacity, depthWrite: false,
      });
      mesh = new THREE.Mesh(geo, mat);
    }

    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  // ── JUNGLE ────────────────────────────────────────────────────────────────
  _buildJungle(group) {
    const getTY = (x, z) => this._sm.getTerrainY(x, z);

    // Dark green ground overlay
    const floorGeo = new THREE.PlaneGeometry(80, 60);
    floorGeo.rotateX(-Math.PI / 2);
    const jungleFloor = new THREE.Mesh(
      floorGeo,
      new THREE.MeshLambertMaterial({ color: 0x2a4a1a }),
    );
    jungleFloor.position.set(0, 0.003, 0);
    group.add(jungleFloor);

    const dense = [
      {n:'tree1',x:-5,z:3,s:2.5},{n:'tree2',x:5,z:2,s:2.3},
      {n:'trees',x:-9,z:-1,s:1.9},{n:'trees',x:10,z:0,s:1.8},
      {n:'tree1',x:-4,z:-5,s:2.1},{n:'tree2',x:6,z:-4,s:2.0},
      {n:'trees',x:-12,z:-4,s:1.6},{n:'trees',x:13,z:-3,s:1.7},
      {n:'tree1',x:-2,z:6,s:2.2},{n:'tree2',x:4,z:5,s:2.0},
      {n:'trees',x:-14,z:-9,s:1.5},{n:'trees',x:15,z:-7,s:1.4},
      {n:'tree1',x:-7,z:-11,s:1.9},{n:'tree2',x:8,z:-10,s:1.8},
      {n:'trees',x:-17,z:-15,s:1.3},{n:'trees',x:18,z:-13,s:1.3},
      {n:'tree1',x:0,z:-17,s:1.6},{n:'trees',x:-9,z:-19,s:1.4},
      {n:'tree2',x:9,z:-19,s:1.5},{n:'trees',x:0,z:-22,s:1.7},
    ];
    for (const t of dense) this._place(t.n, t.x, getTY(t.x,t.z), t.z, t.s, undefined, group);

    // Undergrowth rocks
    for (const [n,x,z,s] of [
      ['rock2',-8,-4,1.1],['rock2',7,-3,1.2],['rocks',-3,-7,0.9],
      ['rock2',6,-8,1.0],['rocks',-5,2,0.8],
    ]) {
      this._place(n, x, getTY(x,z)-0.2, z, s, undefined, group);
    }

    // Ground ferns (grass tufts, close together)
    for (const [x,z] of [[-3,-1],[4,0],[-5,3],[2,-3],[0,3],[-6,-3],[5,-6],[1,5]]) {
      this._place('grass-turf', x, 0.05, z, 0.5, undefined, group);
    }
  }

  // ── MOUNTAIN TOP ──────────────────────────────────────────────────────────
  _buildMountain(group) {
    // ── Rocky plateau the capy stands on ──
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x8a8278 });
    const darkRock = new THREE.MeshLambertMaterial({ color: 0x6a6460 });

    // Main plateau surface (flat top)
    const plateauGeo = new THREE.CylinderGeometry(9, 14, 4, 10, 1);
    const plateau = new THREE.Mesh(plateauGeo, rockMat);
    plateau.position.set(0, -2.1, 0);   // top surface at y ≈ 0
    plateau.castShadow = true;
    plateau.receiveShadow = true;
    group.add(plateau);

    // Ground overlay on plateau surface
    const topGeo = new THREE.CircleGeometry(8.5, 10);
    topGeo.rotateX(-Math.PI / 2);
    const top = new THREE.Mesh(topGeo, new THREE.MeshLambertMaterial({ color: 0x9a9490 }));
    top.position.y = 0.02;
    top.receiveShadow = true;
    group.add(top);

    // ── Distant mountain ridgeline silhouettes ──
    const mtMat = new THREE.MeshLambertMaterial({ color: 0x5a6070 });
    const mtFarMat = new THREE.MeshLambertMaterial({ color: 0x8090a0 });
    for (const [x, z, h, r, mat] of [
      [-35, -55, 28, 12, mtMat],
      [  0, -65, 32, 14, mtMat],
      [ 30, -58, 26, 11, mtMat],
      [-18, -45, 20,  9, mtFarMat],
      [ 18, -48, 22, 10, mtFarMat],
      [-50, -40, 16,  8, mtFarMat],
      [ 45, -42, 18,  9, mtFarMat],
    ]) {
      const geo = new THREE.ConeGeometry(r, h, 7, 1);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, h/2 - 8, z);
      group.add(m);
    }

    // ── Cliffside boulders around plateau edge ──
    const boulderData = [
      {x:-8,z:5,s:1.8,n:'rock2'},{x:7,z:6,s:1.6,n:'rock2'},
      {x:-9,z:-2,s:2.0,n:'rock2'},{x:8,z:-1,s:1.7,n:'rock2'},
      {x:-4,z:7,s:1.4,n:'rocks'},{x:4,z:-7,s:1.5,n:'rock2'},
      {x:-6,z:-6,s:1.9,n:'rock2'},{x:6,z:4,s:1.6,n:'rocks'},
      {x:0,z:-8,s:2.1,n:'rock2'},{x:0,z:8,s:1.4,n:'rocks'},
    ];
    for (const b of boulderData) {
      this._place(b.n, b.x, 0, b.z, b.s, undefined, group);
    }

    // ── Scattered mountain scrub (sparse trees, battered by wind) ──
    for (const [x, z, s] of [[-14,-20,1.2],[12,-22,1.1],[-18,-16,1.0],[16,-18,1.0]]) {
      this._place('tree1', x, 0, z, s, undefined, group);
    }

    // ── Snow patches on the plateau ──
    const snowMat = new THREE.MeshLambertMaterial({ color: 0xe8eef4, transparent: true, opacity: 0.8 });
    for (const [x, z, r] of [[2,3,1.8],[-3,1,1.4],[1,-3,1.6],[-4,-4,1.0],[3,-1,1.2]]) {
      const snowGeo = new THREE.CircleGeometry(r, 7);
      snowGeo.rotateX(-Math.PI / 2);
      const snow = new THREE.Mesh(snowGeo, snowMat);
      snow.position.set(x, 0.04, z);
      group.add(snow);
    }

    // ── Clouds (visible below/at horizon from peak) ──
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
    for (const [x, y, z, sx, sz] of [
      [-40, -8, -30, 2.0, 1.0], [30, -6, -35, 2.5, 1.2],
      [-20, -12, -25, 1.5, 0.8], [15, -10, -28, 1.8, 0.9],
      [45, -8, -25, 1.6, 0.7],
    ]) {
      const cGeo = new THREE.SphereGeometry(4, 7, 5);
      const cloud = new THREE.Mesh(cGeo, cloudMat);
      cloud.scale.set(sx, 0.5, sz);
      cloud.position.set(x, y, z);
      group.add(cloud);
      // Extra puffs
      for (let k = 0; k < 3; k++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(2.5+Math.random()*1.5, 6, 5), cloudMat);
        puff.position.set(x + (Math.random()-0.5)*6, y + Math.random()*1.5, z + (Math.random()-0.5)*4);
        puff.scale.set(sx*0.8, 0.5, sz*0.8);
        group.add(puff);
      }
    }
  }

  // ── SNOWY PEAK ────────────────────────────────────────────────────────────
  _buildSnowy(group) {
    // ── Full white ground overlay ──
    const snowGeo = new THREE.PlaneGeometry(100, 80, 1, 1);
    snowGeo.rotateX(-Math.PI / 2);
    const snowGround = new THREE.Mesh(snowGeo,
      new THREE.MeshLambertMaterial({ color: 0xdce8f0 }));
    snowGround.position.y = 0.01;
    snowGround.receiveShadow = true;
    group.add(snowGround);

    // ── Snowy mound the capy sits on ──
    const moundGeo = new THREE.SphereGeometry(5, 10, 6);
    const mound = new THREE.Mesh(moundGeo,
      new THREE.MeshLambertMaterial({ color: 0xe8f0f8 }));
    mound.scale.set(2.0, 0.4, 2.0);
    mound.position.set(0, -1.2, 0);
    mound.receiveShadow = true;
    group.add(mound);

    // ── Pine trees ──
    const pinePositions = [
      [-8,4,1.2],[-12,2,1.0],[-6,-5,1.3],[8,5,1.1],[11,2,1.0],
      [7,-4,1.2],[-5,8,0.9],[4,8,1.0],[-14,-4,1.1],[13,-5,1.0],
      [-9,-10,1.1],[9,-9,1.0],[0,-12,1.3],[-16,0,0.9],[15,0,0.9],
    ];
    for (const [x,z,s] of pinePositions) {
      this._buildPineTree(group, x, z, s);
    }

    // ── Icy rocks ──
    const iceMat = new THREE.MeshLambertMaterial({ color: 0xb8ccd8 });
    for (const [n,x,z,s] of [
      ['rock2',-7,-3,1.4],['rock2',7,-2,1.3],['rocks',-3,-6,1.0],
      ['rock2',5,-7,1.2],['rock2',-10,1,1.5],['rock2',9,1,1.3],
    ]) {
      const src = this._models[n];
      if (!src) continue;
      const r = src.clone();
      r.position.set(x, -0.2, z);
      r.scale.setScalar(s);
      r.rotation.y = Math.random()*Math.PI*2;
      r.traverse(c => {
        if (c.isMesh) {
          c.castShadow = true; c.receiveShadow = true;
          c.material = iceMat.clone();
        }
      });
      group.add(r);
    }

    // ── Snow drifts (elongated white mounds) ──
    const driftMat = new THREE.MeshLambertMaterial({ color: 0xf0f4f8 });
    for (const [x,z,rx,rz] of [
      [-4,3,2.5,0.8],[-9,6,3.0,0.7],[5,6,2.2,0.6],
      [2,-5,2.8,0.6],[8,-6,2.0,0.7],[-6,-8,2.4,0.65],
    ]) {
      const dGeo = new THREE.SphereGeometry(1, 7, 5);
      const drift = new THREE.Mesh(dGeo, driftMat);
      drift.scale.set(rx, 0.35, rz);
      drift.position.set(x, 0.12, z);
      drift.rotation.y = Math.random()*Math.PI;
      group.add(drift);
    }

    // ── Distant snowy mountains (larger, whiter) ──
    const snowMtMat  = new THREE.MeshLambertMaterial({ color: 0x8898a8 });
    const snowCapMat = new THREE.MeshLambertMaterial({ color: 0xf0f4f8 });
    for (const [x, z, h, r] of [
      [-40,-55,36,13],[-10,-65,42,16],[25,-60,34,12],
      [-55,-45,28,10],[40,-48,30,11],
    ]) {
      const body = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), snowMtMat);
      body.position.set(x, h/2-10, z);
      group.add(body);
      // Snow cap
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r*0.4, h*0.3, 8), snowCapMat);
      cap.position.set(x, h - h*0.15 - 10, z);
      group.add(cap);
    }
  }

  // Build a single pine tree at (x, z)
  _buildPineTree(group, x, z, scale=1) {
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a3020 });
    const needleMat = new THREE.MeshLambertMaterial({ color: 0x2a5a30 });
    const snowMat  = new THREE.MeshLambertMaterial({ color: 0xe0ecf4 });

    const h = scale;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12*h, 0.18*h, 1.4*h, 6),
      trunkMat,
    );
    trunk.position.set(x, 0.7*h, z);
    trunk.castShadow = true;
    group.add(trunk);

    // 3 cone tiers (bottom-to-top, each smaller)
    const tiers = [[1.8*h, 1.4*h, 1.2*h],[1.4*h, 1.2*h, 2.0*h],[1.0*h, 0.9*h, 2.7*h]];
    for (const [r, ch, cy] of tiers) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r*0.35, ch*0.9, 7), needleMat);
      cone.position.set(x, cy * 0.62, z);
      cone.castShadow = true;
      group.add(cone);
      // Snow on each tier
      const snowCap = new THREE.Mesh(new THREE.ConeGeometry(r*0.22, ch*0.45, 7), snowMat);
      snowCap.position.set(x, cy * 0.62 + ch * 0.28, z);
      group.add(snowCap);
    }
  }

  // ── LOFI DESK ─────────────────────────────────────────────────────────────
  _buildLofiDesk(group) {
    const woodMat  = new THREE.MeshLambertMaterial({ color: 0x8b5e3c });
    const darkWood = new THREE.MeshLambertMaterial({ color: 0x5a3a20 });
    const wallMat  = new THREE.MeshLambertMaterial({ color: 0xdbc89a });

    // ── FLOOR ──
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 22),
      new THREE.MeshLambertMaterial({ color: 0x8a7060 }));
    floor.rotateX(-Math.PI / 2);
    floor.position.set(0, -2.12, 0);
    floor.receiveShadow = true;
    group.add(floor);

    // ── BACK WALL ──
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), wallMat);
    backWall.position.set(0, 2.5, -2.6);
    backWall.receiveShadow = true;
    group.add(backWall);

    // ── LEFT WALL (has window) ──
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 7), wallMat);
    leftWall.position.set(-6.2, 2.5, 1.0);
    leftWall.rotation.y = Math.PI / 2;
    group.add(leftWall);

    // ── DESK SURFACE ──
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.12, 3.2), woodMat);
    deskTop.position.set(0, -0.08, -0.4);
    deskTop.castShadow = true;
    deskTop.receiveShadow = true;
    group.add(deskTop);

    // Desk legs
    for (const [x, z] of [[-2.4, 1.1], [2.4, 1.1], [-2.4, -1.9], [2.4, -1.9]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.10, 2.0, 0.10), darkWood);
      leg.position.set(x, -1.1, z);
      leg.castShadow = true;
      group.add(leg);
    }

    // ── WINDOW (left wall) ──
    const frameMat = new THREE.MeshLambertMaterial({ color: 0xc4a060 });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0xb8d8f8, transparent: true, opacity: 0.45 });

    // Window glass pane
    const winGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.1), glassMat);
    winGlass.position.set(-6.12, 2.6, -0.6);
    winGlass.rotation.y = Math.PI / 2;
    group.add(winGlass);

    // Window frame (4 sides)
    for (const [w, h, oy, oz] of [
      [1.68, 0.06, 1.08, 0],  // top
      [1.68, 0.06, -1.08, 0], // bottom
      [0.06, 2.16, 0, 0],     // left
      [0.06, 2.16, 0, 1.62],  // right — offset in z instead
    ]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, w), frameMat);
      bar.position.set(-6.14, 2.6 + oy, -0.6 + oz * 0 + (oz > 0 ? 0.81 : (oz < 0 ? -0.81 : 0)));
      bar.rotation.y = Math.PI / 2;
      group.add(bar);
    }
    // Cross dividers
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.60), frameMat);
    crossH.position.set(-6.12, 2.6, -0.6);
    crossH.rotation.y = Math.PI / 2;
    group.add(crossH);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.10, 0.06), frameMat);
    crossV.position.set(-6.12, 2.6, -0.6);
    group.add(crossV);

    // Warm light shaft from window
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfff4c8, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1.4, 5.5, 8, 1, true), beamMat);
    beam.rotation.z = Math.PI / 2;
    beam.position.set(-3.5, 1.4, -0.6);
    group.add(beam);

    // ── PAPERS on desk ──
    const paperColors = [0xf8f4ec, 0xeef4f8, 0xf4f0e8, 0xf0f4ec];
    for (const [x, z, ry, ci] of [
      [1.1, -0.1, 0.18, 0], [1.45, 0.15, -0.12, 1],
      [-1.4, -0.15, 0.14, 2], [-1.1, 0.05, -0.22, 3],
      [0.7, 0.35, 0.28, 0],
    ]) {
      const paper = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.008, 0.52),
        new THREE.MeshLambertMaterial({ color: paperColors[ci] }));
      paper.position.set(x, 0.01, z);
      paper.rotation.y = ry;
      group.add(paper);
    }
    // Ruled lines on top paper (thin dark strips)
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xb8c8d8 });
    for (let i = 0; i < 5; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.002, 0.008), lineMat);
      line.position.set(1.1, 0.016, -0.14 + i * 0.08);
      line.rotation.y = 0.18;
      group.add(line);
    }

    // ── PENCIL CUP ──
    const cupMat = new THREE.MeshLambertMaterial({ color: 0xe07840 });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.22, 12), cupMat);
    cup.position.set(1.9, 0.12, 0.38);
    cup.castShadow = true;
    group.add(cup);

    const pencilColors = [0xf5c832, 0x4a90d9, 0xe04030, 0x40a050, 0xc060c0];
    for (let i = 0; i < 5; i++) {
      const pMat = new THREE.MeshLambertMaterial({ color: pencilColors[i] });
      const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.36, 6), pMat);
      const a = (i / 5) * Math.PI * 2;
      const jx = 1.9 + Math.cos(a) * 0.042;
      const jz = 0.38 + Math.sin(a) * 0.042;
      pencil.position.set(jx, 0.25, jz);
      pencil.rotation.z = (Math.random() - 0.5) * 0.18;
      pencil.castShadow = true;
      group.add(pencil);
      // Tip
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.04, 6),
        new THREE.MeshLambertMaterial({ color: 0xf5dca0 }));
      tip.position.set(jx, 0.25 + 0.20, jz);
      group.add(tip);
    }

    // ── MUG (steaming) ──
    const mugMat = new THREE.MeshLambertMaterial({ color: 0x6080a8 });
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.18, 12), mugMat);
    mug.position.set(-1.8, 0.10, 0.42);
    mug.castShadow = true;
    group.add(mug);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 6, 10, Math.PI), mugMat);
    handle.position.set(-1.93, 0.10, 0.42);
    handle.rotation.y = Math.PI / 2;
    group.add(handle);
    // Steam wisps
    const steamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28 });
    for (let i = 0; i < 3; i++) {
      const wisp = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.014, 0.18, 4), steamMat);
      wisp.position.set(-1.8 + (i - 1) * 0.028, 0.28, 0.42);
      group.add(wisp);
    }

    // ── SMALL PLANT ──
    const potMat2 = new THREE.MeshLambertMaterial({ color: 0xb05840 });
    const pot2 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.13, 9), potMat2);
    pot2.position.set(-2.0, 0.08, -0.25);
    pot2.castShadow = true;
    group.add(pot2);
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x3a9030 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), leafMat);
      leaf.scale.set(0.55, 0.45, 0.9);
      leaf.position.set(-2.0 + Math.cos(a) * 0.09, 0.22, -0.25 + Math.sin(a) * 0.09);
      leaf.rotation.z = a;
      leaf.castShadow = true;
      group.add(leaf);
    }

    // ── BOOKSHELF (back-right corner) ──
    const shelfMat = new THREE.MeshLambertMaterial({ color: 0x7a5530 });
    const shelfBody = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.6, 0.28), shelfMat);
    shelfBody.position.set(2.8, 2.5, -2.46);
    group.add(shelfBody);
    // Shelf divider panels
    for (const oy of [-0.5, 0.5]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 0.28), shelfMat);
      panel.position.set(2.8, 2.5 + oy, -2.46);
      group.add(panel);
    }
    // Books
    const bookColors = [0xb03030, 0x3060b0, 0x30a050, 0xe08020, 0x804090, 0xc05050, 0x3080a0, 0xa06020];
    for (let row = 0; row < 2; row++) {
      let bx = 1.28;
      for (let i = 0; i < 8; i++) {
        const bw = 0.18 + Math.random() * 0.12;
        const bh = 0.50 + Math.random() * 0.28;
        if (bx + bw > 4.35) break;
        const book = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.20),
          new THREE.MeshLambertMaterial({ color: bookColors[i % bookColors.length] }));
        book.position.set(bx + bw / 2, 1.38 + row * 0.88, -2.32);
        bx += bw + 0.015;
        group.add(book);
      }
    }

    // ── DESK LAMP ──
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.04, 10), lampMat);
    lampBase.position.set(-0.5, 0.02, -1.2);
    group.add(lampBase);
    const lampArm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 6), lampMat);
    lampArm.position.set(-0.5, 0.37, -1.2);
    lampArm.rotation.z = 0.18;
    group.add(lampArm);
    const lampHead = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.14, 10, 1, true), lampMat);
    lampHead.position.set(-0.42, 0.74, -1.2);
    lampHead.rotation.z = -Math.PI;
    group.add(lampHead);
    // Warm point light from lamp
    const lampLight = new THREE.PointLight(0xffe8a0, 0.8, 3.5);
    lampLight.position.set(-0.42, 0.7, -1.2);
    group.add(lampLight);
  }

  // ── PALM TREE HELPERS ─────────────────────────────────────────────────────
  _placePalms(group, positions) {
    const src = this._models['palm-trees'];
    if (!src) return;
    const palms = [];
    src.traverse(c => {
      if (c.name?.match(/^PalmTree_\d$/) && c.type === 'Group') palms.push(c);
    });
    if (!palms.length) return;

    for (const pos of positions) {
      const clone = palms[Math.floor(Math.random() * palms.length)].clone();
      const box = new THREE.Box3().setFromObject(clone);
      clone.position.sub(box.getCenter(new THREE.Vector3()));
      const w = new THREE.Group();
      w.add(clone);
      w.position.set(pos.x, this._sm.getTerrainY(pos.x, pos.z) + 0.5, pos.z);
      w.scale.setScalar(0.8 + Math.random() * 0.4);
      w.rotation.y = Math.random() * Math.PI * 2;
      w.traverse(c => { if (c.isMesh) { c.castShadow=true; c.receiveShadow=true; } });
      group.add(w);
    }
  }

  // ── FLOWER INSTANCING (meadow) ────────────────────────────────────────────
  _buildFlowerInstances(group) {
    const srcMeshes = [];
    this._models['flower'].traverse(c => { if (c.isMesh && c.material) srcMeshes.push(c); });
    if (!srcMeshes.length) return;

    const COUNT = 400;
    const dummy = new THREE.Object3D();
    const matrices=[], windPhases=new Float32Array(COUNT), windStrengths=new Float32Array(COUNT);
    let idx = 0;
    const clusters = [[0,0],[-4,2],[5,-1],[-2,-3],[3,4],[-6,-2],[7,2],[-3,5],[1,-5],[6,-4]];

    for (let attempt=0; attempt<1500 && idx<COUNT; attempt++) {
      const c = clusters[Math.floor(Math.random()*clusters.length)];
      const x = c[0] + (Math.random()-0.5)*8;
      const z = c[1] + (Math.random()-0.5)*5;
      if (z < -7 || z > 8) continue;
      if (Math.sqrt(x*x+z*z) < 1.2) continue;
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, Math.random()*Math.PI*2, 0);
      dummy.scale.setScalar(0.30 + Math.random()*0.2);
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());
      windPhases[idx]    = Math.random()*Math.PI*2;
      windStrengths[idx] = 0.06 + Math.random()*0.05;
      idx++;
    }

    const wpSlice = windPhases.slice(0, idx);
    const wsSlice = windStrengths.slice(0, idx);

    for (const srcMesh of srcMeshes) {
      const geo = srcMesh.geometry.clone();
      geo.applyMatrix4(new THREE.Matrix4().compose(srcMesh.position, srcMesh.quaternion, srcMesh.scale));
      const mat = srcMesh.material.clone();
      if (mat.name === 'Flowers') { mat.map = null; mat.color.set(0xc4a0e0); }
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
          float wX = sin(windTime*1.5+aWindPhase)*aWindStrength;
          float wZ = sin(windTime*1.2+aWindPhase*0.7)*aWindStrength*0.6;
          transformed.x += transformed.y*wX;
          transformed.z += transformed.y*wZ;`
        );
      };
      const mesh = new THREE.InstancedMesh(geo, mat, idx);
      mesh.frustumCulled = false;
      for (let i=0; i<idx; i++) mesh.setMatrixAt(i, matrices[i]);
      mesh.instanceMatrix.needsUpdate = true;
      geo.setAttribute('aWindPhase',    new THREE.InstancedBufferAttribute(wpSlice.slice(), 1));
      geo.setAttribute('aWindStrength', new THREE.InstancedBufferAttribute(wsSlice.slice(), 1));
      group.add(mesh);
      this._flowerMeshes.push(mesh);
    }
  }
}
