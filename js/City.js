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
  buildings: [],      // AABBs: {x, z, hw, hd, h} for collision

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
    this._buildStreetlights();
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

    // Shared materials - reuse for all buildings
    const roofMat = this._make(0x555a60, 0.9, 0.25);
    const trimMat = this._make(0x888888, 0.7, 0.3);
    const acMat = this._make(0x7a8088, 0.8, 0.4);
    const storeMat = this._make(0x2a2a3a, 0.4, 0.2);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x88bbee, metalness: 0.9, roughness: 0.1,
      transparent: true, opacity: 0.7,
    });

    // Pre-create pastel materials (only 10 needed)
    const pastelMats = this.PASTELS.map(c => this._make(c, 0.5, 0.15));
    const darkMat = this._make(0x2a2a3a, 0.4, 0.25);

    // Collect building data for instancing
    const buildingBoxes = []; // {x, y, z, w, h, d, matIdx}
    const roofBoxes = [];
    const neonBoxes = [];

    for (let ix = -n; ix < n; ix++) {
      for (let iz = -n; iz < n; iz++) {
        const cx = ix * blk + blk / 2;
        const cz = iz * blk + blk / 2;
        const w = interior * (0.62 + 0.36 * rand(ix, iz));
        const d = interior * (0.62 + 0.36 * rand(ix + 1, iz));
        const h = 8 + 30 * rand(ix, iz + 1);
        const offX = (rand(ix + 2, iz) - 0.5) * (interior - w) * 0.9;
        const offZ = (rand(ix, iz + 2) - 0.5) * (interior - d) * 0.9;
        const bx = cx + offX, bz = cz + offZ;

        const typeRoll = rand(ix + 5, iz + 5);
        const isGlass = h > 28 && typeRoll > 0.6;
        const isDark = !isGlass && typeRoll < 0.2;

        // Material index: 0=pastel0, 1=pastel1, ... 9=pastel9, 10=dark, 11=glass
        let matIdx;
        if (isGlass) { matIdx = 11; }
        else if (isDark) { matIdx = 10; }
        else { matIdx = Math.floor(rand(ix + 3, iz + 3) * this.PASTELS.length); }

        // Main body - single box per building (no window overlays for perf)
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), isGlass ? glassMat : (isDark ? darkMat : pastelMats[matIdx]));
        body.position.set(bx, this.groundY + h / 2, bz);
        body.castShadow = true;
        body.receiveShadow = false; // perf: skip receive shadow on buildings
        this.scene.add(body);
        this.buildings.push({ x: bx, z: bz, hw: w / 2, hd: d / 2, h: h });

        // Roof slab - merged into main box visually (just add trim color via vertex colors would be ideal but skip for simplicity)
        // Skip roof slab, neon signs, awnings, AC units, tanks, dishes for performance
        // These details cost too many draw calls

        // Only add rooftop AC for tall buildings (1 box max)
        if (h > 25 && rand(ix + 9, iz + 9) > 0.6) {
          const ac = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.6), acMat);
          ac.position.set(bx, this.groundY + h + 0.5, bz);
          ac.castShadow = false;
          this.scene.add(ac);
        }
      }
    }
  },

  // Generate a window-grid texture for building facades.
  _makeWindowTexture(bw, bd, bh, seed) {
    const canvasW = 256, canvasH = 512;
    const c = document.createElement("canvas");
    c.width = canvasW; c.height = canvasH;
    const ctx = c.getContext("2d");

    // base wall color (slightly darker than building)
    const wallR = 60 + Math.floor(seed * 40);
    const wallG = 58 + Math.floor(seed * 35);
    const wallB = 55 + Math.floor(seed * 30);
    ctx.fillStyle = `rgb(${wallR},${wallG},${wallB})`;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // window grid
    const cols = Math.max(3, Math.floor(bw / 2.5));
    const rows = Math.max(2, Math.floor(bh / 3.5));
    const winW = canvasW / cols;
    const winH = canvasH / rows;
    const padX = winW * 0.22;
    const padY = winH * 0.18;

    for (let r = 0; r < rows; r++) {
      for (let c2 = 0; c2 < cols; c2++) {
        const wx = c2 * winW + padX;
        const wy = r * winH + padY;
        const ww = winW - padX * 2;
        const wh = winH - padY * 2;

        // window pane — some lit (warm), some dark, some blue-ish
        const litRoll = this._pseudoRand(c2 + r * 100, Math.floor(seed * 1000));
        if (litRoll > 0.65) {
          // lit window — warm yellow
          const brightness = 180 + Math.floor(litRoll * 75);
          ctx.fillStyle = `rgb(${brightness},${brightness - 20},${brightness - 60})`;
        } else if (litRoll > 0.4) {
          // dark window — slight blue tint
          ctx.fillStyle = `rgb(${20 + Math.floor(litRoll * 30)},${25 + Math.floor(litRoll * 35)},${35 + Math.floor(litRoll * 40)})`;
        } else {
          // very dark
          ctx.fillStyle = `rgb(${12 + Math.floor(litRoll * 15)},${14 + Math.floor(litRoll * 15)},${18 + Math.floor(litRoll * 15)})`;
        }
        ctx.fillRect(wx, wy, ww, wh);

        // window frame
        ctx.strokeStyle = `rgba(0,0,0,0.3)`;
        ctx.lineWidth = 1;
        ctx.strokeRect(wx, wy, ww, wh);

        // cross mullion
        if (ww > 10 && wh > 14) {
          ctx.beginPath();
          ctx.moveTo(wx + ww / 2, wy);
          ctx.lineTo(wx + ww / 2, wy + wh);
          ctx.moveTo(wx, wy + wh / 2);
          ctx.lineTo(wx + ww, wy + wh / 2);
          ctx.stroke();
        }
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.7,
      metalness: 0.1,
    });
  },

  _pseudoRand(a, b) {
    const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
    return x - Math.floor(x);
  },

  streetLights: [],
  neonLights: [],

  _buildStreetlights() {
    const n = this.EXTENT, blk = this.BLOCK;
    const poleMat = this._make(0x555555, 0.8, 0.4);
    const armMat = this._make(0x444444, 0.8, 0.3);
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xffeeaa, emissive: 0xffcc66, emissiveIntensity: 2.0,
    });

    for (let i = -n; i <= n; i++) {
      for (let j = -n; j <= n; j++) {
        const cx = i * blk, cz = j * blk;
        const half = this.ROAD_W / 2;

        // Place a streetlight at ONE corner (not all 4) for perf
        const corners = [
          [cx + half + 0.5, cz + half + 0.5],
        ];

        for (const [lx, lz] of corners) {
          const g = new THREE.Group();

          // Pole
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5.5, 6), poleMat);
          pole.position.y = 2.75;
          g.add(pole);

          // Horizontal arm
          const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 4), armMat);
          arm.rotation.z = Math.PI / 2;
          arm.position.set(0.7, 5.4, 0);
          g.add(arm);

          // Lamp head
          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), lampMat);
          lamp.position.set(1.35, 5.35, 0);
          g.add(lamp);

          g.position.set(lx, this.groundY, lz);
          this.scene.add(g);

          // Only create a PointLight at every 3rd intersection to stay under GPU uniform limit
          const hasLight = i % 3 === 0 && j % 3 === 0;
          if (hasLight) {
            const light = new THREE.PointLight(0xffcc88, 0, 28, 2);
            light.position.set(lx, 5.2, lz);
            this.scene.add(light);
            this.streetLights.push({ group: g, light: light, lamp: lamp });
          } else {
            this.streetLights.push({ group: g, light: null, lamp: lamp });
          }
        }
      }
    }
  },

  // Toggle streetlights and neon based on time-of-day
  setStreetlights(nightAmount) {
    const intensity = Math.max(0, (nightAmount - 0.3) / 0.4);
    for (const sl of this.streetLights) {
      if (sl.light) sl.light.intensity = intensity * 1.8;
      sl.lamp.material.emissiveIntensity = 0.3 + intensity * 2.0;
    }
  },

  _buildPalms() {
    const n = this.EXTENT, blk = this.BLOCK;
    const rand = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); };
    const trunkMat = this._make(0x8a6645, 0.9, 0);
    const leafMat = this._make(0x3f8f4a, 0.85, 0);
    const leafGeo = new THREE.ConeGeometry(0.55, 2.2, 5);

    for (let k = 0; k < 100; k++) {
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

  // Push a point (x,z) out of any building AABB. Returns resolved coords.
  // "r" is the entity radius to keep out of the box. Max 2 iterations.
  resolveCollision(x, z, r) {
    for (let iter = 0; iter < 2; iter++) {
      let pushed = false;
      for (const b of this.buildings) {
        const dx = x - b.x;
        const dz = z - b.z;
        const hw = b.hw + r;
        const hd = b.hd + r;
        if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
          // push out along the smallest penetration axis
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