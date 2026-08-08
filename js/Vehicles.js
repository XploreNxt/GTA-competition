"use strict";

// Vehicle — loads the Audi R8 FBX model and uses it for all cars.

const Vehicle = {
  scene: null,
  _playerBumped: 0,
  _carTemplate: null,
  _ready: false,

  init(scene) {
    this.scene = scene;
    return this._loadModel();
  },

  _loadModel() {
    return new Promise((resolve) => {
      const loader = new THREE.FBXLoader();
      loader.load("Assets/car/Models/Audi R8.fbx",
        (obj) => {
          try {
            const box = new THREE.Box3().setFromObject(obj);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetLen = 4.5;
            const scale = targetLen / maxDim;
            obj.scale.setScalar(scale);
            obj.updateMatrixWorld(true);

            const box2 = new THREE.Box3().setFromObject(obj);
            const min = box2.min.clone().negate();
            obj.position.copy(min);
            obj.position.y = 0;
            obj.updateMatrixWorld(true);

            obj.traverse((child) => {
              if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            this._carTemplate = obj;
            this._ready = true;
            console.log("Audi R8 car model loaded, scale:", scale.toFixed(4));
          } catch (e) {
            console.error("Car model prepare failed:", e);
            this._ready = false;
          }
          resolve();
        },
        undefined,
        (err) => {
          console.error("Car FBX load error:", err);
          this._ready = false;
          resolve();
        }
      );
    });
  },

  _cloneCar(color) {
    if (!this._ready || !this._carTemplate) return this._buildFallback(color);

    const g = this._carTemplate.clone();
    g.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone();
        const name = (child.name || "").toLowerCase();
        const matName = (child.material.name || "").toLowerCase();
        const isGlass = name.includes("glass") || name.includes("window") || name.includes("windshield") ||
          matName.includes("glass") || matName.includes("window") ||
          (child.material.transparent && child.material.opacity < 0.8);
        const isTire = name.includes("tire") || name.includes("wheel") || name.includes("tyre") ||
          matName.includes("tire") || matName.includes("wheel");
        if (!isGlass && !isTire) {
          child.material.color.set(color);
        }
      }
    });
    return g;
  },

  _buildFallback(color) {
    const g = new THREE.Group();
    const paintMat = new THREE.MeshLambertMaterial({ color });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x111122, transparent: true, opacity: 0.7 });
    const tireMat = new THREE.MeshLambertMaterial({ color: 0x161616 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 4.2), paintMat);
    body.position.y = 0.5;
    body.castShadow = true;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 2.0), glassMat);
    cabin.position.set(0, 1.05, -0.2);
    const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.2, 12);
    const mkW = (x, z) => {
      const w = new THREE.Mesh(wheelGeo, tireMat);
      w.rotation.x = Math.PI / 2;
      w.position.set(x, 0.32, z);
      return w;
    };
    g.add(body, cabin, mkW(-0.85, 1.2), mkW(0.85, 1.2), mkW(-0.85, -1.2), mkW(0.85, -1.2));
    return g;
  },

  buildCar(color, onRoad, withLights) {
    const g = this._cloneCar(color);

    const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff0c8, emissiveIntensity: 2.4 }));
    hlL.position.set(-0.55, 0.55, 2.15);
    const hlR = hlL.clone();
    hlR.position.x = 0.55;
    const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2020, emissiveIntensity: 1.4 }));
    tlL.position.set(-0.55, 0.55, -2.15);
    const tlR = tlL.clone();
    tlR.position.x = 0.55;
    g.add(hlL, hlR, tlL, tlR);

    if (withLights) {
      const headL = new THREE.SpotLight(0xfff0cc, 0, 22, 0.5, 0.6, 1.5);
      headL.position.set(-0.55, 0.6, 2.2);
      headL.target.position.set(-0.55, 0, 14);
      g.add(headL, headL.target);

      const headR = new THREE.SpotLight(0xfff0cc, 0, 22, 0.5, 0.6, 1.5);
      headR.position.set(0.55, 0.6, 2.2);
      headR.target.position.set(0.55, 0, 14);
      g.add(headR, headR.target);

      const tailL = new THREE.PointLight(0xff2222, 0, 6, 2);
      tailL.position.set(-0.55, 0.55, -2.2);
      g.add(tailL);
      const tailR = new THREE.PointLight(0xff2222, 0, 6, 2);
      tailR.position.set(0.55, 0.55, -2.2);
      g.add(tailR);

      g.userData.headlights = [headL, headR];
      g.userData.taillights = [tailL, tailR];
    } else {
      g.userData.headlights = null;
      g.userData.taillights = null;
    }

    this.scene.add(g);
    return g;
  },

  cars: [],
  parked: [],

  spawnParked(count) {
    const palette = [0x8b8b8b, 0x4a6d8c, 0x6b8cae, 0x9c1818, 0x2f2f2f, 0xc9c9c9, 0x5a7a9a, 0x2c6fbb];
    const half = City.MAP_SIZE / 2;
    const rw = City.ROAD_WIDTH / 2;

    const add = (x, z, yaw) => {
      const car = this.buildCar(palette[Math.floor(Math.random() * palette.length)], false, false);
      car.position.set(x, 0, z);
      car.rotation.y = yaw + (Math.random() - 0.5) * 0.2;
      this.parked.push(car);
    };

    const nMain = Math.max(1, Math.floor(count / 4));
    for (const side of [-1, 1]) {
      for (let i = 0; i < nMain; i++) {
        const x = -half + 90 + (i + Math.random() * 0.7) * ((half * 2 - 180) / nMain);
        add(x, side * (rw + 1 + Math.random() * 1.5), side > 0 ? Math.PI / 2 : -Math.PI / 2);
      }
    }

    for (const loopZ of [350, -350]) {
      for (const side of [-1, 1]) {
        for (let i = 0; i < 2; i++) {
          const x = -half + 200 + (i + Math.random() * 0.7) * ((half * 2 - 400) / 2);
          add(x, loopZ + side * (4.5 + Math.random() * 1.5), side > 0 ? Math.PI / 2 : -Math.PI / 2);
        }
      }
    }

    for (const side of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const z = -320 + (i + Math.random() * 0.7) * 640;
        add(side * (850 + 4.5 + Math.random() * 1.5), z, Math.random() > 0.5 ? 0 : Math.PI);
      }
    }
  },

  spawnTraffic(count) {
    const palette = [0x2c6fbb, 0x2f9e44, 0xe0d94f, 0xf2f2f2, 0x8b2fc9, 0xc95a2f, 0x2a2a2a, 0x6fb7a5];
    for (let i = 0; i < count; i++) {
      const r = City.randomRoad();
      const car = this.buildCar(palette[i % palette.length], false, false);
      car.position.set(r.x, 0, r.z);
      if (r.horizontal) {
        car.position.z += r.lane;
        car.rotation.y = r.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      } else {
        car.position.x -= r.lane;
        car.rotation.y = r.dir > 0 ? 0 : Math.PI;
      }
      car.userData = {
        horizontal: r.horizontal,
        dir: r.dir,
        speed: 10 + Math.random() * 6,
      };
      this.cars.push(car);
    }
  },

  _trafficAccum: 0,

  updateTraffic(dt) {
    this._trafficAccum += dt;
    if (this._trafficAccum < 0.05) return;
    dt = this._trafficAccum;
    this._trafficAccum = 0;
    const span = City.roadSpan;
    const half = span / 2;
    for (const car of this.cars) {
      if (car.userData.active === false) continue;
      const d = car.userData;
      const move = d.speed * dt;
      if (d.horizontal) {
        car.position.x += d.dir * move;
        if (car.position.x > half + 20) car.position.x = -half;
        if (car.position.x < -half - 20) car.position.x = half;
      } else {
        car.position.z += d.dir * move;
        if (car.position.z > half + 20) car.position.z = -half;
        if (car.position.z < -half - 20) car.position.z = half;
      }
    }

    for (const car of this.cars) {
      if (car.userData.headlights) {
        for (const hl of car.userData.headlights) hl.intensity = this._headlightI;
        for (const tl of car.userData.taillights) tl.intensity = this._headlightI * 0.5;
      }
    }

    if (Player.inCar && Player.car) {
      const pc = Player.car.position;
      for (const car of this.cars) {
        const d = car.userData;
        if (d.active === false) continue;
        const dx = car.position.x - pc.x;
        const dz = car.position.z - pc.z;
        const r = 2.3;
        if (Player.speed > 4 && dx * dx + dz * dz < r * r) {
          this._playerBumped++;
          const dlen = Math.sqrt(dx * dx + dz * dz) || 1;
          car.position.x += (dx / dlen) * 0.5;
          car.position.z += (dz / dlen) * 0.5;
        }
      }
    }
  },

  _headlightI: 0,

  setHeadlights(nightAmount) {
    this._headlightI = Math.max(0, (nightAmount - 0.3) / 0.4);
    if (Player.car && Player.car.userData.headlights) {
      for (const hl of Player.car.userData.headlights) hl.intensity = this._headlightI;
      for (const tl of Player.car.userData.taillights) tl.intensity = this._headlightI * 0.5;
    }
  },
};
