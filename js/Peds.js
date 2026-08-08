"use strict";

// Peds — sidewalk pedestrians. They wander lanes, flee from the player's
// car, and get knocked back when hit. Full skinned characters + animations.

const Peds = {
  list: [],
  scene: null,
  count: 34,
  _hits: 0, // peds struck by the player this frame (read by Game for crimes)

  _rand() {
    const x = Math.sin(this._seed++ * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  },
  _seed: 1,

  init(scene) {
    this.scene = scene;
  },

  spawn(nTotal) {
    for (let i = 0; i < nTotal; i++) this._spawnOne();
  },

  _spawnOne() {
    const g = Characters.make(Math.floor(Math.random() * Characters.skinCount()));
    Characters.track(g);
    Characters.playAnim(g, "idle");

    // Pick a valid sidewalk lane + direction.
    const lane = this._randomLane();
    g.position.set(lane.x, 0, lane.z);
    Object.assign(g.userData, {
      speed: 1.2 + Math.random() * 1.4,
      axis: lane.axis,       // 'x' or 'z'
      dir: lane.dir,
      lane: lane.lane,       // fixed perpendicular coordinate
      turnTimer: 2 + Math.random() * 6, // when to consider turning
      kb: 0,                 // knock-back impulse magnitude
      kbx: { x: 0, z: 0 },
      panic: 0,              // seconds of fleeing
    });
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
    this._pedAccum = (this._pedAccum || 0) + dt;
    if (this._pedAccum < 0.066) return; // ~15fps for peds
    dt = this._pedAccum;
    this._pedAccum = 0;

    const span = City.roadSpan;
    const hSpan = span / 2;

    // Skip far peds
    const camX = playerPos.x, camZ = playerPos.z;

    for (const ped of this.list) {
      const p = ped.userData;
      const dx = playerPos.x - ped.position.x;
      const dz = playerPos.z - ped.position.z;
      const distSq = dx * dx + dz * dz;

      // Skip far-away peds (no need to update AI)
      if (distSq > 2500) { // 50m distance
        ped.visible = false;
        continue;
      }
      ped.visible = true;

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
        Characters.playAnim(ped, "run", 1.35);
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
        Characters.playAnim(ped, "run", 0.45 + p.speed * 0.2);

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
        this._hits++;
      }
    }
  },
};