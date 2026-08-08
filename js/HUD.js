"use strict";

// HUD — manages all on-screen UI via styled HTML elements.
// The minimap is the only thing still drawn on a dedicated canvas.

const HUD = {
  money: 0,
  health: 100,
  wanted: 0,
  mission: "",
  objective: "",
  tooltip: "",
  waypoint: null,
  flash: 0,
  _lastHealth: 100,

  _els: {},
  _minimapCanvas: null,
  _minimapCtx: null,
  _v3: null,
  _starStripUrl: null,
  _starImg: null,
  _lastStarCount: -1,
  _starMode: "gold", // "gold" (transparent, processed) | "css" (filter fallback)

  init() {
    this._els = {
      hud: document.getElementById("hud"),
      money: document.getElementById("hud-money"),
      healthFill: document.getElementById("hud-health"),
      healthText: document.getElementById("hud-health-text"),
      objective: document.getElementById("hud-objective"),
      wanted: document.getElementById("hud-stars"),
      mission: document.getElementById("hud-mission"),
      tooltip: document.getElementById("hud-tooltip"),
      gps: document.getElementById("hud-gps"),
      gpsArrow: document.getElementById("hud-gps-arrow"),
      gpsDist: document.getElementById("hud-gps-dist"),
      speedo: document.getElementById("hud-speedo"),
      speedoVal: document.getElementById("speedo-val"),
      speedLines: document.getElementById("speed-lines"),
      damageFlash: document.getElementById("damage-flash"),
    };

    this._minimapCanvas = document.getElementById("minimap-canvas");
    this._minimapCtx = this._minimapCanvas.getContext("2d");
    this._resizeMinimap();
    window.addEventListener("resize", () => this._resizeMinimap());

    this._loadStarStrip();
  },

  // Load Assets/stars.png (5-star sprite, dark stars on white),
  // key out the white background and re-tint the stars gold.
  _loadStarStrip() {
    const img = new Image();
    img.src = "Assets/stars.png";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const id = ctx.getImageData(0, 0, c.width, c.height);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const lum = (r + g + b) / 3;
          if (lum > 180) {
            d[i + 3] = 0; // key out the (gradient) background, keep dark stars
            continue;
          }
          // star pixel: gold with brightness by darkness (bright core, darker edge)
          const t = lum / 255;
          const bright = 0.35 + 0.65 * (1 - t);
          d[i] = Math.round(255 * bright);
          d[i + 1] = Math.round(217 * bright);
          d[i + 2] = Math.round(61 * bright);
          d[i + 3] = 255;
        }
        ctx.putImageData(id, 0, 0);
        this._starStripUrl = c.toDataURL();
        this._starMode = "gold";
        this._renderStars(Math.ceil(this.wanted));
      } catch (e) {
        console.warn("Star sprite processing failed, using CSS filter fallback:", e);
        // file:// pages taint the canvas — tint via CSS instead
        this._starStripUrl = "Assets/stars.png";
        this._starMode = "css";
        this._renderStars(Math.ceil(this.wanted));
      }
    };
    img.onerror = () => {
      console.warn("Could not load Assets/stars.png");
    };
  },

  // Show N stars from the left of the 5-star strip.
  _renderStars(n) {
    const el = this._els.wanted;
    if (!el) return;
    if (n <= 0 || !this._starStripUrl) {
      this._lastStarCount = n;
      el.classList.remove("visible");
      el.style.width = "0px";
      el.innerHTML = "";
      return;
    }
    if (n === this._lastStarCount && this._starImg) return;
    this._lastStarCount = n;

    if (!this._starImg) {
      this._starImg = document.createElement("img");
      this._starImg.draggable = false;
      this._starImg.className = "star-img";
      el.appendChild(this._starImg);
    }
    // star cell = 172px of 860px strip; display height 22px
    const starW = 22 * (172 / 201);
    this._starImg.src = this._starStripUrl;
    this._starImg.style.width = (5 * starW) + "px";
    this._starImg.style.height = "22px";
    this._starImg.classList.toggle("css-tint", this._starMode === "css");
    el.style.width = (n * starW) + "px";
    el.classList.add("visible");
  },

  show() { this._els.hud.classList.remove("hidden"); },
  hide() { this._els.hud.classList.add("hidden"); },

  _resizeMinimap() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._minimapCanvas.width = 160 * dpr;
    this._minimapCanvas.height = 160 * dpr;
    this._minimapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },

  // Called every frame from Game loop.
  update() {
    this._updateMinimap();
    this._updateDamageFlash();
  },

  _updateDamageFlash() {
    if (this.flash > 0.01) {
      this.flash *= 0.92;
      this._els.damageFlash.classList.add("active");
      this._els.damageFlash.style.opacity = this.flash;
    } else {
      this._els.damageFlash.classList.remove("active");
      this._els.damageFlash.style.opacity = 0;
    }
  },

  // --- Minimap (canvas-drawn, round-clipped via CSS) ---

  _minimapBuildingCache: null,

  _updateMinimap() {
    if (!City.BLOCK || !Player.person) return;
    const ctx = this._minimapCtx;
    const size = 160;
    ctx.clearRect(0, 0, size, size);

    const half = City.roadSpan / 2;
    const scale = size / City.roadSpan;
    const mx = (wx) => (wx + half) * scale;
    const my = (wz) => (wz + half) * scale;

    // Background — dark with subtle radial gradient
    const bg = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    bg.addColorStop(0, "rgba(15,20,25,0.95)");
    bg.addColorStop(1, "rgba(5,8,12,0.98)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    // Building blocks — cache on first draw
    if (!this._minimapBuildingCache) {
      const bc = document.createElement("canvas");
      bc.width = bc.height = size;
      const bctx = bc.getContext("2d");
      const blk = City.BLOCK;
      const interior = blk - City.ROAD_W - City.SIDEWALK * 2;
      const rand = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); };

      for (let ix = -City.EXTENT; ix < City.EXTENT; ix++) {
        for (let iz = -City.EXTENT; iz < City.EXTENT; iz++) {
          const cx = ix * blk + blk / 2;
          const cz = iz * blk + blk / 2;
          const w = interior * (0.62 + 0.36 * rand(ix, iz));
          const d = interior * (0.62 + 0.36 * rand(ix + 1, iz));
          const bx = mx(cx), bz = my(cz);
          const bw = w * scale, bd = d * scale;

          const r = 40 + Math.floor(rand(ix + 3, iz + 3) * 30);
          const g = 45 + Math.floor(rand(ix + 5, iz + 5) * 25);
          const b2 = 55 + Math.floor(rand(ix + 7, iz + 7) * 20);
          bctx.fillStyle = `rgba(${r},${g},${b2},0.5)`;
          bctx.fillRect(bx - bw / 2, bz - bd / 2, bw, bd);
        }
      }
      this._minimapBuildingCache = bc;
    }
    ctx.drawImage(this._minimapBuildingCache, 0, 0);

    // Street grid — brighter lines for roads
    ctx.strokeStyle = "rgba(100,100,110,0.35)";
    ctx.lineWidth = Math.max(1, City.ROAD_W * scale * 0.5);
    for (let i = -City.EXTENT; i <= City.EXTENT; i++) {
      const kx = mx(i * City.BLOCK), kz = my(i * City.BLOCK);
      ctx.beginPath(); ctx.moveTo(kx, 0); ctx.lineTo(kx, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, kz); ctx.lineTo(size, kz); ctx.stroke();
    }

    // Road center dashes
    ctx.strokeStyle = "rgba(255,220,80,0.15)";
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 5]);
    for (let i = -City.EXTENT; i <= City.EXTENT; i++) {
      const kx = mx(i * City.BLOCK), kz = my(i * City.BLOCK);
      ctx.beginPath(); ctx.moveTo(kx, 0); ctx.lineTo(kx, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, kz); ctx.lineTo(size, kz); ctx.stroke();
    }
    ctx.setLineDash([]);

    // Cops — pulsing blue dots
    if (Police.cops) {
      const pulse = 0.6 + Math.sin(Date.now() * 0.006) * 0.4;
      for (const c of Police.cops) {
        const cx = mx(c.position.x), cy = my(c.position.z);
        if (cx >= -4 && cy >= -4 && cx <= size + 4 && cy <= size + 4) {
          ctx.fillStyle = `rgba(90,168,255,${pulse})`;
          ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "rgba(90,168,255,0.3)";
          ctx.beginPath(); ctx.arc(cx, cy, 5.5, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // Waypoint — pulsing diamond
    if (this.waypoint) {
      const bx = mx(this.waypoint.x), by = my(this.waypoint.z);
      const wp = 0.7 + Math.sin(Date.now() * 0.005) * 0.3;
      const sz = 4 + wp * 2;
      ctx.fillStyle = `rgba(255,217,61,${wp})`;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-sz, -sz, sz * 2, sz * 2);
      ctx.restore();
      ctx.strokeStyle = "rgba(255,217,61,0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(bx, by, sz + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Player arrow — larger, with direction cone
    const pp = Player.pos();
    const px = mx(pp.x), py = my(pp.z);
    const pAngle = Player.inCar ? -Player.yaw : -Player.person.rotation.y;

    // Direction cone (subtle)
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, 18, pAngle - 0.5, pAngle + 0.5);
    ctx.closePath();
    ctx.fill();

    // Arrow body
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(pAngle);
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(255,255,255,0.5)";
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(4.5, 5.5); ctx.lineTo(0, 2.8); ctx.lineTo(-4.5, 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // Compass labels
    ctx.font = "bold 9px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("N", size / 2, 9);
    ctx.fillText("S", size / 2, size - 9);
    ctx.fillText("W", 9, size / 2);
    ctx.fillText("E", size - 9, size / 2);

    // North indicator — red triangle
    ctx.fillStyle = "#ff4444";
    ctx.beginPath();
    ctx.moveTo(size / 2, 3);
    ctx.lineTo(size / 2 - 3, 8);
    ctx.lineTo(size / 2 + 3, 8);
    ctx.closePath();
    ctx.fill();
  },

  // --- Public setters ---

  setMoney(v) {
    this.money = v;
    this._els.money.textContent = "$" + Math.floor(v).toLocaleString();
  },

  setHealth(v) {
    if (v < this._lastHealth) this.flash = Math.min(1, this.flash + 0.5);
    this._lastHealth = v;
    this.health = v;
    const pct = Math.ceil(v);
    this._els.healthFill.style.width = pct + "%";
    this._els.healthText.textContent = pct;
  },

  setWanted(v) {
    this.wanted = v;
    this._renderStars(Math.ceil(v));
  },

  setObjective(t) {
    this.objective = t;
    this._els.objective.textContent = t;
    this._els.objective.classList.toggle("visible", !!t);
  },

  setMission(t) {
    this.mission = t;
    this._els.mission.textContent = t;
    this._els.mission.classList.toggle("visible", !!t);
  },

  setTooltip(t) {
    this.tooltip = t;
    this._els.tooltip.textContent = t;
    this._els.tooltip.classList.toggle("visible", !!t);
  },

  setWaypoint(x, z) {
    this.waypoint = (x === null || x === undefined) ? null : { x, z };
    this._els.gps.classList.toggle("visible", !!this.waypoint);
  },

  setSpeed(speed, maxSpeed) {
    if (!Player.inCar) {
      this._els.speedo.classList.remove("visible");
      this._els.speedLines.classList.remove("active");
      return;
    }
    this._els.speedo.classList.add("visible");
    const mph = Math.abs(Math.round(speed * 2.24));
    this._els.speedoVal.textContent = mph;

    // Speed lines appear at high speed
    const speedRatio = Math.abs(speed) / maxSpeed;
    this._els.speedLines.classList.toggle("active", speedRatio > 0.7);
  },

  updateGpsArrow(waypoint, playerPos) {
    if (!waypoint || !Game.camera) {
      this._els.gps.classList.remove("visible");
      return;
    }
    this._els.gps.classList.add("visible");

    if (!this._v3) this._v3 = new THREE.Vector3();
    const v = this._v3.set(waypoint.x, 0.5, waypoint.z).project(Game.camera);
    const behind = v.z > 1;
    const w = window.innerWidth, h = window.innerHeight;
    let sx = (v.x * 0.5 + 0.5) * w;
    let sy = (-v.y * 0.5 + 0.5) * h;
    if (behind) { sx = w - sx; sy = h - sy; }

    const cx = w / 2, cy = h - 80;
    let ang = Math.atan2(sy - cy, sx - cx);
    if (behind) ang += Math.PI;

    this._els.gpsArrow.style.transform = `rotate(${ang + Math.PI / 2}rad)`;

    const dist = Math.hypot(waypoint.x - playerPos.x, waypoint.z - playerPos.z);
    this._els.gpsDist.textContent = Math.ceil(dist) + " m";
  },
};
