import * as THREE from 'three';
import { INTERACTIONS } from '../core/Constants.js';
import { eventBus, Events } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';

export class InteractionSystem {
  constructor(scene, capybara, companionManager) {
    this._scene = scene;
    this._capy = capybara;
    this._companions = companionManager;
    this._active = [];
    this._peakEffects = [];
    this._clock = 0;
  }

  trigger(type) {
    const biomeSet = INTERACTIONS[gameState.biome];
    const config = biomeSet?.[type];
    if (!config || !this._capy?.group) return false;

    gameState.activeInteraction = type;
    gameState.addChillPoints(config.reward, `${gameState.biome}-${type}`);
    eventBus.emit(Events.PROGRESSION_CHANGED, { chillPoints: gameState.chillPoints });
    eventBus.emit(Events.INTERACTION_STATE_CHANGED, { activeInteraction: type });
    gameState.save();

    this._spawnEffect(config.effect, type);
    return true;
  }

  startPeakMoment(biome) {
    this._clearPeak();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.2, 0.06, 18, 64),
      new THREE.MeshBasicMaterial({
        color: biome === 'riverside' ? 0xffdf9a : biome === 'jungle' ? 0x8ff5a8 : 0xf5ef9f,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    this._scene.add(ring);
    this._peakEffects.push({
      mesh: ring,
      ttl: 6.5,
      age: 0,
      kind: 'ring',
    });

    for (let i = 0; i < 28; i++) {
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.06 + Math.random() * 0.05, 8, 8),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0.12 + Math.random() * 0.18, 0.8, 0.7),
          transparent: true,
          opacity: 0.82,
          depthWrite: false,
        }),
      );
      particle.userData.angle = (i / 28) * Math.PI * 2;
      particle.userData.radius = 1.4 + Math.random() * 1.2;
      particle.userData.height = 0.5 + Math.random() * 1.4;
      this._scene.add(particle);
      this._peakEffects.push({
        mesh: particle,
        ttl: 6.5,
        age: 0,
        kind: 'particle',
      });
    }
  }

  endPeakMoment() {
    this._clearPeak();
  }

  update(delta, elapsed) {
    this._clock = elapsed;
    this._updateEntries(this._active, delta, elapsed);
    this._updatePeak(delta, elapsed);
  }

  _spawnEffect(effectName, type) {
    const anchor = this._capy.getHeadWorldPos(new THREE.Vector3());
    const count = type === 'play' ? 18 : type === 'treat' ? 10 : 14;

    for (let i = 0; i < count; i++) {
      const color = colorForEffect(effectName, i);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(type === 'treat' ? 0.045 : 0.06, 8, 8),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
        }),
      );
      mesh.position.copy(anchor);
      this._scene.add(mesh);
      this._active.push({
        mesh,
        type,
        effectName,
        angle: (i / count) * Math.PI * 2,
        radius: 0.5 + Math.random() * 1.1,
        lift: 0.2 + Math.random() * 0.9,
        ttl: type === 'play' ? 3.2 : 2.4,
        age: 0,
      });
    }
  }

  _updateEntries(entries, delta, elapsed) {
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      entry.age += delta;
      const t = Math.min(entry.age / entry.ttl, 1);
      const base = this._capy.getBackWorldPos(new THREE.Vector3());
      const wobble = elapsed * (entry.type === 'play' ? 2.2 : 1.4);
      entry.mesh.position.set(
        base.x + Math.cos(entry.angle + wobble) * entry.radius * (0.8 + t * 0.7),
        base.y + 0.2 + entry.lift * t + Math.sin(entry.angle + elapsed * 2.0) * 0.08,
        base.z + Math.sin(entry.angle + wobble) * entry.radius * 0.8,
      );
      entry.mesh.scale.setScalar(1 + t * 0.8);
      entry.mesh.material.opacity = (1 - t) * 0.8;
      if (entry.age >= entry.ttl) {
        this._scene.remove(entry.mesh);
        entry.mesh.geometry.dispose();
        entry.mesh.material.dispose();
        entries.splice(i, 1);
      }
    }

    if (entries.length === 0 && gameState.activeInteraction && !gameState.peakMoment) {
      gameState.activeInteraction = null;
      eventBus.emit(Events.INTERACTION_STATE_CHANGED, { activeInteraction: null });
    }
  }

  _updatePeak(delta, elapsed) {
    for (let i = this._peakEffects.length - 1; i >= 0; i--) {
      const entry = this._peakEffects[i];
      entry.age += delta;
      const t = Math.min(entry.age / entry.ttl, 1);
      if (entry.kind === 'ring') {
        const pos = this._capy.getBackWorldPos(new THREE.Vector3());
        entry.mesh.position.set(pos.x, pos.y + 0.15, pos.z);
        const scale = 1 + t * 1.8;
        entry.mesh.scale.setScalar(scale);
        entry.mesh.material.opacity = (1 - t) * 0.85;
      } else {
        const pos = this._capy.getBackWorldPos(new THREE.Vector3());
        entry.mesh.position.set(
          pos.x + Math.cos(entry.mesh.userData.angle + elapsed * 0.8) * entry.mesh.userData.radius,
          pos.y + entry.mesh.userData.height + Math.sin(elapsed * 2.0 + entry.mesh.userData.angle) * 0.16,
          pos.z + Math.sin(entry.mesh.userData.angle + elapsed * 0.8) * entry.mesh.userData.radius,
        );
        entry.mesh.material.opacity = (1 - t) * 0.8;
      }
      if (entry.age >= entry.ttl) {
        this._scene.remove(entry.mesh);
        entry.mesh.geometry.dispose();
        entry.mesh.material.dispose();
        this._peakEffects.splice(i, 1);
      }
    }
  }

  _clearPeak() {
    for (const entry of this._peakEffects) {
      this._scene.remove(entry.mesh);
      entry.mesh.geometry.dispose();
      entry.mesh.material.dispose();
    }
    this._peakEffects = [];
  }
}

