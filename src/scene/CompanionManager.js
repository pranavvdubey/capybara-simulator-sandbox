import * as THREE from 'three';
import { COMPANIONS } from '../core/Constants.js';

export class CompanionManager {
  constructor(scene) {
    this._scene   = scene;
    this._capy    = null;
    this._current = null;
    this._actor   = null;
    this._isNight = false;
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
    this._setupTrail(this._actor);
  }

  setNight(isNight) {
    this._isNight = isNight;
    if (this._current === 'firefly' && this._actor) {
      const light = this._actor.userData.pointLight;
      if (light) light.intensity = isNight ? 2.2 : 0.7;
    }
  }

  update(delta, elapsed) {
    if (!this._actor || !this._capy) return;
    const def = COMPANIONS.find(c => c.id === this._current);
    if (!def) return;

    if (def.placementMode === 'hover_around') {
      this._updateHover(def, elapsed);
    } else if (def.placementMode === 'sit_on_capy') {
      this._updateSitOnCapy(def);
    } else if (def.placementMode === 'capy_on_companion') {
      this._updateCarry(def, elapsed);
    }

    // Wing flap — bee
    if (this._current === 'bee') {
      const wings = this._actor.userData.wings;
      if (wings) {
        const flap = Math.sin(elapsed * 28) * 0.35;
        wings[0].rotation.z =  0.35 + flap;
        wings[1].rotation.z = -0.35 - flap;
      }
    }

    // Wing flap — eagle (slower, majestic)
    if (this._current === 'eagle') {
      const wings = this._actor.userData.wings;
      if (wings) {
        const glide = Math.sin(elapsed * 1.8) * 0.25;
        wings[0].rotation.z =  0.2 + glide;
        wings[1].rotation.z = -0.2 - glide;
      }
    }

    // Laptop screen glow pulse
    if (this._current === 'laptop') {
      const glow = this._actor.userData.screenGlow;
      if (glow) {
        glow.material.opacity = 0.5 + Math.sin(elapsed * 0.8) * 0.15;
      }
    }

    // Wing flap — firefly
    if (this._current === 'firefly') {
      const wings = this._actor.userData.wings;
      if (wings) {
        const flap = Math.sin(elapsed * 22) * 0.4;
        wings[0].rotation.z =  0.3 + flap;
        wings[1].rotation.z = -0.3 - flap;
      }
      const light = this._actor.userData.pointLight;
      if (light) {
        const pulse = 0.7 + Math.sin(elapsed * 2.4) * 0.3;
        light.intensity = (this._isNight ? 2.2 : 0.7) * pulse;
      }
    }

    this._updateTrail(delta);
  }

  _clearCurrent() {
    if (this._actor) {
      this._teardownTrail(this._actor);
      this._scene.remove(this._actor);
      this._disposeGroup(this._actor);
      this._actor = null;
    }
    this._capy?.restoreGroundPose?.();
    this._current = null;
  }

  _updateHover(def, elapsed) {
    const capyPos = new THREE.Vector3();
    this._capy.group.getWorldPosition(capyPos);
    // Lissajous-ish path for more organic feel
    const angle = elapsed * def.hoverSpeed;
    const bob   = Math.sin(elapsed * 1.6) * 0.18;
    const tilt  = Math.sin(elapsed * 0.5) * def.hoverRadius * 0.25;
    this._actor.position.set(
      capyPos.x + Math.cos(angle) * def.hoverRadius,
      capyPos.y + def.hoverHeight + bob,
      capyPos.z + Math.sin(angle) * def.hoverRadius + tilt,
    );
    // Bank slightly into the turn
    this._actor.rotation.y = -angle + Math.PI / 2;
    this._actor.rotation.z = Math.sin(angle + Math.PI / 2) * 0.15;
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
    this._actor.rotation.y = this._capy.group.rotation.y;
  }

  _updateCarry(def, elapsed) {
    const capyBase = new THREE.Vector3();
    this._capy.getBackWorldPos(capyBase);
    const bob = Math.sin(elapsed * 2.1) * 0.08;
    const sway = Math.sin(elapsed * def.hoverSpeed * 4) * 0.18;
    this._actor.position.set(
      capyBase.x + sway,
      capyBase.y + def.hoverHeight + bob,
      capyBase.z,
    );
    this._actor.rotation.y = Math.PI + Math.sin(elapsed * 0.6) * 0.15;
    const rider = def.riderAnchor || { x: 0, y: 0.8, z: 0 };
    this._capy.setWorldPos(
      this._actor.position.x + rider.x,
      this._actor.position.y + rider.y,
      this._actor.position.z + rider.z,
    );
  }

