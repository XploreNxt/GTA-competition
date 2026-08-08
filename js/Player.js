"use strict";

// Player — the character. Two states: on foot (.person) or driving (.car).
// WASD moves, E enters/exits the nearest car.

const Player = {
  person: null,       // foot character mesh (in scene)
  car: null,          // currently driven car group, or null when on foot
  inCar: false,

  speed: 0,           // car speed m/s
  maxSpeed: 18,
  maxReverse: -7,
  accel: 14,
  brake: 24,
  coastDrag: 9,
  yaw: 0,
  turnRate: 2.2,
  footSpeed: 4.2,

  health: 100,
  maxHealth: 100,
  alive: true,

  _eLast: false,

  spawn(x, z) {
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0x4a7abb, roughness: 0.8 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.9 });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.7, 8), skin);
    torso.position.y = 1.35;
    torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
    head.position.y = 1.9;
    head.castShadow = true;
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.7, 6), pants);
    legs.position.y = 0.7;
    legs.castShadow = true;
    g.add(torso, head, legs);
    g.position.set(x, 0, z);
    this.person = g;
    this.yaw = 0;
    this.health = this.maxHealth;
    this.alive = true;
  },

  damage(v) {
    if (!this.alive) return;
    this.health = Math.max(0, this.health - v);
    HUD.setHealth(this.health);
    if (this.health <= 0) {
      this.alive = false;
      Police.onKilled();
    }
  },

  // Respawn at the hospital after death / arrest. Clears wanted level.
  respawn() {
    this.alive = true;
    this.health = this.maxHealth;
    HUD.setHealth(this.health);
    if (this.inCar && this.car) {
      this.car.visible = false;
      this.car = null;
    }
    this.inCar = false;
    this.speed = 0;
    this.person.visible = true;
    const hx = -City.BLOCK * 8, hz = -City.BLOCK * 8;
    const safe = City.resolveCollision(hx, hz, 1);
    this.person.position.set(safe.x, 0, safe.z);
    Police.resetWanted();
    HUD.setObjective("Respawning...");
  },

  // Show WASTED overlay, then respawn after delay.
  showWasted(fine) {
    const el = document.getElementById("overlay-wasted");
    const fineEl = document.getElementById("wasted-fine");
    fineEl.textContent = fine.toLocaleString();
    el.classList.remove("hidden");
    setTimeout(() => {
      el.classList.add("hidden");
      this.respawn();
    }, 2200);
  },

  // Show BUSTED overlay, then respawn after delay.
  showBusted(fine) {
    const el = document.getElementById("overlay-busted");
    const fineEl = document.getElementById("busted-fine");
    fineEl.textContent = fine.toLocaleString();
    el.classList.remove("hidden");
    setTimeout(() => {
      el.classList.add("hidden");
      this.respawn();
    }, 2200);
  },

  // Find a driveable car within reach while on foot.
  nearbyCar(list) {
    const px = this.person.position.x, pz = this.person.position.z;
    for (const car of list) {
      const dx = car.position.x - px, dz = car.position.z - pz;
      if (dx * dx + dz * dz < 9) return car;
    }
    return null;
  },

  // Drive a car: remove it from traffic (player takes control), hide person.
  enter(car) {
    this.inCar = true;
    this.car = car;
    if (car.userData) car.userData.active = false; // stop traffic AI on it
    this.yaw = car.rotation.y;
    this.speed = 0;
    this.person.visible = false;
    AudioFX.whoosh();
  },

  exit() {
    this.inCar = false;
    if (this.car) {
      this.yaw = this.car.rotation.y;
      const nx = Math.sin(-this.car.rotation.y);
      const nz = Math.cos(-this.car.rotation.y);
      this.person.position.set(this.car.position.x - nx * 2.2, 0, this.car.position.z - nz * 2.2);
      this.car = null;
    }
    this.speed = 0;
    this.person.visible = true;
    AudioFX.whoosh();
  },

  update(dt) {
    if (this.inCar) this._updateCar(dt);
    else this._updateFoot(dt);

    if (Mission.usedE) { // mission grabbed the E press this frame
      Mission.usedE = false;
      this._eLast = Input.any("KeyE", "Enter");
      return;
    }
    const e = Input.any("KeyE", "Enter");
    if (e && !this._eLast) {
      if (this.inCar) this.exit();
      else {
        const target = this.nearbyCar(Vehicle.cars);
        if (target) this.enter(target);
      }
    }
    this._eLast = e;
  },

  _updateFoot(dt) {
    const ax = Input.axisH();
    const az = Input.axisV();
    if (ax !== 0 || az !== 0) {
      const len = Math.sqrt(ax * ax + az * az) || 1;
      const nx = ax / len, nz = az / len;
      this.person.position.x += nx * this.footSpeed * dt;
      this.person.position.z += nz * this.footSpeed * dt;
      this.person.rotation.y = Math.atan2(nx, nz);
    }
    const res = City.resolveCollision(this.person.position.x, this.person.position.z, 0.4);
    this.person.position.x = res.x;
    this.person.position.z = res.z;
  },

  _updateCar(dt) {
    const throttle = Input.axisV();
    const steer = Input.axisH();
    const handbrake = Input.keys["Space"] === true;

    if (throttle > 0) {
      this.speed = Math.min(this.speed + this.accel * dt, this.maxSpeed);
    } else if (throttle < 0) {
      if (this.speed > 0.5) {
        this.speed = Math.max(this.speed - this.brake * dt, 0);
      } else {
        this.speed = Math.max(this.speed - this.accel * dt, this.maxReverse);
      }
    } else {
      if (Math.abs(this.speed) < 0.2) this.speed = 0;
      else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), this.coastDrag * dt);
    }

    if (handbrake) this.speed *= Math.max(0, 1 - 8 * dt);

    const dir = Math.sign(this.speed);
    this.yaw -= steer * this.turnRate * dt * dir * Math.min(1, Math.abs(this.speed) / 9 + 0.2);

    this.car.rotation.y = this.yaw;
    const move = this.speed * dt;
    this.car.position.x += Math.sin(-this.yaw) * move;
    this.car.position.z += Math.cos(-this.yaw) * move;

    // Particles: tire smoke on handbrake/braking
    if (handbrake && Math.abs(this.speed) > 3) {
      Particles.emitTireSmoke(this.car.position, this.yaw, this.speed);
    }

    // Particles: dust trail at high speed
    if (Math.abs(this.speed) > 10) {
      Particles.emitDust(this.car.position, this.yaw, this.speed);
    }

    // building collision with a small stick radius; lose speed on impact
    const before = this.speed;
    const res = City.resolveCollision(this.car.position.x, this.car.position.z, 1.0);
    if (res.x !== this.car.position.x || res.z !== this.car.position.z) {
      this.speed *= 0.35;
      const hit = Math.abs(before);
      if (hit > 7) {
        AudioFX.crash(Math.min(1, hit / 18));
        Game.shake = Math.max(Game.shake, Math.min(0.6, hit / 24));
        this.damage(hit * 0.6);

        // Particles: collision sparks
        const dx = this.car.position.x - res.x;
        const dz = this.car.position.z - res.z;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        Particles.emitSparks(this.car.position, { x: dx / len, z: dz / len });
      }
    }
    this.car.position.x = res.x;
    this.car.position.z = res.z;
  },

  // Position used by the camera.
  pos() {
    return this.inCar ? this.car.position : this.person.position;
  },
};