import * as THREE from 'three';
import { COMPANIONS } from '../core/Constants.js';

// Manages companion actors. All companions use procedural geometry (MVP).
// Placement modes:
//   hover_around — orbits capybara at defined radius/height
//   sit_on_capy  — attached to capybara's back anchor
export class CompanionManager {
  constructor(scene) {
    this._scene     = scene;
    this._capy      = null;
    this._current   = null;   // active companion id
    this._actor     = null;   // THREE.Group for the companion mesh
    this._elapsed   = 0;
    this._isNight   = false;  // firefly glow boost
  }

  setCapybara(capy) { this._capy = capy; }

  setCompanion(id) {
    this._clearCurrent();
    if (!id) return;
    const def = COMPANIONS.find(c => c.id === id);
    if (!def) return;
    this._current = id;
    this._actor = this._buildMesh(def);
    this._scene.add(this._actor);
  }

  setNight(isNight) {
    this._isNight = isNight;
    // Boost firefly glow at night
    if (this._current === 'firefly' && this._actor) {
      const light = this._actor.userData.pointLight;
      if (light) light.intensity = isNight ? 1.8 : 0.6;
    }
  }

  update(delta, elapsed) {
    this._elapsed = elapsed;
    if (!this._actor || !this._capy) return;
    const def = COMPANIONS.find(c => c.id === this._current);
    if (!def) return;

    if (def.placementMode === 'hover_around') {
      this._updateHover(def, elapsed);
    } else if (def.placementMode === 'sit_on_capy') {
      this._updateSitOnCapy(def);
    }

    // Wing flap for bee
    if (this._current === 'bee') {
      const wings = this._actor.userData.wings;
      if (wings) {
        const flap = Math.sin(elapsed * 28) * 0.3;
        wings[0].rotation.z =  0.3 + flap;
        wings[1].rotation.z = -0.3 - flap;
      }
    }

    // Firefly glow pulse
    if (this._current === 'firefly') {
      const light = this._actor.userData.pointLight;
      if (light) {
        const pulse = 0.6 + Math.sin(elapsed * 2.2) * 0.2;
        light.intensity = (this._isNight ? 1.8 : 0.6) * pulse;
      }
    }
  }

  _clearCurrent() {
    if (this._actor) {
      this._scene.remove(this._actor);
      this._disposeGroup(this._actor);
      this._actor = null;
    }
    this._current = null;
  }

  _updateHover(def, elapsed) {
    const capyPos = new THREE.Vector3();
    this._capy.group.getWorldPosition(capyPos);
    const angle = elapsed * def.hoverSpeed;
    const bob   = Math.sin(elapsed * 1.4) * 0.15;
    this._actor.position.set(
      capyPos.x + Math.cos(angle) * def.hoverRadius,
      capyPos.y + def.hoverHeight + bob,
      capyPos.z + Math.sin(angle) * def.hoverRadius,
    );
    // Face direction of travel
    this._actor.rotation.y = -angle + Math.PI / 2;
  }

  _updateSitOnCapy(def) {
    const anchor = def.sitAnchor;
    const capyPos = new THREE.Vector3();
    this._capy.group.getWorldPosition(capyPos);
    this._actor.position.set(
      capyPos.x + anchor.x,
      capyPos.y + anchor.y,
      capyPos.z + anchor.z,
    );
    // Match capybara rotation
    this._actor.rotation.y = this._capy.group.rotation.y;
  }

  // ── PROCEDURAL MESH BUILDERS ───────────────────────────────────────────────

  _buildMesh(def) {
    switch (def.id) {
      case 'bee':      return this._buildBee();
      case 'firefly':  return this._buildFirefly();
      case 'frog':     return this._buildFrog();
      case 'rabbit':   return this._buildRabbit();
      default:         return new THREE.Group();
    }
  }

