"use strict";

// Police — wanted level + cop car chases.
// Wanted stars grow from crimes (hitting peds/cars). Cops spawn at stations,
// chase the player, and arrest on contact. Stars decay when out of sight.

const Police = {
  scene: null,

  wanted: 0,          // continuous 0..5
  wantedTimer: 0,
  cops: [],           // active cop cars
  nextSpawnAt: 0,
  captureCooldown: 0,
  stationPos: null,

  // Called once when crime happens.
  reportCrime(amount) {
    this.wanted = Math.min(5, this.wanted + amount);
    this.wantedTimer = 6; // keeps stars from decaying right after a crime
  },

  get stars() {
    return Math.ceil(this.wanted);
  },

  init(scene) {
    this.scene = scene;
  },

  resetWanted() {
    this.wanted = 0;
    this.wantedTimer = 0;
    for (const c of this.cops) this.scene.remove(c);
    this.cops.length = 0;
  },

  // Player died or was busted: take a fine and respawn at the hospital.
  onKilled() {
    const fine = 150 * this.stars;
    Game.money = Math.max(0, Game.money - fine);
    HUD.setMoney(Game.money);
    this.resetWanted();
    Player.showWasted(fine);
  },

  // Spawn a police cruiser on a road, well away from the player.
  _spawnCop() {
    const px = Player.person.position.x, pz = Player.person.position.z;
    let r = null;
    for (let i = 0; i < 24; i++) {
      const cand = City.randomRoad();
      const dx = cand.x - px, dz = cand.z - pz;
      if (dx * dx + dz * dz > 8100 && dx * dx + dz * dz < 810000) { r = cand; break; }
    }
    if (!r) r = City.randomRoad();
    const car = Vehicle.buildCar(0x1b1b25, false, true); // black, with lights
    car.position.set(r.x, 0, r.z);
    car.rotation.y = 0;
    car.userData = {
      active: false, // not traffic
      speed: 14,
      yaw: 0,
      turn: 0,
    };

    // Lightbar
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 0.4, metalness: 0.5 }));
    bar.position.y = 1.38;
    const barL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x0055ff, emissiveIntensity: 2 }));
    const barR = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff0000, emissiveIntensity: 2 }));
    barL.position.x = -0.22; barL.position.y = 0.06;
    barR.position.x = 0.22; barR.position.y = 0.06;
    bar.add(barL, barR);
    car.add(bar);
    car.userData.barL = barL;
    car.userData.barR = barR;

    this.scene.add(car);
    this.cops.push(car);
  },

  // Called ~every frame with the player's world position.
  update(dt, px, pz) {
    // stars decay slowly when the player isn't seen for a while
    this.wantedTimer -= dt;
    if (this.wantedTimer <= 0) this.wanted = Math.max(0, this.wanted - 0.12 * dt);

    // maintain cop count roughly proportional to stars
    const desire = Math.min(3, Math.ceil(this.wanted * 0.9));
    while (this.cops.length < desire) this._spawnCop();

    const stars = this.stars;

    for (const cop of this.cops) {
      const u = cop.userData;
      u.barL.material.emissiveIntensity = Math.sin(Game.time * 14) > 0 ? 3 : 0.2;
      u.barR.material.emissiveIntensity = Math.sin(Game.time * 14) > 0 ? 0.2 : 3;

      // Left the area: cops stop, then dissolve once comfortably far away.
      if (stars <= 0) {
        u.speed = Math.max(0, u.speed - 30 * dt);
        cop.position.x += Math.sin(-u.yaw) * u.speed * dt;
        cop.position.z += Math.cos(-u.yaw) * u.speed * dt;
        const dx = cop.position.x - px, dz = cop.position.z - pz;
        if (dx * dx + dz * dz > 360000) {
          this.scene.remove(cop);
          u.remove = true;
        }
        continue;
      }

      // chase the player
      this._driveToward(cop, px, pz, 15 + stars * 1.2, dt);

      // capture if the cop touches the player
      const d2 = (cop.position.x - px) * (cop.position.x - px) + (cop.position.z - pz) * (cop.position.z - pz);
      if (d2 < 2.7 && this.captureCooldown <= 0 && Player.alive) {
        this.captureCooldown = 1.5;
        Player.damage(45);
      }
    }
    this.captureCooldown = Math.max(0, this.captureCooldown - dt);
    this.cops = this.cops.filter(c => !c.userData.remove);
    HUD.setWanted(stars);
  },

  // Simple chase steering: turn to face target, accelerate along facing.
  _driveToward(car, tx, tz, targetSpeed, dt) {
    const u = car.userData;
    const dx = tx - car.position.x;
    const dz = tz - car.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 1.2) {
      u.speed = Math.max(0, u.speed - 20 * dt);
    } else {
      // desired heading
      const desired = Math.atan2(-dx, -dz);
      // wrap difference and steer
      let diff = desired - u.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turnSpeed = 2.6 * dt;
      u.yaw += Math.max(-turnSpeed, Math.min(turnSpeed, diff));
      u.speed += (targetSpeed - u.speed) * 1.5 * dt;
      u.speed = Math.max(0, Math.min(targetSpeed + 4, u.speed));
    }

    car.rotation.y = u.yaw;
    car.position.x += Math.sin(-u.yaw) * u.speed * dt;
    car.position.z += Math.cos(-u.yaw) * u.speed * dt;

    // keep cops out of buildings (cheap: stop if inside)
    if (CarInBuilding(car)) {
      car.position.x -= Math.sin(-u.yaw) * u.speed * dt;
      car.position.z -= Math.cos(-u.yaw) * u.speed * dt;
      u.speed = 0;
      u.yaw += (Math.random() - 0.5) * 0.6;
    }
  },
};

// helper for cop building avoidance
function CarInBuilding(car) {
  for (const b of City.buildings) {
    const dx = Math.abs(car.position.x - b.x) - b.hw;
    const dz = Math.abs(car.position.z - b.z) - b.hd;
    if (dx < 0.8 && dz < 0.8) return true;
  }
  return false;
}