  _setupTrail(actor) {
    const config = actor?.userData?.trailConfig;
    if (!config) return;
    const segments = [];
    for (let i = 0; i < config.count; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const segment = new THREE.Mesh(new THREE.SphereGeometry(config.size, 8, 8), material);
      segment.visible = false;
      segment.renderOrder = 1;
      segments.push(segment);
      this._scene.add(segment);
    }
    actor.userData.trail = {
      interval: config.interval,
      maxOpacity: config.opacity,
      scaleDecay: config.scaleDecay ?? 0.12,
      accumulator: config.interval,
      history: [],
      segments,
    };
  }

  _updateTrail(delta) {
    const trail = this._actor?.userData?.trail;
    if (!trail) return;

    trail.accumulator += delta;
    if (trail.accumulator >= trail.interval) {
      trail.accumulator = 0;
      trail.history.unshift(this._actor.position.clone());
      trail.history.length = Math.min(trail.history.length, trail.segments.length);
    }

    for (let i = 0; i < trail.segments.length; i++) {
      const segment = trail.segments[i];
      const pos = trail.history[i];
      if (!pos) {
        segment.visible = false;
        continue;
      }

      const t = 1 - i / trail.segments.length;
      const scale = 1 - i * trail.scaleDecay;
      segment.visible = true;
      segment.position.copy(pos);
      segment.scale.setScalar(Math.max(scale, 0.18));
      segment.material.opacity = trail.maxOpacity * t * t;
    }
  }

  _teardownTrail(actor) {
    const trail = actor?.userData?.trail;
    if (!trail) return;
    for (const segment of trail.segments) {
      this._scene.remove(segment);
      segment.geometry.dispose();
      segment.material.dispose();
    }
    delete actor.userData.trail;
  }

  // ── PROCEDURAL MESHES ──────────────────────────────────────────────────────

  _buildMesh(def) {
    switch (def.id) {
      case 'bee':         return this._buildBee();
      case 'firefly':     return this._buildFirefly();
      case 'frog':        return this._buildFrog();
      case 'rabbit':      return this._buildRabbit();
      case 'eagle':       return this._buildEagle();
      case 'penguin':     return this._buildPenguin();
      case 'laptop':      return this._buildLaptop();
      case 'headphones':  return this._buildHeadphones();
      case 'sunglasses':  return this._buildSunglasses();
      case 'lemonade':    return this._buildLemonade();
      default:            return new THREE.Group();
    }
  }

