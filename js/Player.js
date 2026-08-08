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
  _vy: 0,
  _jumpHeld: false,

  spawn(x, z) {
    const g = new THREE.Group();

    const skinMat = new THREE.MeshLambertMaterial({ color: 0xffcc99 });
    const shirtMat = new THREE.MeshLambertMaterial({ color: 0x3366aa });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x333355 });
    const shoeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const hairMat = new THREE.MeshLambertMaterial({ color: 0x332211 });

    // Legs
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.9, 8), pantsMat);
    legL.position.set(-0.15, 0.45, 0);
    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.9, 8), pantsMat);
    legR.position.set(0.15, 0.45, 0);

    // Shoes
    const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.35), shoeMat);
    shoeL.position.set(-0.15, 0.06, 0.08);
    const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.35), shoeMat);
    shoeR.position.set(0.15, 0.06, 0.08);

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.35), shirtMat);
    torso.position.y = 1.2;

    // Arms
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.7, 6), shirtMat);
    armL.position.set(-0.4, 1.15, 0);
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.7, 6), shirtMat);
    armR.position.set(0.4, 1.15, 0);

    // Hands
    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), skinMat);
    handL.position.set(-0.4, 0.78, 0);
    const handR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), skinMat);
    handR.position.set(0.4, 0.78, 0);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skinMat);
    head.position.y = 1.8;

    // Hair
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.23, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    hair.position.y = 1.88;

    g.add(legL, legR, shoeL, shoeR, torso, armL, armR, handL, handR, head, hair);
    g.children.forEach(c => { c.castShadow = true; });
    g.position.set(x, 0, z);

    this.person = g;
    this.yaw = 0;
    this.health = this.maxHealth;
    this.alive = true;
    this._vy = 0;
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
    this._camHeading = 0; // drive straight into the screen
    this.speed = 0;
    this.person.visible = false;
    AudioFX.whoosh();

    // Add headlights/taillights if the car doesn't have them (traffic cars)
    if (!car.userData.headlights) {
      const headL = new THREE.SpotLight(0xfff0cc, 0, 22, 0.5, 0.6, 1.5);
      headL.position.set(-0.55, 0.6, 2.2);
      headL.target.position.set(-0.55, 0, 14);
      car.add(headL, headL.target);

      const headR = new THREE.SpotLight(0xfff0cc, 0, 22, 0.5, 0.6, 1.5);
      headR.position.set(0.55, 0.6, 2.2);
      headR.target.position.set(0.55, 0, 14);
      car.add(headR, headR.target);

      const tailL = new THREE.PointLight(0xff2222, 0, 6, 2);
      tailL.position.set(-0.55, 0.55, -2.2);
      car.add(tailL);
      const tailR = new THREE.PointLight(0xff2222, 0, 6, 2);
      tailR.position.set(0.55, 0.55, -2.2);
      car.add(tailR);

      car.userData.headlights = [headL, headR];
      car.userData.taillights = [tailL, tailR];
    }
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
    Characters.playAnim(this.person, "idle");
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
        const target = this.nearbyCar(Vehicle.cars) || this.nearbyCar(Vehicle.parked);
        if (target) this.enter(target);
      }
    }
    this._eLast = e;
  },

  _updateFoot(dt) {
    // Camera-relative movement: W goes where camera faces
    const camAngle = Game.orbitYaw;
    const fwdX = -Math.sin(camAngle);
    const fwdZ = Math.cos(camAngle);
    const rightX = -Math.cos(camAngle); // flip for correct left/right
    const rightZ = -Math.sin(camAngle);

    const inputV = Input.axisV(); // W=+1, S=-1
    const inputH = Input.axisH(); // D=+1, A=-1

    // Walk at 3x speed; sprint at 8x while holding Shift and moving forward
    const sprint = inputV > 0 && (Input.keys["ShiftLeft"] || Input.keys["ShiftRight"]);
    const spd = this.footSpeed * (sprint ? 8 : 3);

    const dx = (fwdX * inputV + rightX * inputH) * spd * dt;
    const dz = (fwdZ * inputV + rightZ * inputH) * spd * dt;

    this.person.position.x += dx;
    this.person.position.z += dz;

    if (inputV !== 0 || inputH !== 0) {
      this.person.rotation.y = Math.atan2(dx, dz);
    }

    const res = City.resolveCollision(this.person.position.x, this.person.position.z, 0.4);
    this.person.position.x = res.x;
    this.person.position.z = res.z;

    // Jump on SPACE (on foot).
    const jump = Input.any("Space");
    if (jump && !this._jumpHeld && this.person.position.y <= 0.01) {
      this._vy = 4.6;
    }
    this._jumpHeld = jump;
    if (this.person.position.y > 0 || this._vy > 0) {
      this._vy -= 12 * dt;
      this.person.position.y = Math.max(0, this.person.position.y + this._vy * dt);
      if (this.person.position.y <= 0.01 && this._vy < 0) {
        this.person.position.y = 0;
        this._vy = 0;
      }
    }

    // Animate: jump while airborne, run while moving, idle otherwise.
    const moving = inputV !== 0 || inputH !== 0;
    if (this.person.position.y > 0.01) Characters.playAnim(this.person, "jump");
    else if (moving) Characters.playAnim(this.person, "run", sprint ? 1.6 : 0.9 + Math.min(0.4, Math.hypot(inputV, inputH) * 0.4));
    else Characters.playAnim(this.person, "idle");
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

    // Camera-relative driving: W drives where the camera looks, S reverses,
    // A/D turn the car left/right on screen. Nose always points along travel.
    const o = Game.orbitYaw;
    const fwdX = -Math.sin(o), fwdZ = Math.cos(o);  // screen-forward (world)
    const rgtX = -Math.cos(o), rgtZ = -Math.sin(o); // screen-right (world)

    const dir = Math.sign(this.speed);
    const turn = steer * this.turnRate * dt * dir * Math.min(1, Math.abs(this.speed) / 9 + 0.2);
    this._camHeading = (this._camHeading || 0) + turn;

    const c = Math.cos(this._camHeading), s = Math.sin(this._camHeading);
    const vx = fwdX * c + rgtX * s;
    const vz = fwdZ * c + rgtZ * s;

    const move = this.speed * dt;
    this.car.position.x += vx * move;
    this.car.position.z += vz * move;

    this.yaw = this.speed >= 0 ? Math.atan2(-vx, vz) : Math.atan2(vx, -vz);
    this.car.rotation.y = this.yaw;

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