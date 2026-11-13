/* =========================================================================
   SMASH FLASH - split screen platform fighter
   util.js: namespace, math, input, synth audio
   ========================================================================= */
const SF = (window.SF = window.SF || {});

/* ---------------------------------------------------------------- math --- */
SF.TAU = Math.PI * 2;
SF.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
SF.lerp = (a, b, t) => a + (b - a) * t;
SF.damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
SF.rand = (min, max) => min + Math.random() * (max - min);
SF.randInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
SF.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
SF.sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
SF.approach = (v, target, step) =>
  v < target ? Math.min(v + step, target) : Math.max(v - step, target);
SF.easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
SF.easeInCubic = (t) => t * t * t;
SF.easeOutBack = (t) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};
SF.deg = (d) => (d * Math.PI) / 180;
SF.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

SF.overlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/* mix a #rrggbb colour toward white (amt > 0) or black (amt < 0) */
SF.shade = (hex, amt) => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  const f = (c) => {
    const v = amt >= 0 ? c + (255 - c) * amt : c * (1 + amt);
    return Math.round(SF.clamp(v, 0, 255));
  };
  return `rgb(${f(r)},${f(g)},${f(b)})`;
};

SF.rgba = (hex, a) => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/* --------------------------------------------------------------- rules --- */
SF.STOCKS = 4;
SF.BLAST = { left: -1120, right: 1120, top: -1000, bottom: 820 };
SF.PHYS = {
  gravity: 2750,
  maxFall: 1400,
  groundAccel: 3400,
  friction: 3000,
  airAccel: 2000,
};
SF.STEP = 1 / 60;

/* --------------------------------------------------------------- input --- */
const KEYMAPS = [
  {
    left: "KeyA",
    right: "KeyD",
    up: "KeyW",
    down: "KeyS",
    attack: "KeyF",
    special: "KeyG",
    dodge: "KeyV",
    ult: "KeyT",
  },
  {
    left: "ArrowLeft",
    right: "ArrowRight",
    up: "ArrowUp",
    down: "ArrowDown",
    attack: "KeyK",
    special: "KeyL",
    dodge: "Semicolon",
    ult: "Quote",
  },
];

const SWALLOW = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
  "Tab",
  "Semicolon",
  "Quote",
  "Slash",
]);

class InputManager {
  constructor() {
    this.held = new Set();
    this.fresh = new Set(); // keys pressed since last frame
    this.anyKey = false;
    this.lastCode = "";

    window.addEventListener("keydown", (e) => {
      if (SWALLOW.has(e.code)) e.preventDefault();
      this.anyKey = true;
      this.lastCode = e.code;
      if (!this.held.has(e.code)) this.fresh.add(e.code);
      this.held.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      if (SWALLOW.has(e.code)) e.preventDefault();
      this.held.delete(e.code);
    });
    window.addEventListener("blur", () => {
      this.held.clear();
      this.fresh.clear();
    });
  }
  beginFrame() {
    this.snapshot = new Set(this.fresh);
    this.fresh.clear();
    this.anyKey = false;
  }
  down(code) {
    return this.held.has(code);
  }
  hit(code) {
    return this.snapshot ? this.snapshot.has(code) : false;
  }
  anyHit() {
    return this.snapshot ? this.snapshot.size > 0 : false;
  }
  /* held state + one-shot edges for a given player index */
  sample(player) {
    const m = KEYMAPS[player];
    return {
      left: this.down(m.left),
      right: this.down(m.right),
      up: this.down(m.up),
      down: this.down(m.down),
      jump: this.hit(m.up),
      attack: this.hit(m.attack),
      attackHeld: this.down(m.attack),
      special: this.hit(m.special),
      dodge: this.hit(m.dodge),
      ult: this.hit(m.ult),
    };
  }
  blank() {
    return {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      attack: false,
      attackHeld: false,
      special: false,
      dodge: false,
      ult: false,
    };
  }
}