  _buildBee() {
    const g = new THREE.Group();
    const bodyMat  = new THREE.MeshLambertMaterial({ color: 0xf5c832 });
    const blackMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), bodyMat);
    body.scale.set(1.3, 0.7, 0.95);
    g.add(body);

    // Black stripes
    for (const z of [-0.06, 0.05]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 6, 12), blackMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.z = z;
      g.add(ring);
    }

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), blackMat);
    head.position.z = 0.20;
    g.add(head);

    // Wings
    const wingGeo = new THREE.PlaneGeometry(0.22, 0.13);
    const wingMat = new THREE.MeshBasicMaterial({
      color: 0xc8eeff, transparent: true, opacity: 0.6,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const wL = new THREE.Mesh(wingGeo, wingMat);
    wL.position.set(-0.18, 0.08, 0.02); wL.rotation.z = 0.35;
    const wR = new THREE.Mesh(wingGeo, wingMat.clone());
    wR.position.set( 0.18, 0.08, 0.02); wR.rotation.z = -0.35;
    g.add(wL, wR);
    g.userData.wings = [wL, wR];
    g.userData.trailConfig = {
      color: 0xffe27a,
      count: 10,
      size: 0.11,
      opacity: 0.42,
      interval: 0.035,
      scaleDecay: 0.06,
    };

    g.scale.setScalar(0.7);
    return g;
  }

  _buildFirefly() {
    const g = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 7, 5),
      new THREE.MeshBasicMaterial({ color: 0xeeff88 }),
    );
    g.add(body);

    // Tiny wings
    const wingMat = new THREE.MeshBasicMaterial({
      color: 0xaaddff, transparent: true, opacity: 0.4,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const wingGeo = new THREE.PlaneGeometry(0.10, 0.06);
    const wL = new THREE.Mesh(wingGeo, wingMat);
    wL.position.set(-0.08, 0.02, 0); wL.rotation.y = 0.3;
    const wR = new THREE.Mesh(wingGeo, wingMat.clone());
    wR.position.set( 0.08, 0.02, 0); wR.rotation.y = -0.3;
    g.add(wL, wR);
    g.userData.wings = [wL, wR];

    const light = new THREE.PointLight(0xddff66, 0.7, 3.0);
    g.add(light);
    g.userData.pointLight = light;

    return g;
  }

  _buildFrog() {
    const g = new THREE.Group();
    const green     = new THREE.MeshLambertMaterial({ color: 0x4aae2a });
    const darkGreen = new THREE.MeshLambertMaterial({ color: 0x3a8e20 });
    const eyeMat    = new THREE.MeshLambertMaterial({ color: 0xf8e840 });
    const pupilMat  = new THREE.MeshLambertMaterial({ color: 0x111100 });

    // Body — wider, flatter
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.32), green);
    g.add(body);

    // Head — wide and flat, pushed forward
    const headGeo = new THREE.SphereGeometry(0.14, 8, 6);
    const head = new THREE.Mesh(headGeo, green);
    head.scale.set(1.2, 0.75, 1.05);
    head.position.set(0, 0.05, 0.22);
    g.add(head);

    // Bulging eyes
    for (const [ox] of [[-0.08], [0.08]]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 7, 6), eyeMat);
      eye.position.set(ox, 0.12, 0.17);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), pupilMat);
      pupil.position.z = 0.035;
      eye.add(pupil);
      g.add(eye);
    }

    // Back legs (wide, spread)
    for (const [ox, oz] of [[-0.15, -0.12], [0.15, -0.12]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.14), darkGreen);
      leg.position.set(ox, -0.07, oz);
      leg.rotation.z = ox < 0 ? 0.3 : -0.3;
      g.add(leg);
    }
    // Front legs
    for (const [ox] of [[-0.12], [0.12]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.08), darkGreen);
      leg.position.set(ox, -0.06, 0.12);
      g.add(leg);
    }

    g.scale.setScalar(1.1);
    return g;
  }

  _buildRabbit() {
    const g = new THREE.Group();
    const white = new THREE.MeshLambertMaterial({ color: 0xf2f0ee });
    const pink  = new THREE.MeshLambertMaterial({ color: 0xf0a0b0 });
    const dark  = new THREE.MeshLambertMaterial({ color: 0x222222 });

    // Body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 9, 7), white);
    body.scale.set(1, 1.15, 1);
    g.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 9, 7), white);
    head.position.set(0, 0.22, 0.08);
    g.add(head);

    // Ears
    const earGeo   = new THREE.CylinderGeometry(0.03, 0.03, 0.30, 6);
    const innerGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.25, 5);
    for (const [ox, tilt] of [[-0.07, -0.1], [0.07, 0.1]]) {
      const ear   = new THREE.Mesh(earGeo, white);
      const inner = new THREE.Mesh(innerGeo, pink);
      ear.position.set(ox, 0.44, 0.06);
      ear.rotation.z = tilt;
      ear.add(inner);
      g.add(ear);
    }

    // Eyes
    for (const [ox] of [[-0.055], [0.055]]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), dark);
      eye.position.set(ox, 0.24, 0.14);
      g.add(eye);
    }

    // Nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.014, 5, 4), pink);
    nose.position.set(0, 0.20, 0.175);
    g.add(nose);

    // Tail
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.07, 7, 6), white);
    tail.position.set(0, 0.04, -0.19);
    g.add(tail);

    g.scale.setScalar(1.0);
    return g;
  }

  _buildEagle() {
    const g = new THREE.Group();
    const brown  = new THREE.MeshLambertMaterial({ color: 0x5a3a18 });
    const darkBr = new THREE.MeshLambertMaterial({ color: 0x3a2010 });
    const white  = new THREE.MeshLambertMaterial({ color: 0xf0ece0 });
    const yellow = new THREE.MeshLambertMaterial({ color: 0xe8b820 });

    // Body — torpedo shape
    const bodyGeo = new THREE.SphereGeometry(0.22, 8, 6);
    const body = new THREE.Mesh(bodyGeo, brown);
    body.scale.set(0.85, 0.75, 1.2);
    g.add(body);

    // White head + neck
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 7), white);
    head.position.set(0, 0.08, 0.28);
    g.add(head);

    // Yellow beak
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 6), yellow);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.04, 0.44);
    g.add(beak);

    // Wings — large flat planes
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(0, -0.6);
    wingShape.bezierCurveTo(-0.1, -0.55, -0.3, -0.4, -0.5, -0.25);
    wingShape.bezierCurveTo(-0.6, -0.15, -0.65, -0.05, -0.5, 0.05);
    wingShape.lineTo(0, 0);
    const wingGeo = new THREE.ShapeGeometry(wingShape, 6);
    const wingMat = new THREE.MeshLambertMaterial({ color: 0x4a2e10, side: THREE.DoubleSide });

    const wL = new THREE.Mesh(wingGeo, wingMat);
    wL.position.set(-0.22, 0, 0.05);
    wL.rotation.y = 0.1;
    const wR = wL.clone();
    wR.position.set(0.22, 0, 0.05);
    wR.rotation.set(0, Math.PI - 0.1, 0);
    g.add(wL, wR);
    g.userData.wings = [wL, wR];

    // Tail feathers
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 6), darkBr);
    tail.rotation.x = -Math.PI / 2;
    tail.position.set(0, -0.04, -0.28);
    g.add(tail);

    // Talons (yellow cylinders)
    for (const [ox] of [[-0.06], [0.06]]) {
      const talon = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.015, 0.1, 5), yellow);
      talon.position.set(ox, -0.22, 0.1);
      g.add(talon);
    }

    g.userData.trailConfig = {
      color: 0xf7f3ec,
      count: 12,
      size: 0.14,
      opacity: 0.34,
      interval: 0.045,
      scaleDecay: 0.055,
    };

    g.scale.setScalar(1.75);
    return g;
  }

  _buildPenguin() {
    const g = new THREE.Group();
    const black  = new THREE.MeshLambertMaterial({ color: 0x1a1a2a });
    const white  = new THREE.MeshLambertMaterial({ color: 0xf0f0ee });
    const orange = new THREE.MeshLambertMaterial({ color: 0xe87820 });

    // Body — egg shape, black back
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.20, 9, 8), black);
    body.scale.set(0.88, 1.15, 0.9);
    g.add(body);

    // White belly patch
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 7), white);
    belly.scale.set(0.72, 0.95, 0.4);
    belly.position.set(0, -0.01, 0.12);
    g.add(belly);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 9, 8), black);
    head.position.set(0, 0.28, 0);
    g.add(head);

    // White face patch
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 6), white);
    face.scale.set(0.8, 0.75, 0.4);
    face.position.set(0, 0.28, 0.1);
    g.add(face);

    // Beak
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.10, 5), orange);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.27, 0.22);
    g.add(beak);

    // Eyes
    for (const [ox] of [[-0.06], [0.06]]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 5, 4), white);
      eye.position.set(ox, 0.31, 0.15);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.013, 4, 3),
        new THREE.MeshLambertMaterial({ color: 0x111111 }));
      pupil.position.z = 0.015;
      eye.add(pupil);
      g.add(eye);
    }

    // Flippers
    const flipperGeo = new THREE.BoxGeometry(0.06, 0.22, 0.06);
    for (const [ox, rz] of [[-0.24, 0.3], [0.24, -0.3]]) {
      const flipper = new THREE.Mesh(flipperGeo, black);
      flipper.position.set(ox, 0, 0);
      flipper.rotation.z = rz;
      g.add(flipper);
    }

    // Orange feet
    for (const [ox] of [[-0.07], [0.07]]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.12), orange);
      foot.position.set(ox, -0.26, 0.03);
      g.add(foot);
    }

    g.scale.setScalar(0.92);
    return g;
  }

  _buildLaptop() {
    const g = new THREE.Group();
    const silver = new THREE.MeshLambertMaterial({ color: 0xc8c8c8 });
    const dark   = new THREE.MeshLambertMaterial({ color: 0x18181e });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x6080ff, transparent: true, opacity: 0.65 });

    // Keyboard base
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.028, 0.32), silver);
    base.position.set(0, 0.014, 0);
    g.add(base);

    // Screen lid (hinged back, slightly open)
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.30, 0.022), silver);
    lid.position.set(0, 0.168, -0.155);
    lid.rotation.x = 0.28;
    g.add(lid);

    // Screen glow (lofi blue/purple)
    const screenGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), glowMat);
    screenGlow.position.set(0, 0.168, -0.146);
    screenGlow.rotation.x = 0.28;
    g.userData.screenGlow = screenGlow;
    g.add(screenGlow);

    // Keys (just a subtle dark panel)
    const keys = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.005, 0.22), dark);
    keys.position.set(0, 0.03, 0.02);
    g.add(keys);

    // Trackpad
    const tp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.003, 0.10),
      new THREE.MeshLambertMaterial({ color: 0xa8a8a8 }));
    tp.position.set(0, 0.031, 0.09);
    g.add(tp);

    g.scale.setScalar(1.45);
    return g;
  }

  _buildHeadphones() {
    const g = new THREE.Group();
    const bandMat  = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const cushMat  = new THREE.MeshLambertMaterial({ color: 0x282828 });
    const accentMat = new THREE.MeshLambertMaterial({ color: 0x60c0f0 });

    // Headband arc (torus, half-circle)
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.022, 7, 14, Math.PI), bandMat);
    band.rotation.z = Math.PI / 2;
    g.add(band);

    // Ear cushions
    for (const ox of [-0.155, 0.155]) {
      const cush = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.038, 10), cushMat);
      cush.position.set(ox, 0, 0);
      cush.rotation.z = Math.PI / 2;
      g.add(cush);
      // Accent ring
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.007, 5, 10), accentMat);
      ring.position.set(ox, 0, 0);
      ring.rotation.y = Math.PI / 2;
      g.add(ring);
    }

    // Padding on band
    const padMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.28, 6), padMat);
    pad.rotation.z = Math.PI / 2;
    g.add(pad);

    g.traverse(c => { if (c.isMesh) { c.renderOrder = 2; c.material.depthTest = false; } });
    g.scale.setScalar(1.45);
    return g;
  }

  _buildSunglasses() {
    const g = new THREE.Group();
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const lensMat  = new THREE.MeshLambertMaterial({ color: 0x2244aa, transparent: true, opacity: 0.72 });

    // Two circular lenses
    for (const ox of [-0.10, 0.10]) {
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.068, 9), lensMat);
      lens.position.set(ox, 0, 0.001);
      g.add(lens);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.011, 5, 10), frameMat);
      rim.position.set(ox, 0, 0);
      g.add(rim);
    }

    // Bridge (connecting the lenses)
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.010, 0.010), frameMat);
    bridge.position.set(0, 0.01, 0);
    g.add(bridge);

    // Temple arms
    for (const [ox, ry] of [[-0.168, 0.2], [0.168, -0.2]]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.009, 0.009), frameMat);
      arm.position.set(ox + (ox < 0 ? -0.05 : 0.05), 0, -0.04);
      arm.rotation.y = ry;
      g.add(arm);
    }

    g.traverse(c => { if (c.isMesh) { c.renderOrder = 2; c.material.depthTest = false; } });
    g.scale.setScalar(0.88);
    return g;
  }

  _buildLemonade() {
    const g = new THREE.Group();
    const glassMat  = new THREE.MeshLambertMaterial({ color: 0xd0e8f8, transparent: true, opacity: 0.55 });
    const liqMat    = new THREE.MeshLambertMaterial({ color: 0xf0d840, transparent: true, opacity: 0.82 });
    const strawMat  = new THREE.MeshLambertMaterial({ color: 0xff5050 });
    const iceMat    = new THREE.MeshLambertMaterial({ color: 0xe8f4fc, transparent: true, opacity: 0.78 });
    const lemonMat  = new THREE.MeshLambertMaterial({ color: 0xf8e030 });

    // Glass body
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.056, 0.22, 12), glassMat);
    glass.position.y = 0.11;
    g.add(glass);

    // Liquid inside
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.063, 0.047, 0.16, 12), liqMat);
    liquid.position.y = 0.096;
    g.add(liquid);

    // Ice cube (peeking out)
    const ice = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.055), iceMat);
    ice.position.set(0.012, 0.175, 0.008);
    ice.rotation.y = 0.45;
    g.add(ice);

    // Straw
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.30, 5), strawMat);
    straw.position.set(0.04, 0.24, 0);
    straw.rotation.z = 0.14;
    g.add(straw);

    // Lemon slice on rim
    const slice = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.009, 9), lemonMat);
    slice.position.set(0.06, 0.228, 0);
    slice.rotation.z = 0.42;
    g.add(slice);

    g.scale.setScalar(0.88);
    return g;
  }

  _disposeGroup(g) {
    g.traverse(c => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
        else c.material.dispose();
      }
    });
  }
}
