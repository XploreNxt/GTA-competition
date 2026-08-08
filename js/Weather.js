"use strict";

// Weather — rain particle system + ambient rain sound.
// Rain falls as instanced thin quads; sound is synthesized noise.

const Weather = {
  scene: null,
  _rainMesh: null,
  _drops: [],
  _count: 2500,
  _active: false,
  _timer: 0,
  _cycleDuration: 90,   // seconds per weather cycle
  _rainChance: 0.35,    // chance of rain per cycle

  init(scene) {
    this.scene = scene;
    this._buildRain();
  },

  _buildRain() {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this._count * 3);
    const velocities = new Float32Array(this._count * 3);
    const sizes = new Float32Array(this._count);

    for (let i = 0; i < this._count; i++) {
      this._resetDrop(positions, velocities, sizes, i, true);
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: 0.0 },
        uColor: { value: new THREE.Color(0xaaccff) },
      },
      vertexShader: `
        attribute float size;
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (200.0 / -mv.z);
          gl_PointSize = clamp(gl_PointSize, 1.0, 6.0);
          gl_Position = projectionMatrix * mv;
          vAlpha = smoothstep(0.0, 5.0, -mv.z) * 0.5;
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          // Elongated raindrop shape
          float d = length(uv * vec2(1.0, 0.3));
          if (d > 0.5) discard;
          float alpha = (1.0 - d * 2.0) * vAlpha * uOpacity;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this._rainMesh = new THREE.Points(geo, mat);
    this._rainMesh.frustumCulled = false;
    this.scene.add(this._rainMesh);
    this._velocities = velocities;
  },

  _resetDrop(pos, vel, sizes, i, randomY) {
    const spread = 200;
    const px = (Math.random() - 0.5) * spread;
    const py = randomY ? Math.random() * 60 : 55 + Math.random() * 10;
    const pz = (Math.random() - 0.5) * spread;
    pos[i * 3] = px;
    pos[i * 3 + 1] = py;
    pos[i * 3 + 2] = pz;
    vel[i * 3] = (Math.random() - 0.5) * 0.5;  // wind x
    vel[i * 3 + 1] = -18 - Math.random() * 12;  // fall speed
    vel[i * 3 + 2] = (Math.random() - 0.5) * 0.5; // wind z
    sizes[i] = 1.0 + Math.random() * 1.5;
  },

  update(dt, playerPos) {
    this._timer += dt;

    // Weather cycle: toggle rain randomly
    if (this._timer > this._cycleDuration) {
      this._timer = 0;
      this._active = Math.random() < this._rainChance;
    }

    const targetOpacity = this._active ? 1.0 : 0.0;
    const mat = this._rainMesh.material;
    mat.uniforms.uOpacity.value += (targetOpacity - mat.uniforms.uOpacity.value) * dt * 0.5;

    if (mat.uniforms.uOpacity.value < 0.01 && !this._active) return;

    const geo = this._rainMesh.geometry;
    const pos = geo.attributes.position.array;
    const sizes = geo.attributes.size.array;
    const vel = this._velocities;

    for (let i = 0; i < this._count; i++) {
      // Move
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;

      // Recycle if below ground or too far
      if (pos[i * 3 + 1] < -2) {
        this._resetDrop(pos, vel, sizes, i, false);
        // Keep rain centered on player
        if (playerPos) {
          pos[i * 3] += playerPos.x;
          pos[i * 3 + 2] += playerPos.z;
        }
      }
    }

    geo.attributes.position.needsUpdate = true;

    // Keep rain around player
    if (playerPos) {
      this._rainMesh.position.x = playerPos.x * 0;
      this._rainMesh.position.z = playerPos.z * 0;
    }
  },

  // Public: force rain on/off
  setRain(on) {
    this._active = on;
    this._timer = 0;
  },

  get isRaining() {
    return this._active && this._rainMesh.material.uniforms.uOpacity.value > 0.5;
  },

  // Apply wet road effect to ground material
  applyWetEffects(groundMat, scene, fog) {
    const wet = this.isRaining ? 1 : 0;
    if (groundMat) {
      groundMat.metalness += (wet * 0.35 - groundMat.metalness) * 0.02;
      groundMat.roughness += ((1 - wet) * 0.94 - groundMat.roughness) * 0.02;
    }
    if (fog && this.isRaining) {
      fog.far = 350;
    } else if (fog) {
      fog.far += (460 - fog.far) * 0.01;
    }
  },
};