/* --------------------------------------------------------------- audio --- */
SF.Sound = {
  ctx: null,
  master: null,
  muted: false,

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.42;
    this.master.connect(this.ctx.destination);
    const len = Math.floor(this.ctx.sampleRate * 0.6);
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },

  tone(o) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + (o.delay || 0);
    const dur = o.dur || 0.12;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = o.type || "square";
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.18, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  },

  noise(o) {
    if (!this.ctx || this.muted || !this.noiseBuf) return;
    const t0 = this.ctx.currentTime + (o.delay || 0);
    const dur = o.dur || 0.15;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = o.type || "bandpass";
    f.frequency.setValueAtTime(o.freq || 1400, t0);
    if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(80, o.to), t0 + dur);
    f.Q.value = o.q || 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(o.vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  },

  jump() {
    this.tone({ freq: 320, to: 660, dur: 0.11, type: "square", vol: 0.1 });
  },
  airJump() {
    this.tone({ freq: 480, to: 900, dur: 0.1, type: "triangle", vol: 0.1 });
  },
  land() {
    this.noise({ dur: 0.08, freq: 500, to: 160, vol: 0.12 });
  },
  swing() {
    this.noise({ dur: 0.13, freq: 2400, to: 700, vol: 0.09, q: 0.7 });
  },
  hit(power) {
    const p = SF.clamp(power, 0, 1);
    this.noise({ dur: 0.1 + p * 0.08, freq: 1900 - p * 900, to: 240, vol: 0.16 + p * 0.1 });
    this.tone({ freq: 150 + p * 90, to: 60, dur: 0.13 + p * 0.1, type: "square", vol: 0.1 + p * 0.08 });
  },
  ko() {
    this.noise({ dur: 0.7, freq: 900, to: 90, vol: 0.3, q: 0.5 });
    this.tone({ freq: 200, to: 40, dur: 0.6, type: "sawtooth", vol: 0.18 });
    this.tone({ freq: 740, to: 120, dur: 0.4, type: "square", vol: 0.12, delay: 0.04 });
  },
  special(kind) {
    if (kind === "fire") {
      this.noise({ dur: 0.3, freq: 900, to: 300, vol: 0.18, q: 0.6 });
      this.tone({ freq: 260, to: 120, dur: 0.22, type: "sawtooth", vol: 0.1 });
    } else if (kind === "ice") {
      this.tone({ freq: 1500, to: 2200, dur: 0.16, type: "triangle", vol: 0.12 });
      this.noise({ dur: 0.16, freq: 3200, vol: 0.08, q: 2 });
    } else if (kind === "dash") {
      this.noise({ dur: 0.24, freq: 2600, to: 800, vol: 0.14, q: 0.9 });
      this.tone({ freq: 640, to: 980, dur: 0.14, type: "square", vol: 0.08 });
    } else {
      this.tone({ freq: 180, to: 70, dur: 0.34, type: "sawtooth", vol: 0.16 });
      this.noise({ dur: 0.34, freq: 600, to: 120, vol: 0.16 });
    }
  },
  dodge() {
    this.noise({ dur: 0.12, freq: 1700, to: 4000, vol: 0.07, type: "highpass" });
  },
  select() {
    this.tone({ freq: 660, to: 990, dur: 0.08, type: "square", vol: 0.09 });
  },
  move() {
    this.tone({ freq: 420, dur: 0.05, type: "square", vol: 0.05 });
  },
  ult() {
    this.tone({ freq: 110, to: 880, dur: 0.5, type: "sawtooth", vol: 0.16 });
    this.tone({ freq: 360, to: 1360, dur: 0.42, type: "square", vol: 0.09, delay: 0.05 });
    this.noise({ dur: 0.75, freq: 420, to: 3000, vol: 0.16, q: 0.7 });
    [880, 1180, 1480, 1760].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.13, type: "triangle", vol: 0.08, delay: 0.28 + i * 0.055 })
    );
  },
  start() {
    [523, 659, 784, 1046].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.16, type: "square", vol: 0.1, delay: i * 0.07 })
    );
  },
  tick() {
    this.tone({ freq: 880, dur: 0.05, type: "square", vol: 0.07 });
  },
};

SF.input = new InputManager();
