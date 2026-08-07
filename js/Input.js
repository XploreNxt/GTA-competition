"use strict";

// Central input state for keyboard + mouse. Polled every frame by the game.
const Input = {
  keys: {},
  mouseX: 0,
  mouseY: 0,
  mouseDown: false,

  _bound: false,

  init() {
    if (this._bound) return;
    this._bound = true;

    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      // Prevent page scroll on game keys.
      if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener("mousemove", (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });

    window.addEventListener("mousedown", (e) => {
      if (e.button === 0) this.mouseDown = true;
    });

    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouseDown = false;
    });

    // Clear keys when the window loses focus so the player doesn't get stuck.
    window.addEventListener("blur", () => {
      this.keys = {};
      this.mouseDown = false;
    });
  },

  // True if any of the given key codes is held.
  any(...codes) {
    for (const c of codes) {
      if (this.keys[c]) return true;
    }
    return false;
  },

  // Summed horizontal / vertical direction for WASD/arrow keys, in [-1, 1].
  axisH() {
    return (this.any("KeyD", "ArrowRight") ? 1 : 0) - (this.any("KeyA", "ArrowLeft") ? 1 : 0);
  },

  axisV() {
    return (this.any("KeyW", "ArrowUp") ? 1 : 0) - (this.any("KeyS", "ArrowDown") ? 1 : 0);
  },
};