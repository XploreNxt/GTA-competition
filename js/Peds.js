"use strict";

// Peds — sidewalk pedestrians. They wander lanes, flee from the player's
// car, and get knocked back when hit. Visually cheap: shared parts, few mats.

const Peds = {
  list: [],
  scene: null,
  count: 34,

  // Reusable visuals
  _parts: null,

  _rand() {
    const x = Math.sin(this._seed++ * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  },
  _seed: 1,

  init(scene) {
    this.scene = scene;
    // shared parts
    const bodyGeo = new THREE.CylinderGeometry(0.22, 0.26, 0.6, 8);
    const headGeo = new THREE.SphereGeometry(0.2, 8, 6);
    const shGeos = { body: bodyGeo, head: headGeo };
    this._parts = shGeos;

    // shirt palette
    this.shirtColors = [0xd64545, 0x4a7abb, 0x2f9e44, 0xd9b23f, 0x8b5fd0, 0xe8e8e8, 0x333333, 0xc26a2a];
    this.skinColors = [0xd9a066, 0xc98d5f, 0xb97a4d, 0x8a5f3d, 0xf2c79a];
  },

  spawn(nTotal) {
    for (let i = 0; i < nTotal; i++) this._spawnOne();
  },

  _spawnOne() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.shirtColors[Math.floor(Math.random() * this.shirtColors.length)],
      roughness: 0.85,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: this.skinColors[Math.floor(Math.random() * this.skinColors.length)],
      roughness: 0.8,
    });
    const body = new THREE.Mesh(this._parts.body, bodyMat);
    body.position.y = 1.05;
    body.castShadow = true;
    const head = new THREE.Mesh(this._parts.head, skinMat);
    head.position.y = 1.5;
    head.castShadow = true;
    g.add(body, head);

    // Pick a valid sidewalk lane + direction.
    const lane = this._randomLane();
    g.position.set(lane.x, 0, lane.z);
    g.userData = {
      speed: 1.2 + Math.random() * 1.4,
      axis: lane.axis,       // 'x' or 'z'
      dir: lane.dir,
      lane: lane.lane,       // fixed perpendicular coordinate
      turnTimer: 2 + Math.random() * 6, // when to consider turning
      kb: 0,                 // knock-back impulse magnitude
      kbx: { x: 0, z: 0 },
      panic: 0,              // seconds of fleeing
    };
    this.scene.add(g);
    this.list.push(g);
  },

  // A random sidewalk lane line across the map.
  _randomLane() {
    const blk = City.BLOCK, half = City.ROAD_W / 2, sw = City.SIDEWALK;
    const inset = half + sw / 2;
    const n = City.EXTENT;
    const axis = Math.random() > 0.5 ? 1 : 0; // 1 = walk along X (fixed z)
    const side = Math.random() > 0.5 ? 1 : -1;
    const i = Math.floor(Math.random() * (n * 2)) - n;
    const lanePos = (i + 0.5) * blk + side * inset;
    const t = (Math.random() - 0.5) * City.roadSpan;
    return {
      axis,
      dir: Math.random() > 0.5 ? 1 : -1,
      lane: lanePos,
      x: axis ? t : lanePos,
      z: axis ? lanePos : t,
    };
  },

  update(dt, playerPos, playerInCar) {
    const span = City.roadSpan;
    const hSpan = span / 2;

    for (const ped of this.list) {
      const p = ped.userData;
      const dx = playerPos.x - ped.position.x;
      const dz = playerPos.z - ped.position.z;
      const distSq = dx * dx + dz * dz;

      // Panic when the player is near and moving (in a car).
      const threat = playerInCar && distSq < 49;
      if (threat) p.panic = 0.4;

      if (p.kb > 0) {
        // knock-back flight
        ped.position.x += p.kbx.x * p.kb * dt * 14;
        ped.position.z += p.kbx.z * p.kb * dt * 14;
        p.kb *= Math.max(0, 1 - 9 * dt);
        ped.rotation.z = p.kb * 1.2; // tumble feel
        continue;
      }

      // panic flee: run away from the player, ignore lane turns
      if (p.panic > 0) {
        p.panic -= dt;
        const d = Math.sqrt(distSq) || 1;
        ped.position.x -= (dx / d) * 4.6 * dt;
        ped.position.z -= (dz / d) * 4.6 * dt;
        ped.rotation.y = Math.atan2(dx, dz);
      } else {
        // wander along the lane
        const move = p.speed * dt;
        if (p.axis === 1) {
          ped.position.x += p.dir * move;
          if (ped.position.x > hSpan) { ped.position.x = -hSpan; ped.position.z = p.lane; }
          if (ped.position.x < -hSpan) { ped.position.x = hSpan; ped.position.z = p.lane; }
        } else {
          ped.position.z += p.dir * move;
          if (ped.position.z > hSpan) { ped.position.z = -hSpan; ped.position.x = p.lane; }
          if (ped.position.z < -hSpan) { ped.position.z = hSpan; ped.position.x = p.lane; }
        }
        ped.rotation.y = p.axis === 1 ? (p.dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);

        // occasionally turn onto another lane
        p.turnTimer -= dt;
        if (p.turnTimer <= 0) {
          p.turnTimer = 3 + Math.random() * 6;
          if (Math.random() < 0.4) {
            const nl = this._randomLane();
            if (Math.abs(nl.axis - p.axis) < 0.01 || Math.random() < 0.5) {
              // switch to new lane at current position
              p.axis = nl.axis;
              p.dir = nl.dir;
              p.lane = nl.lane;
            } else {
              p.dir = -p.dir;
            }
          }
        }
      }

      // Knock-back when the player touches a ped (foot or car).
      if (distSq < 1.4 && p.kb <= 0) {
        const d = Math.hypot(dx, dz) || 1;
        p.kb = 1;
        p.kbx.x = dx / d;
        p.kbx.z = dz / d;
      }
    }
  },
};