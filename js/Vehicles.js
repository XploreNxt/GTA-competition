"use strict";

// Vehicle — shared car factory for the player + traffic AI fleet.

const Vehicle = {
  scene: null,

  // Shared geometries so many cars stay cheap.
  _geo: null,

  init(scene) {
    this.scene = scene;
  },

  _geos() {
    if (this._geo) return this._geo;
    const g = {
      body: new THREE.BoxGeometry(1.72, 0.4, 3.6),
      box: new THREE.BoxGeometry(1.56, 0.16, 0.9),
      wheel: new THREE.CylinderGeometry(0.34, 0.34, 0.26, 16),
      rim: new THREE.CylinderGeometry(0.18, 0.18, 0.28, 8),
      light: new THREE.BoxGeometry(0.34, 0.13, 0.1),
      tail: new THREE.BoxGeometry(0.4, 0.12, 0.1),
      windshield: new THREE.BoxGeometry(1.5, 0.11, 1.5),
    };
    this._geo = g;
    return g;
  },

  _mats(color) {
    return {
      paint: new THREE.MeshPhysicalMaterial({ color, metalness: 0.85, roughness: 0.22, clearcoat: 1.0, clearcoatRoughness: 0.1 }),
      paintDark: new THREE.MeshPhysicalMaterial({ color: 0x9c1818, metalness: 0.85, roughness: 0.3, clearcoat: 0.8 }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0x13181f, metalness: 0.1, roughness: 0.08, clearcoat: 0.7, transparent: true, opacity: 0.9 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0xcfd8e3, metalness: 1, roughness: 0.12 }),
      tire: new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.9 }),
      grill: new THREE.MeshStandardMaterial({ color: 0x1c1e20, metalness: 0.8, roughness: 0.4 }),
      lightW: new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff0c8, emissiveIntensity: 2.4 }),
      lightR: new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2020, emissiveIntensity: 1.4 }),
    };
  },

  // Build a car group. Returns the group with a .speed hint (for traffic).
  buildCar(color, onRoad) {
    const g = new THREE.Group();
    const geos = this._geos();
    const m = this._mats(color);
    const rnd = Math.random();

    const body = new THREE.Mesh(geos.body, m.paint);
    body.position.y = 0.6;
    body.castShadow = true;

    const hood = new THREE.Mesh(geos.box, m.paintDark);
    hood.position.set(0, 0.82, 1.35);
    const trunk = new THREE.Mesh(geos.box, m.paintDark);
    trunk.position.set(0, 0.82, -1.3);

    const cabin = new THREE.Mesh(new THREE.SphereGeometry(0.95, 10, 8), m.glass);
    cabin.position.set(0, 0.95, 0.0);
    cabin.scale.set(0.82, 0.5, 1.0);

    const windshield = new THREE.Mesh(geos.windshield, m.glass);
    windshield.position.set(0, 1.1, -0.05);
    windshield.rotation.x = -0.28;

    const hlL = new THREE.Mesh(geos.light, m.lightW);
    hlL.position.set(-0.45, 0.66, 1.81);
    const hlR = new THREE.Mesh(geos.light, m.lightW);
    hlR.position.set(0.45, 0.66, 1.81);
    const tlL = new THREE.Mesh(geos.tail, m.lightR);
    tlL.position.set(-0.52, 0.66, -1.81);
    const tlR = new THREE.Mesh(geos.tail, m.lightR);
    tlR.position.set(0.52, 0.66, -1.81);

    const mkWheel = (x, z) => {
      const w = new THREE.Group();
      const t = new THREE.Mesh(geos.wheel, m.tire);
      t.rotation.x = Math.PI / 2;
      const rim = new THREE.Mesh(geos.rim, m.chrome);
      rim.rotation.x = Math.PI / 2;
      w.add(t, rim);
      w.position.set(x, 0.34, z);
      return w;
    };

    g.add(body, hood, trunk, cabin, windshield, hlL, hlR, tlL, tlR,
      mkWheel(-0.85, 1.1), mkWheel(0.85, 1.1), mkWheel(-0.85, -1.1), mkWheel(0.85, -1.1));

    this.scene.add(g);
    return g;
  },

  // ---------- Traffic ----------
  cars: [],

  spawnTraffic(count) {
    const palette = [0x2c6fbb, 0x2f9e44, 0xe0d94f, 0xf2f2f2, 0x8b2fc9, 0xc95a2f, 0x2a2a2a, 0x6fb7a5];
    for (let i = 0; i < count; i++) {
      const r = City.randomRoad();
      const car = this.buildCar(palette[i % palette.length]);
      car.position.set(r.x, 0, r.z);
      if (r.horizontal) {
        car.rotation.y = r.dir > 0 ? Math.PI : 0; // drive +X or -X
      } else {
        car.rotation.y = r.dir > 0 ? Math.PI / 2 : -Math.PI / 2; // drive +Z or -Z
      }
      car.userData = {
        horizontal: r.horizontal,
        dir: r.dir,
        speed: 10 + Math.random() * 6,
      };
      this.cars.push(car);
    }
  },

  // Drive all traffic cars straight along their road, wrap at world edges.
  updateTraffic(dt) {
    const span = City.roadSpan;
    const half = span / 2;
    for (const car of this.cars) {
      if (car.userData.active === false) continue; // player took control
      const d = car.userData;
      const move = d.speed * dt;
      if (d.horizontal) {
        car.position.x += d.dir * move;
        if (car.position.x > half + 20) car.position.x = -half;
        if (car.position.x < -half - 20) car.position.x = half;
      } else {
        car.position.z += d.dir * move;
        if (car.position.z > half + 20) car.position.z = -half;
        if (car.position.z < -half - 20) car.position.z = half;
      }
    }
  },
};