  _buildBee() {
    const g = new THREE.Group();

    // Body (yellow ellipsoid)
    const bodyGeo = new THREE.SphereGeometry(0.14, 8, 6);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xf5c832 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.scale.set(1, 0.68, 0.88);
    g.add(body);

    // Black stripe rings
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    [-0.05, 0.04].forEach(z => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.1, 0.03, 6, 12),
        stripeMat,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0, z);
      g.add(ring);
    });

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 6, 5),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
    );
    head.position.set(0, 0, 0.17);
    g.add(head);

    // Wings (transparent planes)
    const wingGeo = new THREE.PlaneGeometry(0.20, 0.11);
    const wingMat = new THREE.MeshBasicMaterial({
      color: 0xc8eeff, transparent: true, opacity: 0.55,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const wingL = new THREE.Mesh(wingGeo, wingMat);
    wingL.position.set(-0.15, 0.06, 0.02);
    wingL.rotation.z = 0.3;
    const wingR = new THREE.Mesh(wingGeo, wingMat.clone());
    wingR.position.set(0.15, 0.06, 0.02);
    wingR.rotation.z = -0.3;
    g.add(wingL, wingR);
    g.userData.wings = [wingL, wingR];

    g.scale.setScalar(0.55);
    return g;
  }

  _buildFirefly() {
    const g = new THREE.Group();

    // Glowing body
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 7, 5),
      new THREE.MeshBasicMaterial({ color: 0xeeff88 }),
    );
    g.add(body);

    // Tiny wings
    const wingMat = new THREE.MeshBasicMaterial({
      color: 0xaaddff, transparent: true, opacity: 0.35,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const wingGeo = new THREE.PlaneGeometry(0.08, 0.05);
    const wL = new THREE.Mesh(wingGeo, wingMat); wL.position.set(-0.06, 0.02, 0); wL.rotation.y = 0.3;
    const wR = new THREE.Mesh(wingGeo, wingMat.clone()); wR.position.set(0.06, 0.02, 0); wR.rotation.y = -0.3;
    g.add(wL, wR);

    // Point light for glow
    const light = new THREE.PointLight(0xddff66, 0.6, 2.5);
    light.position.set(0, 0, 0);
    g.add(light);
    g.userData.pointLight = light;

    return g;
  }

  _buildFrog() {
    const g = new THREE.Group();
    const green = new THREE.MeshLambertMaterial({ color: 0x5a9e3a });
    const darkGreen = new THREE.MeshLambertMaterial({ color: 0x3a7020 });

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.10, 0.24), green);
    g.add(body);

    // Head (slightly wider than body)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 7, 5), green);
    head.scale.set(1.15, 0.75, 1);
    head.position.set(0, 0.04, 0.18);
    g.add(head);

    // Bulging eyes
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0xf0e040 });
    const pupilMat = new THREE.MeshLambertMaterial({ color: 0x111100 });
    [[-0.06, 0.10], [0.06, 0.10]].forEach(([ox]) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), eyeMat);
      eye.position.set(ox, 0.10, 0.14);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.018, 5, 4), pupilMat);
      pupil.position.set(0, 0, 0.025);
      eye.add(pupil);
      g.add(eye);
    });

    // Legs
    const legGeo = new THREE.BoxGeometry(0.06, 0.05, 0.10);
    [[-0.11, 0.08], [0.11, 0.08], [-0.09, -0.09], [0.09, -0.09]].forEach(([ox, oz]) => {
      const leg = new THREE.Mesh(legGeo, darkGreen);
      leg.position.set(ox, -0.05, oz);
      g.add(leg);
    });

    g.scale.setScalar(0.85);
    return g;
  }

  _buildRabbit() {
    const g = new THREE.Group();
    const white  = new THREE.MeshLambertMaterial({ color: 0xf0f0ee });
    const pink   = new THREE.MeshLambertMaterial({ color: 0xf0a0b0 });
    const dark   = new THREE.MeshLambertMaterial({ color: 0x222222 });

    // Body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), white);
    body.scale.set(1, 1.1, 1);
    g.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 6), white);
    head.position.set(0, 0.18, 0.06);
    g.add(head);

    // Ears (two elongated cylinders)
    const earGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.24, 5);
    const innerEarGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.20, 5);
    [[-0.055, 0], [0.055, 0]].forEach(([ox]) => {
      const ear = new THREE.Mesh(earGeo, white);
      ear.position.set(ox + (Math.random()-0.5)*0.01, 0.35, 0.04);
      ear.rotation.z = ox < 0 ? -0.08 : 0.08;
      const inner = new THREE.Mesh(innerEarGeo, pink);
      inner.position.y = 0;
      ear.add(inner);
      g.add(ear);
    });

    // Eyes
    [[-0.04, 0.21, 0.10], [0.04, 0.21, 0.10]].forEach(([x, y, z]) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 5, 4), dark);
      eye.position.set(x, y, z);
      g.add(eye);
    });

    // Nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.012, 4, 4), pink);
    nose.position.set(0, 0.18, 0.14);
    g.add(nose);

    // Fluffy tail (small sphere)
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), white);
    tail.position.set(0, 0.04, -0.16);
    g.add(tail);

    g.scale.setScalar(0.8);
    return g;
  }

  _disposeGroup(g) {
    g.traverse(c => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
        else c.material.dispose();
      }
      if (c.isLight) c.dispose?.();
    });
  }
}
