"use strict";

// HUD = the 2D overlay that draws health / money / wanted stars / mission text.
// Renders into a full-screen 2D canvas on top of the 3D renderer.
const HUD = {
  money: 0,
  health: 100,
  wanted: 0,
  mission: "",
  objective: "",

  _canvas: null,
  _ctx: null,
  _dpr: 1,

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

    ctx.restore();
  },

  // Public setters used by the game.
  setMoney(v) { this.money = v; },
  setHealth(v) { this.health = v; },
  setWanted(v) { this.wanted = v; },
  setMission(t) { this.mission = t; },
  setObjective(t) { this.objective = t; }
};