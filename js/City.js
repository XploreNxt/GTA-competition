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

    const roofMat = this._make(0x555a60, 0.9, 0.25);
    const trimMat = this._make(0x888888, 0.7, 0.3);
    const acMat = this._make(0x7a8088, 0.8, 0.4);
    const storeMats = [
      this._make(0x2a2a3a, 0.4, 0.2),
      this._make(0x1a1a2a, 0.3, 0.3),
      this._make(0x333344, 0.5, 0.15),
    ];
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x88bbee, metalness: 0.9, roughness: 0.05,
      transparent: true, opacity: 0.7, clearcoat: 1.0,
    });

    // Cache window textures per approximate size bucket
    const texCache = {};

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

        // Building type: 0=pastel, 1=glass tower, 2=dark commercial
        const typeRoll = rand(ix + 5, iz + 5);
        const isGlass = h > 28 && typeRoll > 0.6;
        const isDark = !isGlass && typeRoll < 0.2;

        // --- Main body ---
        let bodyMat;
        if (isGlass) {
          bodyMat = glassMat;
        } else if (isDark) {
          bodyMat = this._make(0x2a2a3a, 0.4, 0.25);
        } else {
          const colorIdx = Math.floor(rand(ix + 3, iz + 3) * this.PASTELS.length);
          bodyMat = this._make(this.PASTELS[colorIdx], 0.5, 0.15);
        }

        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
        body.position.set(bx, this.groundY + h / 2, bz);
        body.castShadow = true;
        body.receiveShadow = true;
        this.scene.add(body);
        this.buildings.push({ x: bx, z: bz, hw: w / 2, hd: d / 2, h: h });

        // --- Window texture overlay on front/back faces ---
        if (!isGlass && h > 6) {
          const winKey = Math.round(w) + "x" + Math.round(d);
          if (!texCache[winKey]) texCache[winKey] = this._makeWindowTexture(w, d, h, rand(ix + 7, iz + 7));
          const winMat = texCache[winKey];

          // Front face (z+)
          const winF = new THREE.Mesh(new THREE.PlaneGeometry(w, h), winMat);
          winF.position.set(bx, this.groundY + h / 2, bz + d / 2 + 0.02);
          this.scene.add(winF);

          // Back face (z-)
          const winB = new THREE.Mesh(new THREE.PlaneGeometry(w, h), winMat);
          winB.position.set(bx, this.groundY + h / 2, bz - d / 2 - 0.02);
          winB.rotation.y = Math.PI;
          this.scene.add(winB);

          // Left face (x-)
          const winL = new THREE.Mesh(new THREE.PlaneGeometry(d, h), winMat);
          winL.position.set(bx - w / 2 - 0.02, this.groundY + h / 2, bz);
          winL.rotation.y = -Math.PI / 2;
          this.scene.add(winL);

          // Right face (x+)
          const winR = new THREE.Mesh(new THREE.PlaneGeometry(d, h), winMat);
          winR.position.set(bx + w / 2 + 0.02, this.groundY + h / 2, bz);
          winR.rotation.y = Math.PI / 2;
          this.scene.add(winR);
        }

        // --- Ground-floor storefront ---
        if (h > 8) {
          const storeH = 3.2;
          const storeMat = storeMats[Math.floor(rand(ix + 8, iz + 8) * storeMats.length)];
          // front
          const sf = new THREE.Mesh(new THREE.PlaneGeometry(w, storeH), storeMat);
          sf.position.set(bx, this.groundY + storeH / 2, bz + d / 2 + 0.04);
          this.scene.add(sf);
          // back
          const sb = new THREE.Mesh(new THREE.PlaneGeometry(w, storeH), storeMat);
          sb.position.set(bx, this.groundY + storeH / 2, bz - d / 2 - 0.04);
          sb.rotation.y = Math.PI;
          this.scene.add(sb);
          // sides
          const sll = new THREE.Mesh(new THREE.PlaneGeometry(d, storeH), storeMat);
          sll.position.set(bx - w / 2 - 0.04, this.groundY + storeH / 2, bz);
          sll.rotation.y = -Math.PI / 2;
          this.scene.add(sll);
          const slr = new THREE.Mesh(new THREE.PlaneGeometry(d, storeH), storeMat);
          slr.position.set(bx + w / 2 + 0.04, this.groundY + storeH / 2, bz);
          slr.rotation.y = Math.PI / 2;
          this.scene.add(slr);
        }

        // --- Horizontal trim ledges ---
        if (h > 12) {
          const ledgeCount = Math.floor(h / 10);
          for (let l = 1; l <= ledgeCount; l++) {
            const ly = (h / (ledgeCount + 1)) * l;
            const ledge = new THREE.Mesh(
              new THREE.BoxGeometry(w + 0.3, 0.2, d + 0.3),
              trimMat
            );
            ledge.position.set(bx, this.groundY + ly, bz);
            this.scene.add(ledge);
          }
        }

        // --- Neon signs on some buildings ---
        const hasNeon = rand(ix + 20, iz + 20) > 0.55 && h > 8;
        if (hasNeon) {
          const neonColors = [0xff0066, 0x00ccff, 0xff6600, 0x00ff88, 0xff00ff, 0xffff00, 0xff3333];
          const neonColor = neonColors[Math.floor(rand(ix + 21, iz + 21) * neonColors.length)];
          const neonMat = new THREE.MeshStandardMaterial({
            color: neonColor, emissive: neonColor, emissiveIntensity: 1.5,
            roughness: 0.3, metalness: 0.1,
          });

          // Sign panel on front face
          const signW = w * (0.4 + rand(ix + 22, iz + 22) * 0.4);
          const signH = 0.6 + rand(ix + 23, iz + 23) * 0.8;
          const signY = this.groundY + 3.8 + rand(ix + 24, iz + 24) * 2;
          const sign = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), neonMat);
          sign.position.set(bx, signY, bz + d / 2 + 0.06);
          this.scene.add(sign);

          // Glow point light
          const glow = new THREE.PointLight(neonColor, 0, 8, 2);
          glow.position.set(bx, signY, bz + d / 2 + 1);
          this.scene.add(glow);
          this.neonLights.push({ light: glow, baseIntensity: 0.8 + rand(ix + 25, iz + 25) * 0.6 });

          // Second sign on side for some
          if (rand(ix + 26, iz + 26) > 0.5) {
            const sideSign = new THREE.Mesh(new THREE.PlaneGeometry(signW * 0.8, signH), neonMat);
            sideSign.position.set(bx + w / 2 + 0.06, signY, bz);
            sideSign.rotation.y = Math.PI / 2;
            this.scene.add(sideSign);
          }
        }

        // --- Lit storefront awning glow ---
        if (h > 8 && rand(ix + 27, iz + 27) > 0.4) {
          const awningColors = [0xff4444, 0x44aaff, 0xffaa22, 0x44ff88];
          const awningColor = awningColors[Math.floor(rand(ix + 28, iz + 28) * awningColors.length)];
          const awningMat = new THREE.MeshStandardMaterial({
            color: awningColor, emissive: awningColor, emissiveIntensity: 0.6,
            roughness: 0.5, metalness: 0,
          });
          const awning = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, 0.4), awningMat);
          awning.position.set(bx, this.groundY + 3.3, bz + d / 2 + 0.08);
          awning.rotation.x = -0.2;
          this.scene.add(awning);
        }

        // --- Rooftop details ---
        const roofY = this.groundY + h;

        // Roof slab
        const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, 0.35, d * 0.95), roofMat);
        roofSlab.position.set(bx, roofY + 0.18, bz);
        this.scene.add(roofSlab);

        // AC units (1-3 per building)
        const acCount = 1 + Math.floor(rand(ix + 9, iz + 9) * 3);
        for (let a = 0; a < acCount; a++) {
          const ax = bx + (rand(ix + 10 + a, iz + 10) - 0.5) * w * 0.6;
          const az = bz + (rand(ix + 10, iz + 10 + a) - 0.5) * d * 0.6;
          const aw = 0.8 + rand(ix + 11, iz + 11) * 0.6;
          const ad = 0.6 + rand(ix + 12, iz + 12) * 0.5;
          const ah = 0.4 + rand(ix + 13, iz + 13) * 0.3;
          const ac = new THREE.Mesh(new THREE.BoxGeometry(aw, ah, ad), acMat);
          ac.position.set(ax, roofY + 0.35 + ah / 2, az);
          ac.castShadow = true;
          this.scene.add(ac);
        }

        // Water tank on tall buildings
        if (h > 22 && rand(ix + 14, iz + 14) > 0.5) {
          const tankR = 0.4 + rand(ix + 15, iz + 15) * 0.3;
          const tankH = 0.8 + rand(ix + 16, iz + 16) * 0.5;
          const tankMat = this._make(0x6a5a4a, 0.85, 0.15);
          const tank = new THREE.Mesh(new THREE.CylinderGeometry(tankR, tankR, tankH, 8), tankMat);
          tank.position.set(bx + w * 0.2, roofY + 0.35 + tankH / 2, bz - d * 0.2);
          tank.castShadow = true;
          this.scene.add(tank);

          // Tank legs
          const legMat = this._make(0x555555, 0.8, 0.4);
          for (let li = 0; li < 4; li++) {
            const la = (li / 4) * Math.PI * 2;
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 4), legMat);
            leg.position.set(
              bx + w * 0.2 + Math.cos(la) * tankR * 0.7,
              roofY + 0.35 + 0.25,
              bz - d * 0.2 + Math.sin(la) * tankR * 0.7
            );
            this.scene.add(leg);
          }
        }

        // Satellite dish on some buildings
        if (h > 18 && rand(ix + 17, iz + 17) > 0.6) {
          const dishMat = this._make(0xcccccc, 0.5, 0.6);
          const dish = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), dishMat);
          dish.position.set(bx - w * 0.25, roofY + 0.35, bz + d * 0.25);
          dish.rotation.x = -0.3;
          dish.rotation.y = rand(ix + 18, iz + 18) * Math.PI * 2;
          this.scene.add(dish);

          // Dish pole
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 4), this._make(0x555555, 0.8, 0.4));
          pole.position.set(bx - w * 0.25, roofY + 0.35 + 0.3, bz + d * 0.25);
          this.scene.add(pole);
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

        // Place a streetlight at each intersection corner
        const corners = [
          [cx + half + 0.5, cz + half + 0.5],
          [cx - half - 0.5, cz + half + 0.5],
          [cx + half + 0.5, cz - half - 0.5],
          [cx - half - 0.5, cz - half - 0.5],
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

          // Point light (will be toggled by time-of-day)
          const light = new THREE.PointLight(0xffcc88, 0, 18, 2);
          light.position.set(lx, 5.2, lz);
          this.scene.add(light);

          this.streetLights.push({ group: g, light: light, lamp: lamp });
        }
      }
    }
  },

  // Toggle streetlights and neon based on time-of-day
  setStreetlights(nightAmount) {
    const intensity = Math.max(0, (nightAmount - 0.3) / 0.4);
    for (const sl of this.streetLights) {
      sl.light.intensity = intensity * 1.8;
      sl.lamp.material.emissiveIntensity = 0.3 + intensity * 2.0;
    }
    for (const nl of this.neonLights) {
      nl.light.intensity = intensity * nl.baseIntensity;
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