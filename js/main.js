"use strict";

// Mini GTA — main entry point / game loop (Phase 0 scaffold).
// - Flat grid world + colored cube car
// - WASD arcade movement
// - Follow camera (drag mouse to orbit)
// Each block below will grow into its own Phase.

const Game = {
  scene: null,
  camera: null,
  renderer: null,

  car: null,
  carSpeed: 0.16,     // units per frame at full throttle
  carYaw: 0,          // facing direction; 0 = heading -Z
  carTurnRate: 0.045,

  // Camera orbit offsets (yaw/pitch relative to car facing).
  orbitYaw: 0.9,
  orbitPitch: 0.5,
  orbitDist: 14,
  _dragLast: null,

  clock: new THREE.Clock(),

  init() {
    Input.init();
    HUD.init();

    // --- Renderer ---
    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById("game-canvas"),
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;

    // --- Scene ---
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 40, 90);

    // --- Camera ---
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);

    // --- Lights ---
    const hemi = new THREE.HemisphereLight(0xffffff, 0x66aa66, 0.9);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(10, 20, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    this.scene.add(sun);

    // --- Ground ---
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x559944 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // --- Player car (simple cube for now) ---
    this.car = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.5, 3.2),
      new THREE.MeshLambertMaterial({ color: 0xe63939 })
    );
    body.position.y = 0.45;
    body.castShadow = true;
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.35, 1.6),
      new THREE.MeshLambertMaterial({ color: 0xbb2222 })
    );
    roof.position.set(0, 0.85, 0.15);
    roof.castShadow = true;
    this.car.add(body, roof);
    this.car.position.set(0, 0, 0);
    this.scene.add(this.car);

    // --- Resize ---
    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // --- Drag-to-orbit ----
    window.addEventListener("mousedown", () => { this._dragLast = { x: Input.mouseX, y: Input.mouseY }; });
    window.addEventListener("mouseup", () => { this._dragLast = null; });
    window.addEventListener("mousemove", (e) => {
      if (!this._dragLast) return;
      const dx = e.clientX - this._dragLast.x;
      const dy = e.clientY - this._dragLast.y;
      this._dragLast = { x: e.clientX, y: e.clientY };
      this.orbitYaw -= dx * 0.005;
      this.orbitPitch = Math.max(0.1, Math.min(1.4, this.orbitPitch + dy * 0.005));
    });

    HUD.setObjective("WASD to drive the red cube. Drag mouse to orbit.");
  },

  update(dt) {
    const throttle = Input.axisV(); // W = +1, S = -1
    const steer = Input.axisH();    // D = +1, A = -1

    // Turn proportional to steering and speed direction.
    const dir = Math.sign(throttle);
    this.carYaw += steer * this.carTurnRate * dir * Math.min(1, Math.abs(throttle));

    // Move along facing direction.
    const move = throttle * this.carSpeed * dt * 60;
    const sin = Math.sin(-this.carYaw);
    const cos = Math.cos(-this.carYaw);
    this.car.position.x += sin * move;
    this.car.position.z += cos * move;
    this.car.rotation.y = this.carYaw;
  },

  updateCamera() {
    const pos = this.car.position;

    // Offset of camera around the car, rotated by (carYaw + orbitYaw).
    const hubYaw = this.carYaw + this.orbitYaw + Math.PI; // camera placed behind car
    const offX = Math.sin(-hubYaw) * this.orbitDist * Math.cos(this.orbitPitch);
    const offZ = Math.cos(-hubYaw) * this.orbitDist * Math.cos(this.orbitPitch);
    const cx = pos.x + offX;
    const cz = pos.z + offZ;
    const cy = pos.y + 2.5 + Math.sin(this.orbitPitch) * this.orbitDist;

    const target = new THREE.Vector3(pos.x, pos.y + 1.2, pos.z);
    this.camera.position.lerp(new THREE.Vector3(cx, cy, cz), 0.25);
    this.camera.lookAt(target);
  },

  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.update(dt);
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
  },
};

// Boot.
Game.init();
Game.loop();