/* =========================================================================
   game.js: match flow, screens, cameras, main loop
   ========================================================================= */
(function () {
  const G = (SF.Game = {
    state: "title",
    time: 0,
    last: 0,
    mode: 0,
    cursor: [0, 3],
    locked: [false, false],
    fighters: [],
    cams: [],
    panels: [],
    countdown: 0,
    countdownPlayed: false,
    elapsed: 0,
    winner: null,
    resultT: 0,
    koFlash: 0,
    koText: "",
    endTimer: 0,
    prevStocks: [],
    acc: 0,
    layoutMode: "",

    init(canvas) {
      SF.Render.init(canvas);
      this.layout();
      this.cams = [
        { x: 0, y: -20, zoom: 1.05 },
        { x: 0, y: -20, zoom: 1.05 },
      ];
      this.last = performance.now();

      const wake = () => SF.Sound.init();
      window.addEventListener("keydown", wake, { once: true });
      window.addEventListener("pointerdown", wake, { once: true });

      const frame = (now) => {
        const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
        this.last = now;
        this.time += dt;
        this.update(dt);
        this.render();
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    },

    layout() {
      const s = SF.Render.size();
      const vertical = s.w >= 620;
      const gap = Math.max(3, Math.min(10, Math.round(Math.min(s.w, s.h) * 0.008)));
      if (vertical) {
        const half = (s.w - gap) / 2;
        this.panels = [
          { x: 0, y: 0, w: half, h: s.h },
          { x: half + gap, y: 0, w: half, h: s.h },
        ];
      } else {
        const half = (s.h - gap) / 2;
        this.panels = [
          { x: 0, y: 0, w: s.w, h: half },
          { x: 0, y: half + gap, w: s.w, h: half },
        ];
      }
      this.layoutMode = vertical ? "v" : "h";
    },

    /* --------------------------------------------------------------- flow */
    update(dt) {
      SF.input.beginFrame();
      if (SF.input.hit("KeyM")) SF.Sound.muted = !SF.Sound.muted;

      if (this.state === "title") this.updateTitle(dt);
      else if (this.state === "select") this.updateSelect(dt);
      else if (this.state === "fight") this.updateFight(dt);
      else if (this.state === "pause") this.updatePause(dt);
      else if (this.state === "results") this.updateResults(dt);
    },

    updateTitle() {
      const i = SF.input;
      if (i.hit("KeyA") || i.hit("ArrowLeft")) {
        this.mode = 0;
        SF.Sound.move();
      }
      if (i.hit("KeyD") || i.hit("ArrowRight")) {
        this.mode = 1;
        SF.Sound.move();
      }
      if (i.hit("KeyW") || i.hit("ArrowUp") || i.hit("KeyS") || i.hit("ArrowDown")) {
        this.mode = this.mode ? 0 : 1;
        SF.Sound.move();
      }
      if (i.hit("Enter") || i.hit("Space") || i.hit("KeyF") || i.hit("KeyK")) {
        this.state = "select";
        this.locked = [false, false];
        this.cursor = [0, 3];
        SF.Sound.select();
      }
    },

    gridCols() {
      const n = SF.ROSTER.length;
      const rows = Math.ceil(n / 7);
      return Math.ceil(n / rows);
    },

    updateSelect() {
      const i = SF.input;
      const n = SF.ROSTER.length;
      const cols = this.gridCols();

      if (!this.locked[0]) {
        if (i.hit("KeyA")) {
          this.cursor[0] = (this.cursor[0] + n - 1) % n;
          SF.Sound.move();
        }
        if (i.hit("KeyD")) {
          this.cursor[0] = (this.cursor[0] + 1) % n;
          SF.Sound.move();
        }
        if (i.hit("KeyW")) {
          this.cursor[0] = (this.cursor[0] - cols + n) % n;
          SF.Sound.move();
        }
        if (i.hit("KeyS")) {
          this.cursor[0] = (this.cursor[0] + cols) % n;
          SF.Sound.move();
        }
        if (i.hit("KeyF") || i.hit("Enter")) {
          this.locked[0] = true;
          SF.Sound.select();
          if (this.mode === 1) {
            this.cursor[1] = SF.randInt(0, n - 1);
            this.locked[1] = true;
          }
        }
      } else if (i.hit("KeyV")) {
        this.locked[0] = false;
        SF.Sound.move();
      }

      if (this.mode === 0) {
        if (!this.locked[1]) {
          if (i.hit("ArrowLeft")) {
            this.cursor[1] = (this.cursor[1] + n - 1) % n;
            SF.Sound.move();
          }
          if (i.hit("ArrowRight")) {
            this.cursor[1] = (this.cursor[1] + 1) % n;
            SF.Sound.move();
          }
          if (i.hit("ArrowUp")) {
            this.cursor[1] = (this.cursor[1] - cols + n) % n;
            SF.Sound.move();
          }
          if (i.hit("ArrowDown")) {
            this.cursor[1] = (this.cursor[1] + cols) % n;
            SF.Sound.move();
          }
          if (i.hit("KeyK")) {
            this.locked[1] = true;
            SF.Sound.select();
          }
        } else if (i.hit("Semicolon")) {
          this.locked[1] = false;
          SF.Sound.move();
        }
      }

      const ready = this.locked[0] && (this.mode === 1 || this.locked[1]);
      if (ready && (i.hit("Enter") || i.hit("Space"))) this.startMatch();
      if (i.hit("Escape")) {
        this.state = "title";
        SF.Sound.move();
      }
    },

    startMatch() {
      this.fighters = [
        new Fighter(SF.ROSTER[this.cursor[0]], 0, SF.STAGE.spawns[0].x, 30),
        new Fighter(SF.ROSTER[this.cursor[1]], 1, SF.STAGE.spawns[1].x, 30),
      ];
      SF.World.reset();
      this.layout();
      this.cams = [
        { x: -90, y: -30, zoom: 1.0 },
        { x: 90, y: -30, zoom: 1.0 },
      ];
      this.countdown = 3.2;
      this.countdownPlayed = false;
      this.elapsed = 0;
      this.winner = null;
      this.resultT = 0;
      this.koFlash = 0;
      this.koText = "";
      this.endTimer = 0;
      this.acc = 0;
      this.prevStocks = [SF.STOCKS, SF.STOCKS];
      this.state = "fight";
      SF.Sound.init();
      SF.Sound.start();
      for (const f of this.fighters) {
        SF.World.ring(f.x, f.y - 20, f.palette.accent, 26);
      }
    },

    updateFight(dt) {
      const i = SF.input;
      if (i.hit("Escape")) {
        this.state = "pause";
        SF.Sound.move();
        return;
      }

      this.elapsed += dt;
      this.koFlash = Math.max(0, this.koFlash - dt * 1.15);

      if (this.countdown > 0) {
        const before = Math.ceil(this.countdown);
        this.countdown -= dt;
        if (Math.ceil(this.countdown) !== before) SF.Sound.tick();
        if (this.countdown <= 0.25 && !this.countdownPlayed) {
          this.countdownPlayed = true;
          SF.Sound.tone({ freq: 520, to: 1180, dur: 0.24, type: "square", vol: 0.15 });
        }
      }

      const locked = this.countdown > 0.25;
      const s1 = SF.input.sample(0);
      const s2 = this.mode === 1 ? SF.CPU.sample(this.fighters[1], this.fighters[0], dt) : SF.input.sample(1);
      const blank = SF.input.blank();
      const inputs = locked ? [blank, blank] : [s1, s2];

      this.acc += dt;
      let steps = 0;
      while (this.acc >= SF.STEP && steps < 5) {
        this.step(SF.STEP, inputs);
        this.acc -= SF.STEP;
        steps++;
      }
      if (steps >= 5) this.acc = 0;

      this.layout();
      for (let p = 0; p < 2; p++) this.updateCam(p, dt);

      if (!this.winner && this.fighters.some((f) => f.dead)) {
        this.endTimer -= dt;
        if (this.endTimer <= 0) {
          const alive = this.fighters.filter((f) => !f.dead);
          this.winner = alive[0] || this.fighters.slice().sort((a, b) => b.stocks - a.stocks)[0];
          this.state = "results";
          this.resultT = 0;
          this.koFlash = 0;
          SF.Sound.start();
        }
      }
    },

    step(dt, inputs) {
      const a = this.fighters[0];
      const b = this.fighters[1];
      a.update(dt, inputs[0], b);
      b.update(dt, inputs[1], a);
      a.updateKo();
      b.updateKo();
      SF.World.update(dt, this.fighters);

      for (let p = 0; p < 2; p++) {
        const f = this.fighters[p];
        if (f.stocks < this.prevStocks[p]) {
          this.prevStocks[p] = f.stocks;
          this.koFlash = 0.9;
          this.koText = f.name + (f.dead ? " IS OUT!" : " LOST A STOCK");
          this.endTimer = 1.25;
        }
      }
    },

    updateCam(p, dt) {
      const f = this.fighters[p];
      const foe = this.fighters[1 - p];
      const panel = this.panels[p];
      const cam = this.cams[p];
      if (!f || !foe || !panel || !cam) return;

      const focusX = f.x * 0.66 + foe.x * 0.34;
      const focusY = (f.y - 38) * 0.66 + (foe.y - 38) * 0.34;
      const dx = Math.abs(f.x - foe.x);
      const dy = Math.abs(f.y - foe.y);
      const needW = dx + 460;
      const needH = dy + 500;
      const target = SF.clamp(Math.min(panel.w / needW, panel.h / needH) * 1.04, 0.55, 1.6);

      cam.zoom = SF.damp(cam.zoom, target, 4.2, dt);
      cam.x = SF.damp(cam.x, focusX, 7, dt);
      cam.y = SF.damp(cam.y, focusY, 7, dt);
    },

    updatePause() {
      const i = SF.input;
      if (i.hit("Escape")) {
        this.state = "fight";
        SF.Sound.move();
      } else if (i.hit("Enter")) {
        this.state = "select";
        this.locked = [false, false];
        SF.Sound.move();
      }
    },

    updateResults(dt) {
      this.resultT += dt;
      const i = SF.input;
      if (this.resultT < 0.5) return;
      if (i.hit("Enter") || i.hit("Space") || i.hit("KeyF") || i.hit("KeyK")) {
        this.startMatch();
      } else if (i.hit("Escape")) {
        this.state = "select";
        this.locked = [false, false];
        SF.Sound.move();
      }
    },

    /* ------------------------------------------------------------- render */
    render() {
      SF.Render.begin();
      if (this.state === "title") {
        SF.Render.title(this);
      } else if (this.state === "select") {
        SF.Render.select(this);
      } else if (this.state === "fight" || this.state === "pause" || this.state === "results") {
        this.renderFight();
        if (this.state === "pause") SF.Render.pause(this);
        if (this.state === "results") SF.Render.results(this);
      }
      SF.Render.koBanner(this);
    },

    renderFight() {
      if (!this.fighters.length) return;
      this.layout();
      for (let p = 0; p < 2; p++) {
        const f = this.fighters[p];
        if (!f) continue;
        SF.Render.drawPanel(this.panels[p], this.cams[p], this, f);
        SF.Render.hud(this.panels[p], f, this);
        if (this.countdown > 0) SF.Render.countdown(this, this.panels[p]);
      }
    },
  });

  window.addEventListener("load", () => {
    const canvas = document.getElementById("game");
    if (canvas) G.init(canvas);
  });
})();
