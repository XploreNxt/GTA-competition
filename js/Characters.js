"use strict";

// Characters — loads the Kenney characterMedium.fbx (CC0, see Assets/characters/License.txt),
// its 4 skins and the idle/run/jump animations. Characters are deep-cloned
// per entity so every skeleton animates independently.

const Characters = {
  ready: false,
  model: null,        // template group (skinned)
  skins: [],          // { name, tex }
  animClips: {},      // { idle, run, jump } — THREE.AnimationClip
  _targetHeight: 2.0,

  // Embedded data-URIs when available (works from file://), else relative paths.
  _url(folder, name, ext) {
    if (typeof EmbeddedAssets !== "undefined") {
      if (folder === "Model") return EmbeddedAssets.model;
      if (folder === "Animations") return EmbeddedAssets.anims[name];
      if (folder === "Skins") return EmbeddedAssets.skins[name];
    }
    return "Assets/characters/" + folder + "/" + name + "." + ext;
  },

  // Returns a promise. onProgress(pct, label) for the loading screen.
  load(onProgress) {
    const step = (pct, label) => onProgress && onProgress(pct, label);

    return new Promise((resolve, reject) => {
      const loader = new THREE.FBXLoader();
      loader.load(this._url("Model", "characterMedium", "fbx"),
        (obj) => {
          try {
            this._prepare(obj);
            step(0.5, "Loading character skins...");
            Promise.all([
              this._loadSkins(),
              this._loadAnims(),
            ]).then(() => {
              this.ready = true;
              resolve();
            }, reject);
          } catch (e) {
            reject(e);
          }
        },
        (xhr) => step(0.1 + 0.35 * (xhr.loaded / xhr.total), "Loading character model..."),
        (err) => reject(err)
      );
    });
  },

  // Scale to target height, feet at y=0.
  _prepare(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    const h = box.max.y - box.min.y;
    if (h > 0.01) obj.scale.setScalar(this._targetHeight / h);
    obj.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(obj);
    obj.position.y = -box2.min.y;
    obj.updateMatrixWorld(true);
    this.model = obj;
  },

  _loadSkins() {
    const names = ["criminalMaleA", "cyborgFemaleA", "skaterFemaleA", "skaterMaleA"];
    return Promise.all(names.map((name) => new Promise((res, rej) => {
      const t = new THREE.TextureLoader().load(
        this._url("Skins", name, "png"),
        (tex) => {
          tex.flipY = false;          // FBX UVs are bottom-left origin
          tex.encoding = THREE.sRGBEncoding;
          tex.anisotropy = 4;
          this.skins.push({ name, tex });
          res();
        },
        undefined,
        (err) => { console.warn("skin load failed:", name); res(); }
      );
    })));
  },

  _loadAnims() {
    const loader = new THREE.FBXLoader();
    const names = ["idle", "run", "jump"];
    return Promise.all(names.map((name) => new Promise((res) => {
      loader.load(this._url("Animations", name, "fbx"),
        (obj) => {
          if (obj.animations && obj.animations.length) {
            this.animClips[name] = obj.animations[0];
          }
          res();
        },
        undefined,
        () => res() // missing anim is non-fatal
      );
    })));
  },

  skinCount() {
    return this.skins.length;
  },

  // Deep-clone the template with its own skeleton (bones cloned per entity).
  make(skinIndex) {
    const g = this.model.clone();
    const boneMap = new Map();

    g.traverse((o) => {
      if (o.isSkinnedMesh && o.skeleton) {
        if (boneMap.size === 0) {
          o.skeleton.bones.forEach((b) => boneMap.set(b, b.clone()));
        }
        const bones = o.skeleton.bones.map((b) => boneMap.get(b));
        o.skeleton = new THREE.Skeleton(bones, o.skeleton.boneInverses.map((m) => m.clone()));
        o.bind(o.skeleton, o.bindMatrix.clone());

        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          m.map = this.skins[skinIndex].tex;
          m.needsUpdate = true;
        }
      }
    });

    g.userData.mixer = new THREE.AnimationMixer(g);
    g.userData.anim = "none";
    g.traverse((o) => { o.frustumCulled = false; });
    return g;
  },

  // Play a clip on a character group ("idle" | "run" | "jump"), fading between.
  playAnim(character, name, timeScale) {
    const u = character.userData;
    if (!u.mixer) return;
    if (u.anim === name) {
      if (u.action) u.action.timeScale = timeScale || 1;
      return;
    }
    const clip = this.animClips[name];
    if (!clip) return;
    const mixer = u.mixer;
    if (u.action) {
      u.action.fadeOut(0.15);
      u.action.stop();
    }
    u.action = mixer.clipAction(clip);
    u.action.reset().fadeIn(0.15).play();
    u.action.timeScale = timeScale || 1;
    u.anim = name;
  },

  updateMixers(dt) {
    for (const m of this._mixers || []) m.update(dt);
  },

  _mixers: [],
  _tracked: new Set(),
  track(character) {
    if (this._tracked.has(character)) return;
    this._tracked.add(character);
    this._mixers.push(character.userData.mixer);
  },
};