function colorForEffect(effectName, i) {
  switch (effectName) {
    case 'petal-bloom': return i % 2 === 0 ? 0xf6c4d9 : 0xffe08a;
    case 'carrot-gift': return i % 2 === 0 ? 0xf79947 : 0x95cc5d;
    case 'bee-spiral': return i % 2 === 0 ? 0xffd85e : 0xfff5be;
    case 'lantern-drift': return i % 2 === 0 ? 0xffd38a : 0xfff3c2;
    case 'lily-treat': return i % 2 === 0 ? 0xd3ffdf : 0xa7ffd8;
    case 'splash-rings': return i % 2 === 0 ? 0xa7f0ff : 0xd9fbff;
    case 'canopy-hush': return i % 2 === 0 ? 0x86e8a2 : 0xd5ff8f;
    case 'fruit-toss': return i % 2 === 0 ? 0xffa85e : 0xff5e75;
    case 'bird-flyover': return i % 2 === 0 ? 0xf5f7ff : 0xb1d1ff;
    case 'cloud-rest': return i % 2 === 0 ? 0xe8f2ff : 0xc4ddff;
    case 'trail-mix': return i % 2 === 0 ? 0xf5d08a : 0xbf8f5f;
    case 'glider-run': return i % 2 === 0 ? 0xdcefff : 0xfaf0d0;
    case 'snow-nest': return i % 2 === 0 ? 0xf7fbff : 0xcde7ff;
    case 'berry-pop': return i % 2 === 0 ? 0xff8ab7 : 0xe8f4ff;
    case 'aurora-dash': return i % 2 === 0 ? 0xa5ffd8 : 0xb7d8ff;
    case 'desk-drift': return i % 2 === 0 ? 0xffdca4 : 0xcdb7ff;
    case 'citrus-sip': return i % 2 === 0 ? 0xfff099 : 0xffc25a;
    case 'beat-bounce': return i % 2 === 0 ? 0xa6f0ff : 0xffd2f2;
    default: return 0xffffff;
  }
}
