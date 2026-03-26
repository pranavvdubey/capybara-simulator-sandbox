import * as THREE from 'three';

// Loads and manages the capybara model.
// Exposes:
//   group         - the root THREE.Group in the scene
//   headBone      - the head bone (if found)
//   getHeadWorldPos() - head bone world position
//   getBackWorldPos() - approximate back/saddle world position
//   setGroundPos(x, z, getTerrainY) - move capy to terrain position
export class CapybaraActor {
  constructor() {
    this.group     = null;
    this.headBone  = null;
    this._headBaseRot = { x: 0, y: 0, z: 0 };
    this._worldPos = new THREE.Vector3();
    this._elapsed  = 0;
    this._groundPos = new THREE.Vector3();
  }

  async load(loader, scene) {
    return new Promise((resolve, reject) => {
      loader.load('models/capybara-rigged.glb', (gltf) => {
        const capy = gltf.scene;

        // Scale to ~1m tall
        const box = new THREE.Box3().setFromObject(capy);
        const height = box.getSize(new THREE.Vector3()).y || 0.001;
        const scale = 1.0 / height;

        const capyGroup = new THREE.Group();
        capyGroup.add(capy);
        capy.scale.setScalar(scale);
        capyGroup.position.y = -0.05;

        // Fix Poly Pizza materials (move emissive→diffuse)
        capy.traverse(c => {
          if (!c.isMesh) return;
          c.castShadow = true;
          c.receiveShadow = true;
          if (c.material) {
            c.material = c.material.clone();
            if (c.material.emissiveMap && !c.material.map) {
              c.material.map = c.material.emissiveMap;
            }
            c.material.emissive.set(0, 0, 0);
            c.material.emissiveIntensity = 0;
            c.material.emissiveMap = null;
            c.material.metalness = 0;
            c.material.roughness = 0.8;
            c.material.needsUpdate = true;
          }
        });

        // Find head bone
        capy.traverse(c => {
          if (c.name === 'head' && c.isBone) {
            this.headBone = c;
            this._headBaseRot = { x: c.rotation.x, y: c.rotation.y, z: c.rotation.z };
          }
        });

        scene.add(capyGroup);
        this.group = capyGroup;
        resolve(this);
      }, undefined, reject);
    });
  }

  // Move capybara to world position, seated on terrain
  setGroundPos(x, z, getTerrainY) {
    if (!this.group) return;
    const y = getTerrainY(x, z);
    this.group.position.set(x, y - 0.05, z);
    this._groundPos.copy(this.group.position);
  }

  setWorldPos(x, y, z) {
    if (!this.group) return;
    this.group.position.set(x, y, z);
  }

  restoreGroundPose() {
    if (!this.group) return;
    this.group.position.copy(this._groundPos);
  }

  // Returns head bone world position (or capy pos + offset if no bone)
  getHeadWorldPos(out = new THREE.Vector3()) {
    if (this.headBone) {
      this.headBone.getWorldPosition(out);
    } else if (this.group) {
      this.group.getWorldPosition(out);
      out.y += 0.85;
    }
    return out;
  }

  // Approximate back/saddle point — used for sit_on_capy companions
  getBackWorldPos(out = new THREE.Vector3()) {
    if (this.group) {
      this.group.getWorldPosition(out);
      out.y += 0.72;
    }
    return out;
  }

  update(delta, elapsed) {
    if (!this.headBone) return;
    this._elapsed = elapsed;
    const t = elapsed;
    // Subtle lofi head sway
    this.headBone.rotation.y = this._headBaseRot.y + Math.sin(t * 0.8)          * 0.12;
    this.headBone.rotation.z = this._headBaseRot.z + Math.sin(t * 0.55 + 0.7)   * 0.06;
    this.headBone.rotation.x = this._headBaseRot.x + Math.sin(t * 0.50 + 1.2)   * 0.04;
  }
}
