"use strict";

// Mini GTA — main entry (Phase 0-GFX).
// Graphics baseline: ACES filmic tone mapping, PBR environment reflections,
// atmospheric sky/sun, bloom + FXAA + grain + vignette, procedural asphalt,
// detailed PBR car.

const Graphics = {
  sunDir: new THREE.Vector3(-0.68, 0.13, 0.42).normalize(),

  finalShader: {
    uniforms: {
      tDiffuse: { value: null },
      intensity: { value: 0.92 },
      grainAmount: { value: 0.03 },
      vignetteStrength: { value: 0.6 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float intensity;
      uniform float grainAmount;
      uniform float vignetteStrength;
      varying vec2 vUv;
      vec3 aces(vec3 x) {
        const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
        return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
      }
      void main() {
        vec3 col = aces(texture2D(tDiffuse, vUv).rgb * intensity);
        col = pow(col, vec3(1.0 / 2.2));
        float dist = distance(vUv, vec2(0.5));
        col *= 1.0 - vignetteStrength * dist * dist;
        float g = (fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * grainAmount;
        col += g;
        gl_FragColor = vec4(col, 1.0);
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

  car: null,
  carSpeed: 0.16,
  carYaw: 0,
  carTurnRate: 0.045,

  orbitYaw: 0.9,
  orbitPitch: 0.5,
  orbitDist: 14,
  _dragLast: null,

  clock: new THREE.Clock(),

  init() {
    Input.init();
    HUD.init();

    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById("game-canvas"),
      antialias: true,
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
    this._createCar();
    this._createProbes();
    this._createPostFX();

    window.addEventListener("resize", () => this._onResize());
    window.addEventListener("mousedown", () => { this._dragLast = { x: Input.mouseX, y: Input.mouseY }; });
    window.addEventListener("mouseup", () => { this._dragLast = null; });
    window.addEventListener("mousemove", (e) => this._onDragMove(e));

    HUD.setObjective("WASD drive — drag orbit");
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
    this.sunLight = new THREE.DirectionalLight(0xffe7c0, 2.2);
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

    const hemi = new THREE.HemisphereLight(0xbfe0ff, 0x8a7a55, 0.5);
    this.scene.add(hemi);
  },

  _createGround() {
    const tex = makeAsphaltTexture(512, 512);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(70, 70);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, 1600),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.94, metalness: 0.02 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  },

  _createCar() {
    const g = new THREE.Group();
    const paint = new THREE.MeshPhysicalMaterial({ color: 0xd4262c, metalness: 0.85, roughness: 0.22, clearcoat: 1.0, clearcoatRoughness: 0.1 });
    const paintDark = new THREE.MeshPhysicalMaterial({ color: 0x9c1818, metalness: 0.85, roughness: 0.3, clearcoat: 0.8 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x13181f, metalness: 0.1, roughness: 0.08, clearcoat: 0.7, transparent: true, opacity: 0.9 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xcfd8e3, metalness: 1, roughness: 0.12 });
    const tire = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.9 });
    const grillMat = new THREE.MeshStandardMaterial({ color: 0x1c1e20, metalness: 0.8, roughness: 0.4 });
    const lightW = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff0c8, emissiveIntensity: 2.4 });
    const lightR = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2020, emissiveIntensity: 1.4 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.4, 3.6), paint);
    body.position.y = 0.6;
    body.castShadow = true;

    const cabin = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), glass);
    cabin.position.set(0, 0.95, 0.0);
    cabin.scale.set(0.82, 0.5, 1.0);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.16, 0.9), paintDark);
    hood.position.set(0, 0.82, 1.35);
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.16, 0.8), paintDark);
    trunk.position.set(0, 0.82, -1.3);

    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.3), grillMat);
    spoiler.position.set(0, 1.0, -1.75);

    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.26, 0.1), grillMat);
    grille.position.set(0, 0.5, 1.81);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.11, 1.5), glass);
    windshield.position.set(0, 1.1, -0.05);
    windshield.rotation.x = -0.28;

    const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.13, 0.1), lightW);
    hlL.position.set(-0.45, 0.66, 1.81);
    const hlR = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.13, 0.1), lightW);
    hlR.position.set(0.45, 0.66, 1.81);

    const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.1), lightR);
    tlL.position.set(-0.52, 0.66, -1.81);
    const tlR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.1), lightR);
    tlR.position.set(0.52, 0.66, -1.81);

    const mkWheel = (x, z) => {
      const w = new THREE.Group();
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 18), tire);
      t.rotation.x = Math.PI / 2;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.28, 8), chrome);
      rim.rotation.x = Math.PI / 2;
      w.add(t, rim);
      w.position.set(x, 0.34, z);
      return w;
    };

    g.add(body, hood, trunk, spoiler, grille, cabin, windshield, hlL, hlR, tlL, tlR,
      mkWheel(-0.85, 1.1), mkWheel(0.85, 1.1), mkWheel(-0.85, -1.1), mkWheel(0.85, -1.1));

    this.car = g;
    this.scene.add(g);
  },

  _createProbes() {
    // Placeholder — Phase 1 adds city, traffic lights etc.
  },

  _createPostFX() {
    const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
    const composer = this.composer = new THREE.EffectComposer(this.renderer);
    composer.addPass(new THREE.RenderPass(this.scene, this.camera));
    this.bloom = new THREE.UnrealBloomPass(size, 0.55, 0.5, 0.82);
    composer.addPass(this.bloom);
    const tonePass = new THREE.ShaderPass(Graphics.finalShader);
    composer.addPass(tonePass);

    const fxaa = new THREE.ShaderPass(THREE.FXAAShader);
    fxaa.material.uniforms.resolution.value.set(1 / window.innerWidth, 1 / window.innerHeight);
    this.fxaa = fxaa;
    composer.addPass(fxaa);
  },

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.fxaa.material.uniforms.resolution.value.set(1 / window.innerWidth, 1 / window.innerHeight);
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
    const throttle = Input.axisV();
    const steer = Input.axisH();
    const dir = Math.sign(throttle);
    this.carYaw += steer * this.carTurnRate * dir * Math.min(1, Math.abs(throttle));
    const move = throttle * this.carSpeed * dt * 60;
    const sin = Math.sin(-this.carYaw);
    const cos = Math.cos(-this.carYaw);
    this.car.position.x += sin * move;
    this.car.position.z += cos * move;
    this.car.rotation.y = this.carYaw;
  },

  updateCamera() {
    const pos = this.car.position;
    const hubYaw = this.carYaw + this.orbitYaw + Math.PI;
    const cx = pos.x + Math.sin(-hubYaw) * this.orbitDist * Math.cos(this.orbitPitch);
    const cz = pos.z + Math.cos(-hubYaw) * this.orbitDist * Math.cos(this.orbitPitch);
    const cy = pos.y + 2.5 + Math.sin(this.orbitPitch) * this.orbitDist;
    this.camera.position.lerp(new THREE.Vector3(cx, cy, cz), 0.25);
    this.camera.lookAt(new THREE.Vector3(pos.x, pos.y + 1.2, pos.z));
  },

  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.update(dt);
    this.updateCamera();
    this.sky.material.uniforms.sunPosition.value.copy(Graphics.sunDir);
    this.composer.render(dt);
  },
};

Game.init();
Game.loop();