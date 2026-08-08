"use strict";

// Audio — tiny WebAudio synthesizer (no assets needed).
// Engine loop for the player's car, police siren when wanted > 0,
// and short one-shot effects. Everything is synthetic oscillators/noise.

const AudioFX = {
  ctx: null,
  master: null,
  engineGain: null,
  engineOsc: null,
  engineOsc2: null,
  engineFilter: null,
  sirenGain: null,
  sirenOsc1: null,
  sirenOsc2: null,
  suspended: true,

  init() {
    try {
      const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(ctx.destination);

      // engine: two detuned saw oscillators into a lowpass
      this.engineFilter = ctx.createBiquadFilter();
      this.engineFilter.type = "lowpass";
      this.engineFilter.frequency.value = 500;
      this.engineFilter.Q.value = 1.2;
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0.0;

      this.engineOsc = ctx.createOscillator();
      this.engineOsc.type = "sawtooth";
      this.engineOsc.frequency.value = 52;
      this.engineOsc2 = ctx.createOscillator();
      this.engineOsc2.type = "square";
      this.engineOsc2.frequency.value = 78;

      const oG = ctx.createGain();
      oG.gain.value = 0.5;
      this.engineOsc.connect(this.engineFilter);
      this.engineOsc2.connect(oG);
      oG.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      this.engineOsc2.start();

      // police siren: two-tone triangle wail
      this.sirenOsc1 = ctx.createOscillator();
      this.sirenOsc1.type = "triangle";
      this.sirenOsc1.frequency.value = 700;
      this.sirenOsc2 = ctx.createOscillator();
      this.sirenOsc2.type = "triangle";
      this.sirenOsc2.frequency.value = 520;
      this.sirenGain = ctx.createGain();
      this.sirenGain.gain.value = 0.0;
      this.sirenOsc1.connect(this.sirenGain);
      this.sirenOsc2.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc1.start();
      this.sirenOsc2.start();

      // rain: filtered noise
      this.rainGain = ctx.createGain();
      this.rainGain.gain.value = 0.0;
      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = "bandpass";
      rainFilter.frequency.value = 3000;
      rainFilter.Q.value = 0.5;
      this.rainNoise = this._noise(4);
      this.rainNoise.loop = true;
      this.rainNoise.connect(rainFilter);
      rainFilter.connect(this.rainGain);
      this.rainGain.connect(this.master);
      this.rainNoise.start();

      // resume on first interaction (browsers block autoplay)
      const resume = () => {
        if (this.ctx.state === "suspended") this.ctx.resume();
        this.suspended = false;
      };
      window.addEventListener("pointerdown", resume, { once: true });
      window.addEventListener("keydown", resume, { once: true });
      window.addEventListener("mousedown", resume, { once: true });
    } catch (e) {
      this.ctx = null; // audio unavailable; game still plays silently
    }
  },

  // Per-frame: engine pitch follows speed, siren follows wanted stars.
  update(dt, speed, maxSpeed, inCar, stars) {
    if (!this.ctx || this.suspended) return;
    const t = this.ctx.currentTime;

    const ratio = Math.min(1, Math.abs(speed) / maxSpeed);
    if (inCar) {
      this.engineFilter.frequency.setTargetAtTime(400 + ratio * 2100, t, 0.06);
      this.engineOsc.frequency.setTargetAtTime(46 + ratio * 120, t, 0.08);
      this.engineOsc2.frequency.setTargetAtTime(69 + ratio * 172, t, 0.08);
      this.engineGain.gain.setTargetAtTime(0.05 + ratio * 0.075, t, 0.1);
    } else {
      this.engineGain.gain.setTargetAtTime(0, t, 0.2);
    }

    const sirenTarget = stars > 0 ? 0.055 : 0;
    this.sirenGain.gain.setTargetAtTime(sirenTarget, t, 0.25);
    if (stars > 0) {
      const wail = (Math.sin(Game.time * 7) + 1) / 2;
      this.sirenOsc1.frequency.setTargetAtTime(640 + wail * 320, t, 0.05);
      this.sirenOsc2.frequency.setTargetAtTime(470 + wail * 340, t, 0.05);
    }

    // rain volume
    const rainTarget = (typeof Weather !== "undefined" && Weather.isRaining) ? 0.06 : 0;
    this.rainGain.gain.setTargetAtTime(rainTarget, t, 0.5);
  },

  // ---- one-shot effects ----
  crash(energy) {
    if (!this.ctx || this.suspended) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const d = Math.min(1.4, 0.25 + energy * 0.1);
    const noise = this._noise(d);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.6, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + d * 0.5);
    noise.connect(nGain);
    nGain.connect(this.master);

    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.3);
    const oG = ctx.createGain();
    oG.gain.setValueAtTime(0.5, t);
    oG.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(oG);
    oG.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.32);
  },

  whoosh() {
    if (!this.ctx || this.suspended) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noise(0.35);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
    src.stop(t + 0.32);
  },

  beep(freq, dur, vol) {
    if (!this.ctx || this.suspended) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  },

  // cash register chime
  payoff() {
    this.beep(880, 0.12, 0.3);
    setTimeout(() => { if (this.ctx) this.beep(1318, 0.16, 0.3); }, 90);
    setTimeout(() => { if (this.ctx) this.beep(1760, 0.28, 0.28); }, 200);
  },

  _noise(dur) {
    if (!this.noiseBuf || this.noiseBuf.duration < dur) {
      const len = Math.max(2, Math.ceil(dur * 22050));
      this.noiseBuf = this.ctx.createBuffer(1, len, 22050);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    return src;
  },
};