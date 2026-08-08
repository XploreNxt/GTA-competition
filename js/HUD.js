"use strict";

// HUD = the 2D overlay that draws health / money / wanted stars / mission text.
// Renders into a full-screen 2D canvas on top of the 3D renderer.
const HUD = {
  money: 0,
  health: 100,
  wanted: 0,
  mission: "",
  objective: "",
  tooltip: "",       // contextual hint, bottom-center
  waypoint: null,    // {x, z} in world space, or null
  flash: 0,          // red damage vignette 0..1
  _lastHealth: 100,

  _canvas: null,
  _ctx: null,
  _dpr: 1,
  _v3: null,

  init() {
    this._canvas = document.getElementById("hud-canvas");
    this._ctx = this._canvas.getContext("2d");
    this._resize();
    window.addEventListener("resize", () => this._resize());
    this._loop();
  },

  _resize() {
    this._dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._canvas.width = Math.floor(window.innerWidth * this._dpr);
    this._canvas.height = Math.floor(window.innerHeight * this._dpr);
  },

  _loop() {
    this._draw();
    requestAnimationFrame(() => this._loop());
  },

  _draw() {
    const ctx = this._ctx;
    const W = this._canvas.width;
    const H = this._canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.scale(this._dpr, this._dpr);

    const w = window.innerWidth;
    const h = window.innerHeight;

    // --- Money + Health (top-left) ---
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(12, 12, 210, 52);

    ctx.fillStyle = "#5fea5f";
    ctx.font = "bold 20px Segoe UI";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("$" + Math.floor(this.money).toLocaleString(), 22, 16);

    ctx.fillStyle = "#fff";
    ctx.font = "13px Segoe UI";
    ctx.fillText("HP " + Math.ceil(this.health) + "%", 22, 42);

    // --- Mission objective (top-center) ---
    if (this.objective) {
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      const textW = ctx.measureText(this.objective).width + 40;
      ctx.fillRect(w / 2 - textW / 2, 12, textW, 32);
      ctx.fillStyle = "#ffd93d";
      ctx.font = "bold 15px Segoe UI";
      ctx.textBaseline = "middle";
      ctx.fillText(this.objective, w / 2, 30);
    }

    // --- Wanted stars (top-center under objective) ---
    if (this.wanted > 0) {
      const starSize = 18;
      const gap = 4;
      const totalW = this.wanted * starSize + (this.wanted - 1) * gap;
      let x = w / 2 - totalW / 2;
      const y = 52;
      ctx.fillStyle = "#ff2d2d";
      for (let i = 0; i < this.wanted; i++) {
        ctx.beginPath();
        const cx = x + starSize / 2;
        const cy = y;
        for (let p = 0; p < 10; p++) {
          const r = p % 2 === 0 ? starSize / 2 : starSize / 4.6;
          const angle = (p * Math.PI) / 5 - Math.PI / 2;
          const px = cx + Math.cos(angle) * r;
          const py = cy + Math.sin(angle) * r;
          p === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        x += starSize + gap;
      }
    }

    // --- Mission text (bottom-center) ---
    if (this.mission) {
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      const textW = ctx.measureText(this.mission).width + 40;
      ctx.fillRect(w / 2 - textW / 2, h - 52, textW, 34);
      ctx.fillStyle = "#7fd6ff";
      ctx.font = "bold 15px Segoe UI";
      ctx.textBaseline = "middle";
      ctx.fillText(this.mission, w / 2, h - 35);
    }

    // --- Waypoint GPS arrow (bottom-center ring) ---
    if (this.waypoint && Game.camera) {
      if (!this._v3) this._v3 = new THREE.Vector3();
      const v = this._v3.set(this.waypoint.x, 0.5, this.waypoint.z).project(Game.camera);
      const behind = v.z > 1;
      let sx = (v.x * 0.5 + 0.5) * w;
      let sy = (-v.y * 0.5 + 0.5) * h;
      if (behind) {
        sx = w - sx;
        sy = h - sy;
      }
      const cx = w / 2, cy = h - 74;
      let ang = Math.atan2(sy - cy, sx - cx);
      if (behind) ang += Math.PI;
      // keep arrow on a 46px-radius ring
      const ax = cx + Math.cos(ang) * 46;
      const ay = cy + Math.sin(ang) * 46;

      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = "#ffd93d";
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-8, -8);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-8, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, 52, 0, Math.PI * 2);
      ctx.stroke();

      const dist = Math.hypot(this.waypoint.x - Player.pos().x, this.waypoint.z - Player.pos().z);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 13px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(Math.ceil(dist) + " m", cx, cy - 2);
    }

    // --- Context tooltip (bottom-center, above mission text) ---
    if (this.tooltip) {
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      const textW = ctx.measureText(this.tooltip).width + 40;
      ctx.fillRect(w / 2 - textW / 2, h - 88, textW, 30);
      ctx.fillStyle = "#ffd93d";
      ctx.font = "bold 14px Segoe UI";
      ctx.textBaseline = "middle";
      ctx.fillText(this.tooltip, w / 2, h - 73);
    }

    // --- Damage flash (red vignette edge) ---
    if (this.flash > 0.01) {
      this.flash *= 0.92;
      const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.28, w / 2, h / 2, h * 0.75);
      grad.addColorStop(0, "rgba(200,0,0,0)");
      grad.addColorStop(1, "rgba(200,0,0," + (this.flash * 0.55).toFixed(3) + ")");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    // --- Minimap (bottom-right) ---
    this._drawMinimap(ctx, w, h);

    ctx.restore();
  },

  _drawMinimap(ctx, w, h) {
    if (!City.BLOCK || !Player.person) return;
    const size = 148, pad = 18;
    const x = w - size - pad, y = h - size - pad;
    const half = City.roadSpan / 2;
    const scale = size / City.roadSpan;
    const mx = (wx) => x + (wx + half) * scale;
    const my = (wz) => y + (wz + half) * scale;

    ctx.fillStyle = "rgba(8,12,14,0.72)";
    ctx.fillRect(x, y, size, size);

    // street grid
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 2;
    for (let i = -City.EXTENT; i <= City.EXTENT; i++) {
      const kx = mx(i * City.BLOCK), kz = my(i * City.BLOCK);
      ctx.beginPath(); ctx.moveTo(kx, y); ctx.lineTo(kx, y + size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, kz); ctx.lineTo(x + size, kz); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);

    // cops
    if (Police.cops) {
      ctx.fillStyle = "#5aa8ff";
      for (const c of Police.cops) {
        const cx = mx(c.position.x), cy = my(c.position.z);
        if (cx >= x - 4 && cy >= y - 4 && cx <= x + size + 4 && cy <= y + size + 4) {
          ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 7); ctx.fill();
        }
      }
    }
    // waypoint beacon
    if (this.waypoint) {
      const bx = mx(this.waypoint.x), by = my(this.waypoint.z);
      ctx.fillStyle = "#ffd93d";
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-3.5, -3.5, 7, 7);
      ctx.restore();
    }
    // player arrow
    const pp = Player.pos();
    const px = mx(pp.x), py = my(pp.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Player.inCar ? -Player.yaw : -Player.person.rotation.y);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4.2, 5); ctx.lineTo(0, 2.2); ctx.lineTo(-4.2, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  // Public setters used by the game.
  setMoney(v) { this.money = v; },
  setHealth(v) {
    if (v < this._lastHealth) this.flash = Math.min(1, this.flash + 0.5);
    this._lastHealth = v;
    this.health = v;
  },
  setWanted(v) { this.wanted = v; },
  setMission(t) { this.mission = t; },
  setObjective(t) { this.objective = t; },
  setWaypoint(x, z) { this.waypoint = (x === null || x === undefined) ? null : { x, z }; }
};