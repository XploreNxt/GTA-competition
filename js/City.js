"use strict";

// Modern City — 2x2 km map with main straight road, loop roads,
// modern buildings and houses loaded from FBX assets.

const City = {
  MAP_SIZE: 2000,       // 2km x 2km
  ROAD_WIDTH: 12,       // main road width
  SIDEWALK: 3,
  BLOCK: 80,            // spacing between buildings

  scene: null,
  groundY: 0,
  buildings: [],        // AABBs for collision
  roadPaths: [],        // road centerline points for AI

  // Loaded models
  buildingModel: null,
  houseModel: null,
  roadModel: null,
  towerModel: null,

  // Load FBX assets then build
  init(scene, onReady) {
    this.scene = scene;
    let pending = 4;
    const done = () => {
      pending--;
      if (pending <= 0) {
        this._build();
        if (onReady) onReady();
      }
    };

    const loader = new THREE.FBXLoader();
    loader.load("Assets/buildings/building_04.fbx", (m) => { this.buildingModel = m; done(); }, undefined, () => { console.warn("building load failed, using fallback"); done(); });
    loader.load("Assets/characters/characterMedium.fbx", (m) => { this.houseModel = m; done(); }, undefined, () => { console.warn("house load failed, using fallback"); done(); });
    loader.load("Assets/road/road.fbx", (m) => { this.roadModel = m; done(); }, undefined, () => { console.warn("road load failed, using fallback"); done(); });
    loader.load("Assets/characters/characterMedium.fbx", (m) => { this.towerModel = m; done(); }, undefined, () => { console.warn("tower load failed, using fallback"); done(); });
  },

  _build() {
    this._buildGround();
    this._buildRoadNetwork();
    this._placeBuildings();
    this._placeWatchTower();
    this._buildStreetlights();
  },

  _buildGround() {
    const half = this.MAP_SIZE / 2;
    const grassMat = new THREE.MeshLambertMaterial({ color: 0x4a7a3a });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(this.MAP_SIZE, this.MAP_SIZE), grassMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  },

  _buildRoadNetwork() {
    const half = this.MAP_SIZE / 2;
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });

    // Main straight road along X axis (z=0)
    const mainRoad = new THREE.Mesh(
      new THREE.PlaneGeometry(this.MAP_SIZE, this.ROAD_WIDTH),
      roadMat
    );
    mainRoad.rotation.x = -Math.PI / 2;
    mainRoad.position.set(0, 0.02, 0);
    this.scene.add(mainRoad);

    // Center line
    const centerLine = new THREE.Mesh(
      new THREE.PlaneGeometry(this.MAP_SIZE, 0.3),
      lineMat
    );
    centerLine.rotation.x = -Math.PI / 2;
    centerLine.position.set(0, 0.03, 0);
    this.scene.add(centerLine);

    // Loop roads — two parallel roads at z=±400 that curve back
    const loopZ = 400;
    const loopW = 8;

    // North loop road
    const northRoad = new THREE.Mesh(
      new THREE.PlaneGeometry(this.MAP_SIZE, loopW),
      roadMat
    );
    northRoad.rotation.x = -Math.PI / 2;
    northRoad.position.set(0, 0.02, loopZ);
    this.scene.add(northRoad);

    // South loop road
    const southRoad = new THREE.Mesh(
      new THREE.PlaneGeometry(this.MAP_SIZE, loopW),
      roadMat
    );
    southRoad.rotation.x = -Math.PI / 2;
    southRoad.position.set(0, 0.02, -loopZ);
    this.scene.add(southRoad);

    // Connecting roads (north loop to main)
    const connectN = new THREE.Mesh(
      new THREE.PlaneGeometry(loopW, loopZ * 2),
      roadMat
    );
    connectN.rotation.x = -Math.PI / 2;
    connectN.position.set(-half + 200, 0.02, 0);
    this.scene.add(connectN);

    const connectN2 = new THREE.Mesh(
      new THREE.PlaneGeometry(loopW, loopZ * 2),
      roadMat
    );
    connectN2.rotation.x = -Math.PI / 2;
    connectN2.position.set(half - 200, 0.02, 0);
    this.scene.add(connectN2);

    // Road paths for AI
    this.roadPaths = [
      { x1: -half, z1: 0, x2: half, z2: 0 },           // main
      { x1: -half, z1: loopZ, x2: half, z2: loopZ },   // north loop
      { x1: -half, z1: -loopZ, x2: half, z2: -loopZ }, // south loop
    ];
  },

  _placeBuildings() {
    const half = this.MAP_SIZE / 2;
    const margin = 30;  // distance from road edge
    const spacing = 50;  // space between buildings

    // Place buildings along both sides of main road
    for (let x = -half + margin; x < half - margin; x += spacing) {
      // North side of main road
      this._addBuilding(x, this.ROAD_WIDTH / 2 + margin + Math.random() * 20);
      // South side of main road
      this._addBuilding(x, -this.ROAD_WIDTH / 2 - margin - Math.random() * 20);
    }

    // Place buildings along loop roads
    for (let x = -half + margin; x < half - margin; x += spacing * 1.5) {
      this._addBuilding(x, 400 + this.ROAD_WIDTH / 2 + margin);
      this._addBuilding(x, 400 - this.ROAD_WIDTH / 2 - margin);
      this._addBuilding(x, -400 + this.ROAD_WIDTH / 2 + margin);
      this._addBuilding(x, -400 - this.ROAD_WIDTH / 2 - margin);
    }
  },

  _addBuilding(x, z) {
    let model;
    if (this.buildingModel) {
      model = this.buildingModel.clone();
      // Scale building to reasonable size
      const s = 0.8 + Math.random() * 0.6;
      model.scale.set(s, s, s);
    } else {
      // Fallback: modern box building
      const w = 15 + Math.random() * 15;
      const h = 20 + Math.random() * 40;
      const d = 15 + Math.random() * 15;
      const colors = [0x8899aa, 0x667788, 0x99aabb, 0x556677, 0xaabbcc];
      const mat = new THREE.MeshLambertMaterial({ color: colors[Math.floor(Math.random() * colors.length)] });
      model = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      model.castShadow = true;
      this.buildings.push({ x, z, hw: w / 2, hd: d / 2, h });
    }

    model.position.set(x, 0, z);
    model.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(model);
  },

  _placeWatchTower() {
    // Place watch tower at a landmark location
    const tx = 0;
    const tz = 600;

    if (this.towerModel) {
      const tower = this.towerModel.clone();
      tower.scale.set(3, 3, 3);
      tower.position.set(tx, 0, tz);
      this.scene.add(tower);
    } else {
      // Fallback tower
      const towerMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 30, 8), towerMat);
      tower.position.set(tx, 15, tz);
      tower.castShadow = true;
      this.scene.add(tower);

      const platform = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 8), towerMat);
      platform.position.set(tx, 30, tz);
      this.scene.add(platform);
    }

    this.buildings.push({ x: tx, z: tz, hw: 5, hd: 5, h: 30 });
  },

  _buildStreetlights() {
    const half = this.MAP_SIZE / 2;
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x444444 });

    // Streetlights along main road
    for (let x = -half + 40; x < half; x += 60) {
      // North side
      this._addStreetlight(x, this.ROAD_WIDTH / 2 + 3);
      // South side
      this._addStreetlight(x, -this.ROAD_WIDTH / 2 - 3);
    }
  },

  _addStreetlight(x, z) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.15, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0x555555 })
    );
    pole.position.set(x, 3, z);
    this.scene.add(pole);

    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xffffaa })
    );
    lamp.position.set(x, 6.2, z);
    this.scene.add(lamp);
  },

  setStreetlights(nightAmount) {
    // Simple toggle for night lights
  },

  onRoad(x, z) {
    // Check if point is on any road
    const half = this.MAP_SIZE / 2;
    // Main road
    if (Math.abs(z) < this.ROAD_WIDTH / 2) return true;
    // Loop roads
    if (Math.abs(Math.abs(z) - 400) < 4) return true;
    // Connecting roads
    if (Math.abs(x - (-half + 200)) < 4 || Math.abs(x - (half - 200)) < 4) {
      if (Math.abs(z) < 400) return true;
    }
    return false;
  },

  randomRoad() {
    const half = this.MAP_SIZE / 2;
    const roads = this.roadPaths;
    const r = roads[Math.floor(Math.random() * roads.length)];
    const t = Math.random();
    return {
      x: r.x1 + (r.x2 - r.x1) * t,
      z: r.z1 + (r.z2 - r.z1) * t,
      horizontal: true,
      dir: Math.random() > 0.5 ? 1 : -1,
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
