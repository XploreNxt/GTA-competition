"use strict";

// Modern City — 2x2 km map with main straight road, loop roads,
// modern buildings and houses.

const City = {
  MAP_SIZE: 2000,
  ROAD_WIDTH: 12,
  BLOCK: 70,
  roadSpan: 2000, // traffic/peds wrap at half this
  ROAD_W: 12,     // legacy alias (HUD / peds)
  SIDEWALK: 4,    // sidewalk width
  EXTENT: 14,     // blocks per half-map

  scene: null,
  groundY: 0,
  buildings: [],
  roadPaths: [],

  init(scene, onReady) {
    this.scene = scene;
    this._build();
    if (onReady) onReady();
  },

  _build() {
    this._buildGround();
    this._buildRoadNetwork();
    this._placeBuildings();
    this._placeHouses();
    this._placeWatchTower();
    this._buildStreetlights();
    console.log("City built:", this.buildings.length, "buildings");
  },

  _buildGround() {
    const grassMat = new THREE.MeshLambertMaterial({ color: 0x3d6b32 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(this.MAP_SIZE, this.MAP_SIZE), grassMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  },

  _buildRoadNetwork() {
    const half = this.MAP_SIZE / 2;
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffdd00 });
    const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0x999999 });

    // Main road along X
    const mainRoad = new THREE.Mesh(new THREE.PlaneGeometry(this.MAP_SIZE, this.ROAD_WIDTH), roadMat);
    mainRoad.rotation.x = -Math.PI / 2;
    mainRoad.position.set(0, 0.05, 0);
    this.scene.add(mainRoad);

    // Center line
    const centerLine = new THREE.Mesh(new THREE.PlaneGeometry(this.MAP_SIZE, 0.4), lineMat);
    centerLine.rotation.x = -Math.PI / 2;
    centerLine.position.set(0, 0.07, 0);
    this.scene.add(centerLine);

    // Sidewalks along main road
    const sw = 4;
    const sidewalkN = new THREE.Mesh(new THREE.PlaneGeometry(this.MAP_SIZE, sw), sidewalkMat);
    sidewalkN.rotation.x = -Math.PI / 2;
    sidewalkN.position.set(0, 0.06, this.ROAD_WIDTH / 2 + sw / 2);
    this.scene.add(sidewalkN);

    const sidewalkS = new THREE.Mesh(new THREE.PlaneGeometry(this.MAP_SIZE, sw), sidewalkMat);
    sidewalkS.rotation.x = -Math.PI / 2;
    sidewalkS.position.set(0, 0.06, -this.ROAD_WIDTH / 2 - sw / 2);
    this.scene.add(sidewalkS);

    // Loop roads
    const loopZ = 350;
    const loopW = 8;

    for (const z of [loopZ, -loopZ]) {
      const loopRoad = new THREE.Mesh(new THREE.PlaneGeometry(this.MAP_SIZE, loopW), roadMat);
      loopRoad.rotation.x = -Math.PI / 2;
      loopRoad.position.set(0, 0.05, z);
      this.scene.add(loopRoad);
    }

    // Connecting roads at ends
    for (const x of [-half + 150, half - 150]) {
      const conn = new THREE.Mesh(new THREE.PlaneGeometry(loopW, loopZ * 2), roadMat);
      conn.rotation.x = -Math.PI / 2;
      conn.position.set(x, 0.05, 0);
      this.scene.add(conn);
    }

    // Road paths for AI
    this.roadPaths = [
      { x1: -half, z1: 0, x2: half, z2: 0, w: this.ROAD_WIDTH },
      { x1: -half, z1: loopZ, x2: half, z2: loopZ, w: loopW },
      { x1: -half, z1: -loopZ, x2: half, z2: -loopZ, w: loopW },
    ];
  },

  _placeBuildings() {
    const half = this.MAP_SIZE / 2;
    const margin = 25;

    // Modern building colors
    const colors = [0x4a6d8c, 0x6b8cae, 0x3d5a7a, 0x8ca4b8, 0x5a7a9a, 0x2d4a6a, 0x7a9ac0];

    // Place buildings along main road
    for (let x = -half + 40; x < half - 40; x += 60) {
      // North side
      this._addModernBuilding(x + Math.random() * 10, this.ROAD_WIDTH / 2 + margin + 10 + Math.random() * 30, colors);
      // South side
      this._addModernBuilding(x + Math.random() * 10, -this.ROAD_WIDTH / 2 - margin - 10 - Math.random() * 30, colors);
    }

    // Place buildings along loop roads
    for (let x = -half + 40; x < half - 40; x += 80) {
      for (const z of [350, -350]) {
        this._addModernBuilding(x, z + 20 + Math.random() * 20, colors);
        this._addModernBuilding(x, z - 20 - Math.random() * 20, colors);
      }
    }
  },

  _addModernBuilding(x, z, colors) {
    const group = new THREE.Group();

    // Main tower
    const w = 12 + Math.random() * 10;
    const d = 12 + Math.random() * 10;
    const h = 25 + Math.random() * 50;
    const color = colors[Math.floor(Math.random() * colors.length)];

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color })
    );
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);

    // Windows (lighter strips)
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xaaddff });
    const rows = Math.floor(h / 8);
    for (let r = 0; r < rows; r++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 2, d * 0.05), windowMat);
      win.position.set(0, 4 + r * 8, d / 2 + 0.1);
      group.add(win);
      const win2 = win.clone();
      win2.position.z = -d / 2 - 0.1;
      group.add(win2);
    }

    // Roof detail
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.3, 3, d * 0.3),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    roof.position.y = h + 1.5;
    group.add(roof);

    group.position.set(x, 0, z);
    group.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(group);

    this.buildings.push({ x, z, hw: w / 2 + 2, hd: d / 2 + 2, h });
  },

  _placeHouses() {
    const half = this.MAP_SIZE / 2;
    const colors = [0xd4a574, 0xc4956a, 0xe8c49a, 0xb8845a, 0xdab48a];

    // Houses set back from roads
    for (let x = -half + 60; x < half - 60; x += 100) {
      // Far north
      this._addHouse(x + Math.random() * 20, this.ROAD_WIDTH / 2 + 80 + Math.random() * 40, colors);
      // Far south
      this._addHouse(x + Math.random() * 20, -this.ROAD_WIDTH / 2 - 80 - Math.random() * 40, colors);
    }
  },

  _addHouse(x, z, colors) {
    const group = new THREE.Group();

    // Main body
    const w = 10 + Math.random() * 6;
    const d = 8 + Math.random() * 6;
    const h = 5 + Math.random() * 3;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: colors[Math.floor(Math.random() * colors.length)] })
    );
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);

    // Roof
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(w * 0.7, 3, 4),
      new THREE.MeshLambertMaterial({ color: 0x8b4513 })
    );
    roof.position.y = h + 1.5;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);

    // Door
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 2.5, 0.1),
      new THREE.MeshLambertMaterial({ color: 0x4a3520 })
    );
    door.position.set(0, 1.25, d / 2 + 0.05);
    group.add(door);

    group.position.set(x, 0, z);
    group.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(group);

    this.buildings.push({ x, z, hw: w / 2 + 1, hd: d / 2 + 1, h });
  },

  _placeWatchTower() {
    const group = new THREE.Group();
    const tx = 200;
    const tz = 600;

    // Legs
    const legMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 25, 6), legMat);
      leg.position.set(Math.cos(angle) * 2, 12.5, Math.sin(angle) * 2);
      group.add(leg);
    }

    // Platform
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.5, 8), legMat);
    platform.position.y = 25;
    group.add(platform);

    // Railing
    const railMat = new THREE.MeshLambertMaterial({ color: 0x654321 });
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2, 4), railMat);
      rail.position.set(Math.cos(angle) * 4, 26, Math.sin(angle) * 4);
      group.add(rail);
    }

    // Top
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5, 4, 8), new THREE.MeshLambertMaterial({ color: 0x8B0000 }));
    roof.position.y = 28;
    group.add(roof);

    group.position.set(tx, 0, tz);
    this.scene.add(group);

    this.buildings.push({ x: tx, z: tz, hw: 5, hd: 5, h: 30 });
  },

  _buildStreetlights() {
    const half = this.MAP_SIZE / 2;

    for (let x = -half + 50; x < half; x += 70) {
      this._addStreetlight(x, this.ROAD_WIDTH / 2 + 5);
      this._addStreetlight(x, -this.ROAD_WIDTH / 2 - 5);
    }
  },

  _addStreetlight(x, z) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.15, 7, 6),
      new THREE.MeshLambertMaterial({ color: 0x444444 })
    );
    pole.position.set(x, 3.5, z);
    this.scene.add(pole);

    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 1.5, 4),
      new THREE.MeshLambertMaterial({ color: 0x444444 })
    );
    arm.rotation.z = Math.PI / 2;
    arm.position.set(x + 0.7, 7, z);
    this.scene.add(arm);

    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xffffcc })
    );
    lamp.position.set(x + 1.4, 6.9, z);
    this.scene.add(lamp);
  },

  setStreetlights(nightAmount) {
    // Handled by materials
  },

  onRoad(x, z) {
    const half = this.MAP_SIZE / 2;
    if (Math.abs(z) < this.ROAD_WIDTH / 2 + 2) return true;
    if (Math.abs(Math.abs(z) - 350) < 6) return true;
    if (Math.abs(x - (-half + 150)) < 6 || Math.abs(x - (half - 150)) < 6) {
      if (Math.abs(z) < 350) return true;
    }
    return false;
  },

  randomRoad() {
    const roads = this.roadPaths;
    const r = roads[Math.floor(Math.random() * roads.length)];
    const t = Math.random();
    const horizontal = r.z1 === r.z2;
    const dir = Math.random() > 0.5 ? 1 : -1;
    return {
      x: r.x1 + (r.x2 - r.x1) * t,
      z: r.z1 + (r.z2 - r.z1) * t,
      horizontal,
      dir,
      lane: (dir * r.w) / 4, // right-hand lane offset (along Z for horizontal roads)
    };
  },

  resolveCollision(x, z, r) {
    for (let iter = 0; iter < 2; iter++) {
      let pushed = false;
      for (const b of this.buildings) {
        const dx = x - b.x;
        const dz = z - b.z;
        const hw = b.hw + r;
        const hd = b.hd + r;
        if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
          const px = hw - Math.abs(dx);
          const pz = hd - Math.abs(dz);
          if (px < pz) x += Math.sign(dx) * px;
          else z += Math.sign(dz) * pz;
          pushed = true;
          break;
        }
      }
      if (!pushed) break;
    }
    return { x, z };
  },
};
