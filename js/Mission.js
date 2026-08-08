"use strict";

// Mission — three short missions: a courier run, a stolen-goods
// delivery with police heat, and a traffic rampage. Each mission
// shows a glowing beacon + GPS arrow, and pays out on completion.

const Mission = {
  scene: null,

  queue: [],
  index: 0,
  m: null,             // current mission descriptor, or null
  phase: "",           // 'goto' | 'carry' | 'deliver' | 'done'
  target: null,        // current waypoint {x, z}
  beacons: [],         // active beacons in the scene
  completeTimer: 0,
  ramDone: 0,
  _eLast: false,
  usedE: false,        // set when this frame's E was consumed here

  init(scene) {
    this.scene = scene;
    this.queue = [
      {
        title: "THE COURIER",
        brief: "Grab the package at the depot, then deliver it to the bar across town.",
        reward: 600,
        type: "carry",
        heat: 0,
      },
      {
        title: "THE GOLDEN JACK",
        brief: "Steal the marked car, lose the law, park it at the garage. And don't get busted.",
        reward: 1400,
        type: "carry",
        heat: 2.2, // wanted stars on pickup
      },
      {
        title: "TRAFFIC RAMPAGE",
        brief: "Wreck 6 traffic cars with your vehicle. The police hate this one.",
        reward: 1000,
        type: "ram",
        targetCount: 6,
      },
    ];
    this.next();
  },

  next() {
    if (this.index >= this.queue.length) {
      this.m = null;
      this._clearBeacons();
      this.target = null;
      HUD.setObjective("ALL MISSIONS CLEAR — FREE ROAM");
      HUD.setMission("Vice City — Free Roam");
      HUD.setWaypoint(null);
      return;
    }
    const mq = this.queue[this.index++];
    this.m = mq;
    this.phase = "goto";
    this.ramDone = 0;

    // place targets on roads, far from the player-spawn area
    let A = this._farPoint();
    let B = mq.type === "carry" ? this._farPoint() : null;
    if (B) {
      for (let i = 0; i < 24 && Math.hypot(B.x - A.x, B.z - A.z) < 70; i++) B = this._farPoint();
    }
    mq.pickup = A;
    mq.drop = B;

    this._setTarget(A, mq.type === "ram" ? "WRECK ZONE" : "PICKUP");
    if (mq.type === "ram") {
      HUD.setMission(mq.title);
      this._phaseText();
    } else {
      HUD.setMission(mq.title + " — " + mq.brief);
    }
  },

  _randomPoint() {
    const r = City.randomRoad();
    return { x: r.x, z: r.z };
  },

  // a waypoint far from the start of the game
  _farPoint() {
    const px = City.BLOCK * 2, pz = 0;
    for (let i = 0; i < 30; i++) {
      const p = this._randomPoint();
      if (Math.hypot(p.x - px, p.z - pz) > 60) return p;
    }
    return this._randomPoint();
  },

  _setTarget(p, label) {
    this.target = { x: p.x, z: p.z };
    this._clearBeacons();
    this._buildBeacon(p.x, p.z, label);
    HUD.setWaypoint(p.x, p.z);
  },

  _buildBeacon(x, z, label) {
    const g = new THREE.Group();

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.0, 0.28, 10, 28),
      new THREE.MeshStandardMaterial({ color: 0xffd93d, emissive: 0xffb100, emissiveIntensity: 1.4, roughness: 0.3 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.12;

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 42, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0.16, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    beam.position.y = 21;

    const lab = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._labelTex(label),
      transparent: true,
      depthWrite: false,
    }));
    lab.scale.set(5, 1.9, 1);
    lab.position.set(0, 30, 0);

    g.add(ring, beam, lab);
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.beacons.push(g);
  },

  _labelTex(text) {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 192;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, 512, 192);
    ctx.fillStyle = "#ffd93d";
    ctx.font = "bold 56px Segoe UI";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 96);
    return new THREE.CanvasTexture(c);
  },

  _clearBeacons() {
    for (const b of this.beacons) this.scene.remove(b);
    this.beacons.length = 0;
  },

  _phaseText() {
    const m = this.m;
    if (m.type === "ram") {
      HUD.setObjective("Wreck " + this.ramDone + " / " + m.targetCount + " traffic cars");
    } else if (this.phase === "deliver") {
      HUD.setObjective("Deliver the package at the beacon");
    } else {
      HUD.setObjective("Get to the beacon and press E");
    }
  },

  update(dt) {
    if (!this.m) return;
    if (this.completeTimer > 0) {
      this.completeTimer -= dt;
      if (this.completeTimer <= 0) this.next();
      return;
    }

    // pulse all beacons
    const t = Game.time;
    for (const b of this.beacons) {
      const ring = b.children[0];
      const beam = b.children[1];
      const s = 1 + 0.15 * Math.sin(t * 3);
      ring.scale.set(s, s, s);
      ring.material.emissiveIntensity = 1.2 + Math.sin(t * 5) * 0.6;
      beam.material.opacity = 0.12 + Math.sin(t * 4) * 0.05;
    }

    const px = Player.pos().x, pz = Player.pos().z;

    // ---- interaction: E near the beacon ----
    if (this.target) {
      const dx = this.target.x - px, dz = this.target.z - pz;
      const d = Math.hypot(dx, dz);
      const E = Input.keys["KeyE"];
      const pressed = E && !this._eLast;
      this._eLast = E;

      if (d < 5) {
        if (this.phase === "goto") {
          HUD.setTooltip(this.m.type === "carry" ? "[E] GRAB THE PACKAGE" : "SMASH 6 TRAFFIC CARS");
          if (pressed && this.m.type === "carry") {
            this.usedE = true;
            this.phase = "deliver";
            AudioFX.beep(660, 0.1, 0.25);
            AudioFX.beep(990, 0.12, 0.25);
            this._setTarget(this.m.drop, "DROP OFF");
            if (this.m.heat > 0) Police.reportCrime(this.m.heat);
            HUD.setMission(this.m.title + " — deliver it!" + (this.m.heat > 0 ? "  COPS ARE AFTER YOU" : ""));
          }
        } else if (this.phase === "deliver") {
          HUD.setTooltip("[E] DELIVER THE PACKAGE");
          if (pressed) {
            this.usedE = true;
            this._complete();
            return;
          }
        }
      } else {
        HUD.setTooltip("");
      }
      this._phaseText();
    }
  },

  // called from Game.update with the ram count for traffic bumps
  onTrafficBumps(n) {
    if (!this.m || this.m.type !== "ram" || this.phase !== "goto" || this.completeTimer > 0) return;
    this.ramDone += n;
    this._phaseText();
    if (this.ramDone >= this.m.targetCount) this._complete();
  },

  _complete() {
    Game.money += this.m.reward;
    AudioFX.payoff();
    HUD.setMoney(Game.money);
    HUD.setObjective("MISSION CLEAR");
    HUD.setWaypoint(null);
    HUD.setTooltip("");
    this._clearBeacons();
    this.target = null;
    this.completeTimer = 2.6;

    // Show mission complete popup
    this._showCompletePopup(this.m.title, this.m.reward);
  },

  _showCompletePopup(title, reward) {
    const el = document.getElementById("mission-complete");
    const titleEl = document.getElementById("mc-title");
    const rewardEl = document.getElementById("mc-reward");

    titleEl.textContent = title;
    el.classList.remove("hidden", "mc-exit");

    // Animated cash counter
    let current = 0;
    const duration = 1200;
    const start = performance.now();

    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      current = Math.floor(eased * reward);
      rewardEl.textContent = current.toLocaleString();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        rewardEl.textContent = reward.toLocaleString();
        // Add extra chime for each $100
        const chimes = Math.floor(reward / 100);
        for (let i = 0; i < Math.min(chimes, 5); i++) {
          setTimeout(() => AudioFX.beep(880 + i * 110, 0.08, 0.15), i * 80);
        }
      }
    };
    requestAnimationFrame(animate);

    // Hide after delay
    setTimeout(() => {
      el.classList.add("mc-exit");
      setTimeout(() => {
        el.classList.add("hidden");
        el.classList.remove("mc-exit");
      }, 600);
    }, 3000);
  },
};