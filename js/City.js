"use strict";

// City — procedural Miami Vice City: road grid, sidewalks, crosswalks,
// pastel buildings, palm trees. Everything adds to the shared scene.

const City = {
  BLOCK: 26,          // distance between road centerlines
  ROAD_W: 9,          // road strip width (one street)
  SIDEWALK: 2,        // sidewalk width beside each road side
  EXTENT: 10,         // roads run from -EXTENT..EXTENT on each axis

  scene: null,
  groundY: 0,
  roadSpan: 0,

  PASTELS: [
    0xf4a6c8, 0x8fd3f4, 0x9be89e, 0xf9d976, 0xe8a08f,
    0xa9a6e8, 0x88d8c5, 0xf3b0a2, 0xc9e88f, 0xe0c0e8,
  ],

  init(scene) {
    this.scene = scene;
    this.roadSpan = this.BLOCK * (this.EXTENT * 2 + 1);
    this._buildRoads();
    this._buildSidewalks();
    this._buildCrosswalks();
    this._buildBuildings();
    this._buildPalms();
  },

  _make(col, rough, metal) {
    return new THREE.MeshStandardMaterial({ color: col, roughness: rough, metalness: metal });
  },

  // Flat helper: adds a rotated plane at a position.
  _plane(w, h, x, z, mat, yExtra) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, this.groundY + (yExtra || 0), z);
    m.receiveShadow = true;
    this.scene.add(m);
    return m;
  },

  // The road grid: every BLOCK units, a road runs along +X and another along +Z.
  _buildRoads() {
    const n = this.EXTENT, blk = this.BLOCK;
    const roadMat = this._make(0x414447, 0.95, 0.03);
    const dashMat = this._make(0xe8e04f, 0.9, 0);

    for (let i = -n; i <= n; i++) {
      // E-W road at z = i*blk
      this._plane(this.roadSpan, this.ROAD_W, 0, i * blk, roadMat, 0.015);
      this._plane(this.roadSpan, 0.12, 0, i * blk, dashMat, 0.025);
      // N-S road at x = i*blk
      this._plane(this.ROAD_W, this.roadSpan, i * blk, 0, roadMat, 0.015);
      this._plane(0.12, this.roadSpan, i * blk, 0, dashMat, 0.025);
    }
  },

  _buildSidewalks() {
    const n = this.EXTENT, blk = this.BLOCK;
    const sw = this.SIDEWALK;
    const mat = this._make(0xc9c5b8, 0.85, 0.04);
    const inset = this.ROAD_W / 2 + sw / 2;
    const span = this.BLOCK * (n * 2);

    for (let i = -n; i < n; i++) {
      // horizontal sidewalk bands just above and below each Z-road row
      this._plane(span, sw, 0, i * blk + blk / 2 + inset, mat, 0.02);
      this._plane(span, sw, 0, i * blk + blk / 2 - inset, mat, 0.02);
      // vertical bands flanking each X-road column
      this._plane(sw, span, i * blk + blk / 2 + inset, 0, mat, 0.02);
      this._plane(sw, span, i * blk + blk / 2 - inset, 0, mat, 0.02);
    }
  },

  _buildCrosswalks() {
    const n = this.EXTENT, blk = this.BLOCK;
    const half = this.ROAD_W / 2;
    const bars = [];

    // arms: +X, -X, +Z, -Z
    const arms = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    for (let i = -n; i <= n; i++) {
      for (let j = -n; j <= n; j++) {
        const cx = i * blk, cz = j * blk;
        for (let a = 0; a < 4; a++) {
          const [dx, dz] = arms[a];
          const horizontal = Math.abs(dx) === 1;
          for (let k = -2; k <= 2; k++) {
            const bx = cx + dx * (half + 1.1) + dz * k * 1.5;
            const bz = cz + dz * (half + 1.1) + dx * k * 1.5;
            bars.push({
              x: bx, z: bz,
              w: horizontal ? 2.6 : 0.75,
              d: horizontal ? 0.75 : 2.6,
            });
          }
        }
      }
    }

    // One InstancedMesh for all zebra bars (1 draw call).
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = this._make(0xefefe8, 0.9, 0);
    const mesh = new THREE.InstancedMesh(geo, mat, bars.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const axis = new THREE.Vector3(1, 0, 0);
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      q.setFromAxisAngle(axis, -Math.PI / 2); // lay flat
      m4.compose(new THREE.Vector3(b.x, this.groundY + 0.05, b.z), q, new THREE.Vector3(b.w, b.d, 1));
      mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  },

  _buildBuildings() {
    const n = this.EXTENT, blk = this.BLOCK;
    const interior = blk - this.ROAD_W - this.SIDEWALK * 2;
    const rand = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); };

    // Share one material per pastel color (fewer draw-state changes, lighter RAM).
    const bldgMats = this.PASTELS.map(c => this._make(c, 0.5, 0.15));
    const roofMat = this._make(0x555a60, 0.9, 0.25);

    for (let ix = -n; ix < n; ix++) {
      for (let iz = -n; iz < n; iz++) {
        const cx = ix * blk + blk / 2;
        const cz = iz * blk + blk / 2;
        const w = interior * (0.62 + 0.36 * rand(ix, iz));
        const d = interior * (0.62 + 0.36 * rand(ix + 1, iz));
        const h = 8 + 30 * rand(ix, iz + 1);
        const offX = (rand(ix + 2, iz) - 0.5) * (interior - w) * 0.9;
        const offZ = (rand(ix, iz + 2) - 0.5) * (interior - d) * 0.9;
        const colorIdx = Math.floor(rand(ix + 3, iz + 3) * bldgMats.length);

        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bldgMats[colorIdx]);
        b.position.set(cx + offX, this.groundY + h / 2, cz + offZ);
        b.castShadow = true;
        b.receiveShadow = true;
        this.scene.add(b);

        const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, 0.4, d * 0.3), roofMat);
        roof.position.set(cx + offX, this.groundY + h + 0.2, cz + offZ);
        this.scene.add(roof);
      }
    }
  },

  _buildPalms() {
    const n = this.EXTENT, blk = this.BLOCK;
    const rand = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); };
    const trunkMat = this._make(0x8a6645, 0.9, 0);
    const leafMat = this._make(0x3f8f4a, 0.85, 0);
    const leafGeo = new THREE.ConeGeometry(0.55, 2.2, 5);

    for (let k = 0; k < 220; k++) {
      const ix = Math.floor(rand(k, 1) * (n * 2)) - n;
      const iz = Math.floor(rand(k, 2) * (n * 2)) - n;
      const side = rand(k, 3) > 0.5 ? 1 : -1;
      const t = rand(k, 4) - 0.5;
      const x = (ix + 0.5 + t * 0.6) * blk;
      const z = (iz + 0.5) * blk + side * (this.ROAD_W / 2 + this.SIDEWALK / 2);
      const s = 0.7 + rand(k, 5);

      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.26 * s, 2.4 * s, 6), trunkMat);
      trunk.position.y = 1.2 * s;
      trunk.castShadow = true;
      g.add(trunk);
      for (let i = 0; i < 7; i++) {
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.y = 2.5 * s + 0.5;
        leaf.rotation.z = 0.5;
        leaf.rotation.y = (i / 7) * Math.PI * 2;
        g.add(leaf);
      }
      g.position.set(x, this.groundY, z);
      this.scene.add(g);
    }
  },

  // Is an (x,z) point on a road (driveable surface)?
  onRoad(x, z) {
    const blk = this.BLOCK;
    const nearX = Math.round(x / blk) * blk;
    const nearZ = Math.round(z / blk) * blk;
    return Math.abs(x - nearX) < this.ROAD_W / 2 || Math.abs(z - nearZ) < this.ROAD_W / 2;
  },

  // Random road point + heading for traffic spawns.
  randomRoad() {
    const n = this.EXTENT, blk = this.BLOCK;
    const i = Math.floor(Math.random() * (n * 2 + 1)) - n;
    const horizontal = Math.random() > 0.5;
    const t = (Math.random() - 0.5) * this.roadSpan;
    const x = horizontal ? t : i * blk;
    const z = horizontal ? i * blk : t;
    return { x, z, horizontal, dir: Math.random() > 0.5 ? 1 : -1 };
  },
};