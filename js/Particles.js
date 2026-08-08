"use strict";

// Particles — tire smoke, collision sparks, dust trail.
// Uses pooled sprites for performance.

const Particles = {
  scene: null,
  _pool: [],
  _max: 300,

  init(scene) {
    this.scene = scene;

    // Shared textures
    this._smokeTex = this._makeRadial(128, [
      [0, "rgba(180,180,180,0.6)"],
      [0.4, "rgba(160,160,160,0.3)"],
      [1, "rgba(120,120,120,0)"],
    ]);
    this._sparkTex = this._makeRadial(64, [
      [0, "rgba(255,240,180,1)"],
      [0.3, "rgba(255,180,60,0.8)"],
      [1, "rgba(255,100,20,0)"],
    ]);
    this._dustTex = this._makeRadial(128, [
      [0, "rgba(160,140,110,0.4)"],
      [0.5, "rgba(140,120,90,0.15)"],
      [1, "rgba(120,100,70,0)"],
    ]);

    // Pre-allocate pool
    for (let i = 0; i < this._max; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this._smokeTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.userData = { active: false, life: 0, maxLife: 1, vel: new THREE.Vector3(), type: "" };
      this.scene.add(sprite);
      this._pool.push(sprite);
    }
  },

  _makeRadial(size, stops) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [offset, color] of stops) g.addColorStop(offset, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  },

  _get() {
    for (const p of this._pool) {
      if (!p.userData.active) return p;
    }
    return null;
  },

  // Emit a puff of tire smoke behind the car.
  emitTireSmoke(pos, carYaw, speed) {
    if (Math.abs(speed) < 3) return;
    const rate = Math.min(4, Math.abs(speed) / 5);
    if (Math.random() > rate * 0.3) return;

    const p = this._get();
    if (!p) return;

    const offset = (Math.random() - 0.5) * 1.2;
    const behind = 1.6 + Math.random() * 0.5;
    p.position.set(
      pos.x + Math.sin(-carYaw) * behind + Math.cos(-carYaw) * offset,
      0.2 + Math.random() * 0.2,
      pos.z + Math.cos(-carYaw) * behind - Math.sin(-carYaw) * offset
    );

    p.material.map = this._smokeTex;
    p.material.color.setHex(0xcccccc);
    p.material.opacity = 0.5;
    p.material.needsUpdate = true;
    p.scale.set(0.5, 0.5, 0.5);

    const u = p.userData;
    u.active = true;
    u.life = 0;
    u.maxLife = 0.6 + Math.random() * 0.5;
    u.vel.set((Math.random() - 0.5) * 1.5, 0.8 + Math.random() * 0.5, (Math.random() - 0.5) * 1.5);
    u.type = "smoke";
    p.visible = true;
  },

  // Emit sparks on building collision.
  emitSparks(pos, normal) {
    const count = 6 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      const p = this._get();
      if (!p) return;

      p.position.copy(pos);
      p.position.y = 0.3 + Math.random() * 0.8;

      p.material.map = this._sparkTex;
      p.material.color.setHex(0xffeedd);
      p.material.opacity = 1;
      p.material.blending = THREE.AdditiveBlending;
      p.material.needsUpdate = true;
      p.scale.set(0.25, 0.25, 0.25);

      const u = p.userData;
      u.active = true;
      u.life = 0;
      u.maxLife = 0.2 + Math.random() * 0.3;
      const spread = 4 + Math.random() * 4;
      u.vel.set(
        (normal ? normal.x : (Math.random() - 0.5)) * spread + (Math.random() - 0.5) * 3,
        2 + Math.random() * 5,
        (normal ? normal.z : (Math.random() - 0.5)) * spread + (Math.random() - 0.5) * 3
      );
      u.type = "spark";
      p.visible = true;
    }
  },

  // Emit dust trail behind fast-moving car.
  emitDust(pos, carYaw, speed) {
    if (Math.abs(speed) < 8) return;
    if (Math.random() > 0.4) return;

    const p = this._get();
    if (!p) return;

    const behind = 2.0 + Math.random();
    p.position.set(
      pos.x + Math.sin(-carYaw) * behind,
      0.1,
      pos.z + Math.cos(-carYaw) * behind
    );

    p.material.map = this._dustTex;
    p.material.color.setHex(0xbba888);
    p.material.opacity = 0.35;
    p.material.blending = THREE.NormalBlending;
    p.material.needsUpdate = true;
    p.scale.set(0.4, 0.2, 0.4);

    const u = p.userData;
    u.active = true;
    u.life = 0;
    u.maxLife = 1.0 + Math.random() * 0.8;
    u.vel.set((Math.random() - 0.5) * 0.8, 0.3 + Math.random() * 0.3, (Math.random() - 0.5) * 0.8);
    u.type = "dust";
    p.visible = true;
  },

  update(dt) {
    for (const p of this._pool) {
      const u = p.userData;
      if (!u.active) continue;

      u.life += dt;
      if (u.life >= u.maxLife) {
        u.active = false;
        p.visible = false;
        continue;
      }

      const t = u.life / u.maxLife;

      // Move
      p.position.x += u.vel.x * dt;
      p.position.y += u.vel.y * dt;
      p.position.z += u.vel.z * dt;

      // Gravity for sparks
      if (u.type === "spark") {
        u.vel.y -= 18 * dt;
        p.material.opacity = 1 - t;
        const s = 0.25 * (1 - t * 0.5);
        p.scale.set(s, s, s);
      }
      // Smoke rises and fades
      else if (u.type === "smoke") {
        u.vel.y *= 0.97;
        p.material.opacity = 0.5 * (1 - t);
        const s = 0.5 + t * 1.5;
        p.scale.set(s, s, s);
      }
      // Dust drifts and fades
      else if (u.type === "dust") {
        u.vel.y *= 0.95;
        p.material.opacity = 0.35 * (1 - t);
        const s = 0.4 + t * 2.0;
        p.scale.set(s, s * 0.4, s);
      }
    }
  },
};
