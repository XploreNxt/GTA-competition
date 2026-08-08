"use strict";

// Mini GTA — main entry (Phase 0-GFX).
// Graphics baseline: ACES filmic tone mapping, PBR environment reflections,
// atmospheric sky/sun, bloom + FXAA + grain + vignette, procedural asphalt,
// detailed PBR car.

const Graphics = {
  sunDir: new THREE.Vector3(-0.68, 0.13, 0.42).normalize(),

  // Cinematic post-process: color grading + chromatic aberration + vignette + grain
  finalShader: {
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uExposure: { value: 1.05 },
      uContrast: { value: 1.08 },
      uSaturation: { value: 1.12 },
      uVignette: { value: 0.55 },
      uVignetteRadius: { value: 0.75 },
      uGrain: { value: 0.028 },
      uGrainSize: { value: 1.5 },
      uChromaShift: { value: 0.0012 },
      uWarmth: { value: 0.04 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform float uExposure;
      uniform float uContrast;
      uniform float uSaturation;
      uniform float uVignette;
      uniform float uVignetteRadius;
      uniform float uGrain;
      uniform float uGrainSize;
      uniform float uChromaShift;
      uniform float uWarmth;
      varying vec2 vUv;

      vec3 aces(vec3 x) {
        const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
        return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
      }

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }

      void main() {
        vec2 uv = vUv;

        // Chromatic aberration — offset R/B channels at screen edges
        vec2 dir = uv - 0.5;
        float edgeDist = length(dir);
        float shift = uChromaShift * edgeDist * edgeDist;
        float r = texture2D(tDiffuse, uv + dir * shift).r;
        float g = texture2D(tDiffuse, uv).g;
        float b = texture2D(tDiffuse, uv - dir * shift).b;
        vec3 col = vec3(r, g, b);

        // Exposure
        col *= uExposure;

        // ACES tonemap
        col = aces(col);

        // Gamma
        col = pow(col, vec3(1.0 / 2.2));

        // Warmth — shift towards orange/teal
        col.r += uWarmth * 0.5;
        col.b -= uWarmth * 0.3;

        // Contrast
        col = (col - 0.5) * uContrast + 0.5;

        // Saturation
        float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(vec3(luma), col, uSaturation);

        // Vignette — smooth radial darkening
        float vig = smoothstep(uVignetteRadius, uVignetteRadius - 0.35, edgeDist);
        col *= mix(1.0 - uVignette, 1.0, vig);

        // Film grain — temporal noise with size control
        float grainSeed = uTime * 0.7;
        vec2 grainUv = uv * uGrainSize * 100.0;
        float grain = (hash(grainUv + grainSeed) - 0.5) * uGrain;
        col += grain;

        // Subtle color lift in shadows (cinematic fade)
        col = mix(col, col * vec3(0.95, 0.97, 1.02), 0.3);

        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }
    `,
  },
};

function glowTexture(color, alpha) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
  g.addColorStop(0, "rgba(" + color + "," + alpha + ")");
  g.addColorStop(0.35, "rgba(" + color + "," + alpha * 0.5 + ")");
  g.addColorStop(1, "rgba(255,225,180,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function makeAsphaltTexture(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#2d3033";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 2200; i++) {
    const v = 26 + Math.floor(Math.random() * 60);
    ctx.fillStyle = "rgba(" + v + "," + v + "," + (v + 5) + ",0.6)";
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 1.7 + 0.3, 0, 7);
    ctx.fill();
  }
  for (let i = 0; i < 26; i++) {
    ctx.strokeStyle = "rgba(18,18,18,0.22)";
    ctx.lineWidth = 2 + Math.random() * 5;
    ctx.beginPath();
    const x = Math.random() * w, y = Math.random() * h;
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + 40 - Math.random() * 80, y + 20, x + 20, y + 40, x + 40 - Math.random() * 80, y + 40);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}

const Game = {
  scene: null,
  camera: null,
  renderer: null,
  composer: null,
  sky: null,
  money: 1500,

  orbitYaw: 0.9,
  orbitPitch: 0.5,
  orbitDist: 14,
  _dragLast: null,

  clock: new THREE.Clock(),
  time: 0,
  shake: 0,

  state: "menu", // "menu" | "playing" | "paused"

  _els: {},
  _dayTime: 0.35, // 0..1 (0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset)
  _daySpeed: 0.008, // full cycle per ~125 seconds

  init() {
    this._loadingScreen = document.getElementById("loading-screen");
    this._loadingBar = document.getElementById("loading-bar");
    this._loadingTip = document.getElementById("loading-tip");

    Input.init();
    HUD.init();
    AudioFX.init();

    this._els.startScreen = document.getElementById("start-screen");
    this._els.pauseMenu = document.getElementById("pause-menu");
    this._els.controlsOverlay = document.getElementById("controls-overlay");
    this._els.btnResume = document.getElementById("btn-resume");
    this._els.btnControls = document.getElementById("btn-controls");
    this._els.btnBack = document.getElementById("btn-back");

    this._els.btnResume.addEventListener("click", () => this.resume());
    this._els.btnControls.addEventListener("click", () => this._showControls());
    this._els.btnBack.addEventListener("click", () => this._hideControls());
    window.addEventListener("keydown", (e) => this._onKey(e));

    window.addEventListener("resize", () => this._onResize());
    window.addEventListener("mousedown", () => { this._dragLast = { x: Input.mouseX, y: Input.mouseY }; });
    window.addEventListener("mouseup", () => { this._dragLast = null; });
    window.addEventListener("mousemove", (e) => this._onDragMove(e));

    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById("game-canvas"), antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xe0c9a6, 110, 460);
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1200);

    this._createSky();
    this._createEnvironment();
    this._createLights();
    this._createGround();
    this._createOcean();
    this._createWorld();
    this._createPostFX();

    this.clock.stop();
    this._loadingScreen.classList.add("hidden");
  },

  _setLoading(pct, tip) {
    if (this._loadingBar) this._loadingBar.style.width = pct + "%";
    if (this._loadingTip) this._loadingTip.textContent = tip;
  },

  _onKey(e) {
    if (e.code === "Enter" || e.code === "NumpadEnter") {
      if (this.state === "menu") this.start();
    }
    if (e.code === "Escape") {
      if (this.state === "playing") this.pause();
      else if (this.state === "paused") this.resume();
    }
  },

  start() {
    this.state = "playing";
    this._els.startScreen.classList.add("hidden");
    HUD.show();
    this.clock.start();
    this.clock.getDelta();
    HUD.setObjective("WASD move — E enter car — drag orbit");
    HUD.setMission("Vice City");
  },

  pause() {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.clock.stop();
    this._els.pauseMenu.classList.remove("hidden");
  },

  resume() {
    if (this.state !== "paused") return;
    this.state = "playing";
    this.clock.start();
    this.clock.getDelta();
    this._els.pauseMenu.classList.add("hidden");
    this._els.controlsOverlay.classList.add("hidden");
  },

  _showControls() {
    this._els.controlsOverlay.classList.remove("hidden");
  },

  _hideControls() {
    this._els.controlsOverlay.classList.add("hidden");
  },

// Phase 1 world: city, traffic, player.
  _createWorld() {
    City.init(this.scene);

    Vehicle.init(this.scene);
    Vehicle.spawnTraffic(42);

    Peds.init(this.scene);
    Peds.spawn(40);

    Police.init(this.scene);
    Mission.init(this.scene);
    Particles.init(this.scene);
    Weather.init(this.scene);

    Player.spawn(City.BLOCK * 2, 0); // on a road centerline
    this.scene.add(Player.person);

    HUD.setMoney(1500);
    HUD.setMission("Vice City");
  },

  _createSky() {
    this.sky = new THREE.Sky();
    this.sky.scale.setScalar(1200);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 9;
    u.rayleigh.value = 1.1;
    u.mieCoefficient.value = 0.011;
    u.mieDirectionalG.value = 0.82;
    u.sunPosition.value.copy(Graphics.sunDir).multiplyScalar(1);
    this.scene.add(this.sky);

    const sun = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture("255,238,200", 1),
      color: 0xfff3d8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    sun.scale.set(70, 70, 1);
    sun.position.copy(Graphics.sunDir).multiplyScalar(980);
    this.scene.add(sun);
    this._sunSprite = sun;
  },

  _createEnvironment() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0xcfe6ff);

    const sunLook = new THREE.DirectionalLight(0xffe0b0, 3);
    sunLook.position.copy(Graphics.sunDir);
    envScene.add(sunLook);

    const skyBox = new THREE.Mesh(
      new THREE.BoxGeometry(20, 20, 20),
      new THREE.MeshBasicMaterial({
        map: (() => {
          const c = document.createElement("canvas");
          c.width = c.height = 512;
          const ctx = c.getContext("2d");
          const g = ctx.createLinearGradient(0, 0, 0, 512);
          g.addColorStop(0, "#6db9ff");
          g.addColorStop(0.6, "#b8d8f2");
          g.addColorStop(1, "#d9cba7");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, 512, 512);
          return new THREE.CanvasTexture(c);
        })(),
        side: THREE.BackSide,
      })
    );
    envScene.add(skyBox);

    const envRT = pmrem.fromScene(envScene, 0.1);
    this.scene.environment = envRT.texture;
    pmrem.dispose();
  },

  _createLights() {
    this.sunLight = new THREE.DirectionalLight(0xffe7c0, 1.9);
    this.sunLight.position.copy(Graphics.sunDir).normalize().multiplyScalar(200);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 500;
    this.sunLight.shadow.camera.left = -90;
    this.sunLight.shadow.camera.right = 90;
    this.sunLight.shadow.camera.top = 90;
    this.sunLight.shadow.camera.bottom = -90;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    const hemi = new THREE.HemisphereLight(0xbfe0ff, 0x8a7a55, 0.42);
    this.scene.add(hemi);
  },

  _createGround() {
    const tex = makeAsphaltTexture(512, 512);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(70, 70);

    this._groundMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.94, metalness: 0.02 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), this._groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  },

  _createOcean() {
    const waterGeo = new THREE.PlaneGeometry(2400, 2400, 128, 128);
    const waterMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color(0x0a4a6e) },
        uShallow: { value: new THREE.Color(0x1a8ab0) },
        uFoam: { value: new THREE.Color(0xc8e8f0) },
        uFogColor: { value: new THREE.Color(0xe0c9a6) },
        uFogNear: { value: 300 },
        uFogFar: { value: 600 },
      },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying float vWaveHeight;

        void main() {
          vUv = uv;
          vec3 pos = position;

          // layered waves
          float wave1 = sin(pos.x * 0.04 + uTime * 0.8) * 1.2;
          float wave2 = sin(pos.y * 0.06 + uTime * 1.1) * 0.7;
          float wave3 = sin((pos.x + pos.y) * 0.03 + uTime * 0.5) * 0.9;
          float wave4 = sin(pos.x * 0.12 + pos.y * 0.09 + uTime * 1.8) * 0.25;

          pos.z = wave1 + wave2 + wave3 + wave4;
          vWaveHeight = pos.z;

          vec4 worldPos = modelMatrix * vec4(pos, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform vec3 uFoam;
        uniform vec3 uFogColor;
        uniform float uFogNear;
        uniform float uFogFar;
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying float vWaveHeight;

        void main() {
          // depth based on wave height
          float depth = smoothstep(-1.5, 2.0, vWaveHeight);
          vec3 col = mix(uDeep, uShallow, depth);

          // foam on wave crests
          float foam = smoothstep(1.6, 2.2, vWaveHeight);
          foam += smoothstep(0.8, 1.2, vWaveHeight) * 0.3;
          col = mix(col, uFoam, foam * 0.7);

          // fake specular highlight
          float spec = pow(max(0.0, sin(vWorldPos.x * 0.08 + uTime * 1.2) *
                                  sin(vWorldPos.z * 0.06 + uTime * 0.9)), 8.0);
          col += vec3(1.0, 0.95, 0.85) * spec * 0.18;

          // distance fog
          float dist = length(vWorldPos.xz);
          float fogFactor = smoothstep(uFogNear, uFogFar, dist);
          col = mix(col, uFogColor, fogFactor);

          gl_FragColor = vec4(col, 0.88);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.water = new THREE.Mesh(waterGeo, waterMat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = -1.2;
    this.scene.add(this.water);
  },

  _createPostFX() {
    try {
      const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
      const composer = this.composer = new THREE.EffectComposer(this.renderer);
      composer.addPass(new THREE.RenderPass(this.scene, this.camera));

      this.bloom = new THREE.UnrealBloomPass(size, 0.55, 0.6, 0.88);
      composer.addPass(this.bloom);

      this._finalPass = new THREE.ShaderPass(Graphics.finalShader);
      composer.addPass(this._finalPass);

      const fxaa = new THREE.ShaderPass(THREE.FXAAShader);
      fxaa.material.uniforms.resolution.value.set(1 / window.innerWidth, 1 / window.innerHeight);
      this.fxaa = fxaa;
      composer.addPass(fxaa);
    } catch (e) {
      console.warn("PostFX failed, using direct rendering:", e);
      this.composer = null;
    }
  },

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (this.composer) {
      this.composer.setSize(window.innerWidth, window.innerHeight);
    }
    if (this.fxaa) {
      this.fxaa.material.uniforms.resolution.value.set(1 / window.innerWidth, 1 / window.innerHeight);
    }
  },

  _onDragMove(e) {
    if (!this._dragLast) return;
    const dx = e.clientX - this._dragLast.x;
    const dy = e.clientY - this._dragLast.y;
    this._dragLast = { x: e.clientX, y: e.clientY };
    this.orbitYaw -= dx * 0.005;
    this.orbitPitch = Math.max(0.1, Math.min(1.4, this.orbitPitch + dy * 0.005));
  },

  update(dt) {
    this.time += dt;
    this._updateDayNight(dt);
    Mission.update(dt);
    Player.update(dt);
    Vehicle.updateTraffic(dt);
    Peds.update(dt, Player.pos(), Player.inCar);
    Police.update(dt, Player.pos().x, Player.pos().z);

    const pedHits = Peds._hits;
    if (pedHits > 0) {
      Police.reportCrime(pedHits * 0.55 * (Player.inCar ? 1.5 : 0.6));
      Peds._hits = 0;
    }
    if (Vehicle._playerBumped) {
      Mission.onTrafficBumps(Vehicle._playerBumped);
      Police.reportCrime(0.45);
      Vehicle._playerBumped = 0;
    }

    HUD.setMoney(Game.money);
    HUD.setHealth(Player.health);
    HUD.setSpeed(Player.speed, Player.maxSpeed);
    HUD.updateGpsArrow(Mission.target, Player.pos());
    HUD.update();
    Particles.update(dt);
    Weather.update(dt, Player.pos());
    Weather.applyWetEffects(this._groundMat, this.scene, this.scene.fog);
    AudioFX.update(dt, Player.speed, Player.maxSpeed, Player.inCar, Police.stars);
  },

  updateCamera() {
    this.shake *= Math.max(0, 1 - 3.5 * (1 / 60));
    const pos = Player.pos();
    const hubYaw = (Player.inCar ? Player.yaw : 0) + this.orbitYaw + Math.PI;
    const cx = pos.x + Math.sin(-hubYaw) * this.orbitDist * Math.cos(this.orbitPitch);
    const cz = pos.z + Math.cos(-hubYaw) * this.orbitDist * Math.cos(this.orbitPitch);
    const cy = pos.y + 2.5 + Math.sin(this.orbitPitch) * this.orbitDist;
    const s = this.shake;
    this.camera.position.lerp(new THREE.Vector3(cx + (Math.random() - 0.5) * s, cy + (Math.random() - 0.5) * s, cz + (Math.random() - 0.5) * s), 0.25);
    this.camera.lookAt(new THREE.Vector3(pos.x + (Math.random() - 0.5) * s * 0.5, pos.y + 1.2, pos.z));

    // Dynamic FOV — increases at high speed
    const baseFOV = 60;
    const speedFOV = Player.inCar ? Math.abs(Player.speed) / Player.maxSpeed * 12 : 0;
    const targetFOV = baseFOV + speedFOV;
    this.camera.fov += (targetFOV - this.camera.fov) * 0.08;
    this.camera.updateProjectionMatrix();
  },

  loop() {
    requestAnimationFrame(() => this.loop());
    if (this.state !== "playing") {
      this._menuCamera();
      this._dayTime = (this._dayTime + this._daySpeed * 0.5) % 1.0;
      this._updateDayNight(0);
      this.sky.material.uniforms.sunPosition.value.copy(Graphics.sunDir);
      this._safeRender();
      return;
    }
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.update(dt);
    this.updateCamera();
    this.sky.material.uniforms.sunPosition.value.copy(Graphics.sunDir);
    if (this.water) this.water.material.uniforms.uTime.value = this.time;
    if (this._finalPass) this._finalPass.material.uniforms.uTime.value = this.time;
    this._safeRender();
  },

  _safeRender() {
    try {
      if (this.composer) {
        this.composer.render(0);
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    } catch (e) {
      // Composer failed — fall back to direct render
      console.warn("Composer render failed, using fallback:", e.message);
      this.composer = null;
      this.renderer.render(this.scene, this.camera);
    }
  },

  _menuTime: 0,

  _menuCamera() {
    this._menuTime += 0.004;
    const t = this._menuTime;
    const cx = Math.sin(t) * 80;
    const cz = Math.cos(t) * 80;
    this.camera.position.set(cx, 30, cz);
    this.camera.lookAt(0, 4, 0);
  },

  _updateDayNight(dt) {
    this._dayTime = (this._dayTime + this._daySpeed * dt) % 1.0;
    const t = this._dayTime;

    // Sun angle: rises at 0.25, peaks at 0.5, sets at 0.75
    const sunAngle = (t - 0.25) * Math.PI * 2;
    const sunHeight = Math.sin(sunAngle);
    const nightAmount = Math.max(0, -sunHeight); // 0 at day, 1 at night

    // Sun direction
    Graphics.sunDir.set(
      Math.cos(sunAngle) * 0.7,
      Math.max(0.05, sunHeight),
      Math.sin(sunAngle) * 0.5
    ).normalize();

    // Sky parameters
    const skyU = this.sky.material.uniforms;
    skyU.turbidity.value = 2 + nightAmount * 8;
    skyU.rayleigh.value = 0.3 + (1 - nightAmount) * 1.2;
    skyU.mieCoefficient.value = 0.005 + nightAmount * 0.01;

    // Fog color: warm day → dark blue night
    const dayFog = new THREE.Color(0xe0c9a6);
    const nightFog = new THREE.Color(0x0a0a1a);
    this.scene.fog.color.copy(dayFog).lerp(nightFog, nightAmount);

    // Sun light
    const sunI = Math.max(0, sunHeight) * 2.0;
    this.sunLight.intensity = sunI;
    this.sunLight.color.setHex(sunHeight > 0.1 ? 0xffe7c0 : 0x4466aa);

    // Hemisphere light
    this.scene.children.forEach(c => {
      if (c.isHemisphereLight) {
        c.intensity = 0.15 + (1 - nightAmount) * 0.35;
      }
    });

    // Sun sprite
    if (this._sunSprite) {
      this._sunSprite.material.opacity = Math.max(0, sunHeight);
    }

    // Streetlights + car headlights
    City.setStreetlights(nightAmount);
    Vehicle.setHeadlights(nightAmount);

    // Update water fog to match
    if (this.water) {
      this.water.material.uniforms.uFogColor.value.copy(
        dayFog.clone().lerp(nightFog, nightAmount)
      );
    }
  },
};

Game.init();
Game.loop();