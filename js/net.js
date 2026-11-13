/* =========================================================================
   net.js: online play over WebRTC (PeerJS handles the handshake)
   One player hosts and simulates the whole match, the other sends inputs and
   renders the snapshots it receives. No server of our own is involved.
   ========================================================================= */
(function () {
  const PREFIX = "smashflash-v1-";
  const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0 or 1
  const CODE_LEN = 5;
  const SNAP_RATE = 1 / 30;

  /* ------------------------------------------------------- remote fighter */
  class Remote {
    constructor(char, index) {
      this.char = char;
      this.index = index;
      this.name = char.name;
      this.palette = char.palette;
      this.runSpeed = 336 * char.stats.speed;
      this.x = 0;
      this.y = 0;
      this.tx = 0;
      this.ty = 0;
      this.vx = 0;
      this.vy = 0;
      this.facing = 1;
      this.state = "idle";
      this.attack = null;
      this.spec = null;
      this.animT = 0;
      this.runCycle = 0;
      this.landSquash = 0;
      this.flash = 0;
      this.frozen = 0;
      this.invuln = 0;
      this.specialCd = 0;
      this.damage = 0;
      this.stocks = SF.STOCKS;
      this.dead = false;
      this.hh = 48;
    }

    get alive() {
      return !this.dead && this.state !== "ko";
    }

    get hurtbox() {
      return { x: this.x - 15, y: this.y - this.hh, w: 30, h: this.hh };
    }
  }

  /* ------------------------------------------------------------- helpers */
  function txt(c, s, x, y, size, color, align, weight) {
    c.font = `${weight || 900} italic ${size}px "Trebuchet MS", "Segoe UI", system-ui, sans-serif`;
    c.textAlign = align || "center";
    c.textBaseline = "alphabetic";
    c.lineWidth = Math.max(3, size * 0.13);
    c.strokeStyle = "#0b0a14";
    c.lineJoin = "round";
    c.strokeText(s, x, y);
    c.fillStyle = color;
    c.fillText(s, x, y);
  }

  function panel(c, x, y, w, h, color) {
    c.beginPath();
    const r = 10;
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
    c.fillStyle = "rgba(8,8,20,0.75)";
    c.fill();
    c.strokeStyle = color || "rgba(255,255,255,0.25)";
    c.lineWidth = 2;
    c.stroke();
  }

  function fighterPreview(c, char, x, y, scale, t) {
    SF.Render.drawFighter(
      {
        x,
        y,
        facing: 1,
        palette: char.palette,
        char,
        animT: t,
        state: "idle",
        attack: null,
        runCycle: 0,
        landSquash: 0,
        flash: 0,
        frozen: 0,
      },
      { scale, tag: null }
    );
  }

  /* ------------------------------------------------------------------ net */
  const N = (SF.Net = {
    phase: "menu", // menu | host-wait | join-entry | join-wait | ready | error
    role: "", // host | guest
    code: "",
    status: "",
    error: "",
    menuCursor: 0,
    codeInput: "",
    peer: null,
    conn: null,
    pick: 0,
    remotePick: 4,
    inQueue: [],
    lastIn: null,
    snapAcc: 0,
    sentCount: 0,

    /* ---------------------------------------------------------- lifecycle */
    open() {
      this.reset(false);
      this.phase = "menu";
      this.menuCursor = 0;
      this.pick = 0;
      this.remotePick = 4;
      SF.Game.state = "online";
      SF.Sound.init();
      SF.Sound.select();
    },

    backToMenu() {
      this.reset(true);
      this.phase = "menu";
      this.menuCursor = 0;
    },

    leave() {
      if (this.conn) {
        try {
          this.send({ t: "bye" });
        } catch (e) {
          /* the other side is already gone */
        }
      }
      this.reset(true);
      const G = SF.Game;
      G.state = "title";
      G.onlineRole = "";
      G.winner = null;
      G.fighters = [];
      SF.World.reset();
      SF.Sound.move();
    },

    reset(closePeer) {
      if (this.conn) {
        try {
          this.conn.close();
        } catch (e) {
          /* ignore */
        }
      }
      if (closePeer && this.peer) {
        try {
          this.peer.destroy();
        } catch (e) {
          /* ignore */
        }
      }
      this.conn = null;
      this.peer = null;
      this.role = "";
      this.status = "";
      this.error = "";
      this.inQueue.length = 0;
      this.lastIn = null;
      this.snapAcc = 0;
      this.codeInput = "";
      SF.Game.onlineRole = "";
    },

    fail(msg) {
      this.error = msg;
      this.phase = "error";
      SF.Sound.hit(0.4);
    },

    makeCode() {
      let s = "";
      for (let i = 0; i < CODE_LEN; i++) s += ALPHA[SF.randInt(0, ALPHA.length - 1)];
      return s;
    },

    /* ------------------------------------------------------------ connect */
    host() {
      if (typeof window.Peer === "undefined") {
        this.fail("The network library did not load. Check your connection and reload.");
        return;
      }
      this.role = "host";
      this.code = this.makeCode();
      this.phase = "host-wait";
      this.status = "Opening a room...";
      SF.Sound.select();
      const peer = new window.Peer(PREFIX + this.code, { debug: 0 });
      this.peer = peer;
      peer.on("open", () => {
        this.status = "Waiting for your opponent";
      });
      peer.on("connection", (conn) => this.attach(conn, true));
      peer.on("error", (e) => this.peerError(e));
      peer.on("disconnected", () => {
        try {
          peer.reconnect();
        } catch (e) {
          /* ignore */
        }
      });
    },

    startTyping() {
      this.phase = "join-entry";
      this.codeInput = "";
      SF.Sound.select();
    },

    join(code) {
      const c = (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (c.length !== CODE_LEN) {
        this.error = "That code is " + c.length + " characters - it should be " + CODE_LEN + ".";
        SF.Sound.hit(0.3);
        return;
      }
      if (typeof window.Peer === "undefined") {
        this.fail("The network library did not load. Check your connection and reload.");
        return;
      }
      this.role = "guest";
      this.code = c;
      this.phase = "join-wait";
      this.status = "Connecting...";
      SF.Sound.select();
      const peer = new window.Peer({ debug: 0 });
      this.peer = peer;
      peer.on("open", () => {
        const conn = peer.connect(PREFIX + c, { reliable: true, serialization: "json" });
        this.attach(conn, false);
      });
      peer.on("error", (e) => this.peerError(e));
    },

    peerError(e) {
      const type = e && e.type ? e.type : "";
      if (type === "peer-unavailable") {
        this.fail("No room with that code. Check the code and try again.");
      } else if (type === "unavailable-id") {
        this.fail("That room code was just taken. Go back and host again.");
      } else if (type === "browser-incompatible") {
        this.fail("This browser cannot make peer-to-peer connections.");
      } else if (type === "network" || type === "server-error" || type === "socket-error") {
        this.fail("Could not reach the matchmaking service. Check your connection.");
      } else {
        this.fail(e && e.message ? e.message : "Connection failed.");
      }
    },

    attach(conn, isHost) {
      this.conn = conn;
      conn.on("open", () => {
        this.phase = "ready";
        this.status = "";
        SF.Sound.select();
        if (isHost) this.send({ t: "hi", i: this.pick });
        else this.send({ t: "hi", i: this.pick });
      });
      conn.on("data", (d) => this.onData(d));
      conn.on("close", () => this.onDrop());
      conn.on("error", () => this.onDrop());
    },

    send(msg) {
      if (!this.conn) return;
      try {
        this.conn.send(msg);
        this.sentCount++;
      } catch (e) {
        /* dropped packet, the next one will carry the state */
      }
    },

    onDrop() {
      if (!this.conn && this.phase === "error") return;
      const wasFighting = SF.Game.state === "fight" || SF.Game.state === "results";
      this.reset(true);
      this.phase = "error";
      this.error = wasFighting ? "Your opponent left the match." : "The connection closed.";
      SF.Game.state = "online";
      SF.Game.onlineRole = "";
    },

    onData(d) {
      if (!d || typeof d !== "object") return;
      switch (d.t) {
        case "hi":
          this.remotePick = typeof d.i === "number" ? d.i : this.remotePick;
          break;
        case "in":
          this.pushInput(d);
          break;
        case "s":
          this.applySnapshot(d);
          break;
        case "start":
          this.startGuest(d.c);
          break;
        case "over":
          this.guestOver(d.w);
          break;
        case "bye":
          this.onDrop();
          break;
      }
    },

    /* -------------------------------------------------------------- lobby */
    tick(dt) {
      const i = SF.input;

      if (this.phase === "error") {
        if (i.hit("Enter") || i.hit("Space") || i.hit("Escape")) this.backToMenu();
        return;
      }

      if (this.phase === "menu") {
        if (i.hit("KeyW") || i.hit("ArrowUp") || i.hit("KeyA") || i.hit("ArrowLeft")) {
          this.menuCursor = 0;
          SF.Sound.move();
        }
        if (i.hit("KeyS") || i.hit("ArrowDown") || i.hit("KeyD") || i.hit("ArrowRight")) {
          this.menuCursor = 1;
          SF.Sound.move();
        }
        if (i.hit("Enter") || i.hit("Space")) {
          if (this.menuCursor === 0) this.host();
          else this.startTyping();
        }
        if (i.hit("Escape")) this.leave();
        return;
      }

      if (this.phase === "join-entry") {
        this.typeCode();
        if (i.hit("Enter")) this.join(this.codeInput);
        else if (i.hit("Escape")) this.backToMenu();
        return;
      }

      if (this.phase === "host-wait" || this.phase === "join-wait") {
        if (i.hit("Escape")) this.leave();
        return;
      }

      if (this.phase === "ready") {
        if (i.hit("Escape")) {
          this.leave();
          return;
        }
        const range = SF.ROSTER.length;
        if (i.hit("KeyA") || i.hit("ArrowLeft")) {
          this.pick = (this.pick + range - 1) % range;
          this.send({ t: "hi", i: this.pick });
          SF.Sound.move();
        }
        if (i.hit("KeyD") || i.hit("ArrowRight")) {
          this.pick = (this.pick + 1) % range;
          this.send({ t: "hi", i: this.pick });
          SF.Sound.move();
        }
        if (this.role === "host" && (i.hit("Enter") || i.hit("Space"))) this.beginMatch();
      }
    },

    typeCode() {
      const snap = SF.input.snapshot;
      if (!snap) return;
      for (const code of snap) {
        if (code.indexOf("Key") === 0) {
          const ch = code.slice(3);
          if (/^[A-Z]$/.test(ch) && this.codeInput.length < CODE_LEN) {
            this.codeInput += ch;
            SF.Sound.move();
          }
        } else if (code.indexOf("Digit") === 0) {
          const ch = code.slice(5);
          if (/^[0-9]$/.test(ch) && this.codeInput.length < CODE_LEN) {
            this.codeInput += ch;
            SF.Sound.move();
          }
        } else if (code === "Backspace") {
          this.codeInput = this.codeInput.slice(0, -1);
          SF.Sound.move();
        }
      }
    },

    /* -------------------------------------------------------------- match */
    beginMatch() {
      const G = SF.Game;
      const a = this.pick;
      const b = this.remotePick;
      G.onlineRole = "host";
      G.fighters = [
        new Fighter(SF.ROSTER[a], 0, SF.STAGE.spawns[0].x, 30),
        new Fighter(SF.ROSTER[b], 1, SF.STAGE.spawns[1].x, 30),
      ];
      SF.World.reset();
      this.resetFight();
      G.state = "fight";
      this.send({ t: "start", c: [SF.ROSTER[a].key, SF.ROSTER[b].key] });
      SF.Sound.init();
      SF.Sound.start();
    },

    resetFight() {
      const G = SF.Game;
      G.layout();
      G.cams = [
        { x: -90, y: -30, zoom: 1.0 },
        { x: 90, y: -30, zoom: 1.0 },
      ];
      G.countdown = 2.4;
      G.countdownPlayed = true;
      G.elapsed = 0;
      G.winner = null;
      G.resultT = 0;
      G.koFlash = 0;
      G.koText = "";
      G.endTimer = 0;
      G.acc = 0;
      G.prevStocks = [SF.STOCKS, SF.STOCKS];
      this.inQueue.length = 0;
      this.lastIn = null;
      this.snapAcc = 0;
    },

    startGuest(keys) {
      const G = SF.Game;
      if (!keys || keys.length < 2) return;
      G.onlineRole = "guest";
      G.fighters = [new Remote(SF.charByKey(keys[0]), 0), new Remote(SF.charByKey(keys[1]), 1)];
      SF.World.reset();
      this.resetFight();
      G.state = "fight";
      SF.Sound.init();
      SF.Sound.start();
    },

    guestOver(w) {
      const G = SF.Game;
      G.winner = G.fighters[w] || G.fighters[0];
      G.state = "results";
      G.resultT = 0;
      SF.Sound.start();
    },

    fightTick(dt) {
      if (this.role === "host") this.hostTick(dt);
      else if (this.role === "guest") this.guestTick(dt);
    },

    /* --------------------------------------------------------------- host */
    hostTick(dt) {
      const G = SF.Game;
      if (SF.input.hit("Escape")) {
        this.leave();
        return;
      }

      G.elapsed += dt;
      G.koFlash = Math.max(0, G.koFlash - dt * 1.15);
      if (G.countdown > 0) G.countdown -= dt;

      const local = SF.input.sample(0);
      const frozen = G.countdown > 0.25;

      G.acc += dt;
      let steps = 0;
      while (G.acc >= SF.STEP && steps < 5) {
        const p1 = frozen ? SF.input.blank() : local;
        const p2 = frozen ? SF.input.blank() : this.takeGuestInput();
        G.step(SF.STEP, [p1, p2]);
        G.acc -= SF.STEP;
        steps++;
        this.snapAcc += SF.STEP;
        if (this.snapAcc >= SNAP_RATE) {
          this.snapAcc = 0;
          this.send(this.snapshot());
        }
      }
      if (steps >= 5) G.acc = 0;

      G.layout();
      for (let p = 0; p < 2; p++) G.updateCam(p, dt);

      if (!G.winner && G.fighters.some((f) => f.dead)) {
        G.endTimer -= dt;
        if (G.endTimer <= 0) {
          const alive = G.fighters.filter((f) => !f.dead);
          G.winner = alive[0] || G.fighters.slice().sort((a, b) => b.stocks - a.stocks)[0];
          this.send({ t: "over", w: G.winner.index });
          G.state = "results";
          G.resultT = 0;
          G.koFlash = 0;
          SF.Sound.start();
        }
      }
    },

    pushInput(pkt) {
      const q = this.inQueue;
      if (q.length >= 6) {
        let dropAt = 0;
        for (let i = 0; i < q.length; i++) {
          const p = q[i];
          if (!(p.a || p.s || p.g || p.ju)) {
            dropAt = i;
            break;
          }
        }
        q.splice(dropAt, 1);
      }
      q.push(pkt);
    },

    takeGuestInput() {
      const pkt = this.inQueue.shift();
      if (!pkt) {
        const last = this.lastIn;
        return last ? this.fromPacket(last, false) : SF.input.blank();
      }
      this.lastIn = pkt;
      return this.fromPacket(pkt, true);
    },

    fromPacket(p, withEdges) {
      return {
        left: !!p.l,
        right: !!p.r,
        up: !!p.u,
        down: !!p.d,
        jump: !!(withEdges && p.ju),
        attack: !!(withEdges && p.a),
        attackHeld: !!(p.ah || p.a),
        special: !!(withEdges && p.s),
        dodge: !!(withEdges && p.g),
      };
    },

    snapshot() {
      const G = SF.Game;
      const f = G.fighters.map((x) => [
        x.char.key,
        Math.round(x.x),
        Math.round(x.y),
        x.facing,
        x.state,
        Math.round(x.damage),
        x.stocks,
        x.dead ? 1 : 0,
        +x.animT.toFixed(2),
        +x.runCycle.toFixed(2),
        +x.landSquash.toFixed(2),
        +x.flash.toFixed(2),
        +x.frozen.toFixed(2),
        +x.invuln.toFixed(2),
        +x.specialCd.toFixed(2),
        x.attack ? x.attack.kind : 0,
        x.attack ? x.attack.phase : 0,
        x.attack ? +x.attack.t.toFixed(3) : 0,
        x.attack ? +x.attack.power.toFixed(2) : 0,
        x.spec ? x.spec.kind : 0,
        Math.round(x.vx),
      ]);
      const p = SF.World.projectiles.map((q) => [
        q.kind,
        q.style || "",
        q.color || "",
        Math.round(q.x),
        Math.round(q.y),
        Math.round(q.vx || 0),
        Math.round(q.r || 14),
        +(q.t || 0).toFixed(2),
        +(q.dur || 0).toFixed(2),
        q.circle ? 1 : 0,
        q.owner && typeof q.owner.index === "number" ? q.owner.index : -1,
      ]);
      return {
        t: "s",
        cd: +G.countdown.toFixed(2),
        el: +G.elapsed.toFixed(1),
        kf: +G.koFlash.toFixed(2),
        kt: G.koText,
        sh: +SF.World.shake.toFixed(1),
        f: f,
        p: p,
      };
    },

    /* -------------------------------------------------------------- guest */
    guestTick(dt) {
      const G = SF.Game;
      if (SF.input.hit("Escape")) {
        this.leave();
        return;
      }

      const s = SF.input.sample(0);
      this.send({
        t: "in",
        l: s.left ? 1 : 0,
        r: s.right ? 1 : 0,
        u: s.up ? 1 : 0,
        d: s.down ? 1 : 0,
        ju: s.jump ? 1 : 0,
        a: s.attack ? 1 : 0,
        ah: s.attackHeld ? 1 : 0,
        s: s.special ? 1 : 0,
        g: s.dodge ? 1 : 0,
      });

      SF.World.update(dt, []);
      for (const f of G.fighters) {
        f.x = SF.damp(f.x, f.tx, 26, dt);
        f.y = SF.damp(f.y, f.ty, 26, dt);
      }
      G.layout();
      for (let p = 0; p < 2; p++) G.updateCam(p, dt);
    },

    applySnapshot(d) {
      const G = SF.Game;
      if (G.onlineRole !== "guest" || !G.fighters.length) return;
      G.countdown = d.cd;
      G.elapsed = d.el;
      G.koFlash = d.kf;
      G.koText = d.kt;
      SF.World.shake = d.sh;

      d.f.forEach((a, i) => {
        const f = G.fighters[i];
        if (!f) return;
        const wasFlash = f.flash;
        f.tx = a[1];
        f.ty = a[2];
        f.facing = a[3];
        f.state = a[4];
        f.damage = a[5];
        f.stocks = a[6];
        f.dead = !!a[7];
        f.animT = a[8];
        f.runCycle = a[9];
        f.landSquash = a[10];
        f.flash = a[11];
        f.frozen = a[12];
        f.invuln = a[13];
        f.specialCd = a[14];
        f.attack = a[15]
          ? { kind: a[15], phase: a[16], t: a[17], power: a[18], def: f.char.moves[a[15]], hit: new Set() }
          : null;
        f.spec = a[19] ? { kind: a[19] } : null;
        f.vx = a[20];
        if (f.flash > 0.9 && wasFlash < 0.5) SF.World.hitSpark(f.x, f.y - 26, 0.45, f.palette.accent);
      });

      const prs = SF.World.projectiles;
      prs.length = 0;
      d.p.forEach((a) => {
        prs.push({
          kind: a[0],
          style: a[1],
          color: a[2],
          x: a[3],
          y: a[4],
          vx: a[5],
          vy: 0,
          r: a[6],
          t: a[7],
          dur: a[8] || 0.3,
          circle: !!a[9],
          owner: a[10] >= 0 ? G.fighters[a[10]] : null,
          hit: new Set(),
          life: 1,
        });
      });
    },

    /* --------------------------------------------------------------- draw */
    draw(game) {
      const c = document.getElementById("game").getContext("2d");
      const { w, h } = SF.Render.size();
      const t = game.time;

      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#070716");
      g.addColorStop(0.6, "#1a1040");
      g.addColorStop(1, "#3a1236");
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);

      txt(c, "ONLINE PLAY", w / 2, h * 0.12, Math.max(20, w * 0.032), "#ffffff");

      if (this.phase === "menu") {
        const opts = ["HOST A MATCH", "JOIN WITH A CODE"];
        opts.forEach((o, i) => {
          const y = h * (0.4 + i * 0.14);
          const sel = this.menuCursor === i;
          if (sel) panel(c, w / 2 - 190, y - 40, 380, 58, "#ffe066");
          txt(c, o, w / 2, y, Math.max(16, w * 0.019), sel ? "#ffe066" : "rgba(255,255,255,0.5)");
        });
        txt(c, "HOST GETS A CODE, YOUR OPPONENT TYPES IT IN", w / 2, h * 0.72, Math.max(11, w * 0.0125), "rgba(255,255,255,0.55)", "center", 700);
        txt(c, "↑ ↓ CHOOSE    ENTER CONFIRM    ESC BACK", w / 2, h - 26, Math.max(11, w * 0.0125), "rgba(255,255,255,0.45)", "center", 700);
        return;
      }

      if (this.phase === "host-wait") {
        txt(c, "ROOM CODE", w / 2, h * 0.3, Math.max(13, w * 0.014), "rgba(255,255,255,0.6)");
        panel(c, w / 2 - 200, h * 0.34, 400, 90, "#4cc9f0");
        txt(c, this.code, w / 2, h * 0.34 + 64, Math.max(34, w * 0.056), "#4cc9f0");
        const dots = ".".repeat(1 + (Math.floor(t * 2) % 3));
        txt(c, this.status.toUpperCase() + dots, w / 2, h * 0.55, Math.max(13, w * 0.015), "rgba(255,255,255,0.75)");
        txt(c, "GIVE THE CODE TO A FRIEND, KEEP THIS PAGE OPEN", w / 2, h * 0.62, Math.max(11, w * 0.0125), "rgba(255,255,255,0.45)", "center", 700);
        txt(c, "ESC CANCEL", w / 2, h - 26, Math.max(11, w * 0.0125), "rgba(255,255,255,0.45)", "center", 700);
        return;
      }

      if (this.phase === "join-entry") {
        txt(c, "ENTER THE ROOM CODE", w / 2, h * 0.3, Math.max(13, w * 0.015), "rgba(255,255,255,0.7)");
        panel(c, w / 2 - 190, h * 0.34, 380, 78, this.codeInput.length === CODE_LEN ? "#7dffb0" : "#f72585");
        let shown = "";
        for (let i = 0; i < CODE_LEN; i++) {
          shown += this.codeInput[i] || "-";
          if (i < CODE_LEN - 1) shown += " ";
        }
        txt(c, shown, w / 2, h * 0.34 + 56, Math.max(28, w * 0.042), "#ffffff");
        if (this.error) txt(c, this.error, w / 2, h * 0.56, Math.max(12, w * 0.0135), "#ff8fa3");
        else txt(c, "TYPE THE 5 CHARACTERS, THEN ENTER", w / 2, h * 0.56, Math.max(11, w * 0.0125), "rgba(255,255,255,0.45)", "center", 700);
        txt(c, "BACKSPACE DELETE    ESC BACK", w / 2, h - 26, Math.max(11, w * 0.0125), "rgba(255,255,255,0.45)", "center", 700);
        return;
      }

      if (this.phase === "join-wait") {
        const dots = ".".repeat(1 + (Math.floor(t * 2) % 3));
        txt(c, "CONNECTING TO " + this.code + dots, w / 2, h * 0.45, Math.max(15, w * 0.018), "rgba(255,255,255,0.8)");
        txt(c, "ESC CANCEL", w / 2, h - 26, Math.max(11, w * 0.0125), "rgba(255,255,255,0.45)", "center", 700);
        return;
      }

      if (this.phase === "ready") {
        const a = SF.ROSTER[this.pick];
        const b = SF.ROSTER[this.remotePick];
        const you1 = this.role === "host";
        fighterPreview(c, a, w * 0.27, h * 0.56, Math.min(2.4, h / 300), t + 1);
        fighterPreview(c, b, w * 0.73, h * 0.56, Math.min(2.4, h / 300), t + 3);
        txt(c, a.name, w * 0.27, h * 0.62, Math.max(15, w * 0.019), a.palette.accent);
        txt(c, b.name, w * 0.73, h * 0.62, Math.max(15, w * 0.019), b.palette.accent);
        txt(c, you1 ? "YOU (P1)" : "OPPONENT", w * 0.27, h * 0.29, Math.max(12, w * 0.0135), "#4cc9f0");
        txt(c, you1 ? "OPPONENT" : "YOU (P2)", w * 0.73, h * 0.29, Math.max(12, w * 0.0135), "#f72585");
        txt(c, "A / D CHANGE YOUR FIGHTER", w / 2, h * 0.74, Math.max(12, w * 0.0135), "rgba(255,255,255,0.65)", "center", 700);
        if (this.role === "host") {
          const pulse = 0.6 + Math.sin(t * 5) * 0.4;
          c.globalAlpha = pulse;
          txt(c, "PRESS ENTER TO START", w / 2, h * 0.81, Math.max(15, w * 0.018), "#ffe066");
          c.globalAlpha = 1;
        } else {
          txt(c, "WAITING FOR THE HOST TO START", w / 2, h * 0.81, Math.max(14, w * 0.016), "rgba(255,255,255,0.7)");
        }
        txt(c, "YOU BOTH USE W A S D TO MOVE, F ATTACK, G SPECIAL, V DODGE", w / 2, h - 46, Math.max(10, w * 0.0115), "rgba(255,255,255,0.45)", "center", 700);
        txt(c, "ESC LEAVE", w / 2, h - 26, Math.max(10, w * 0.0115), "rgba(255,255,255,0.35)", "center", 700);
        return;
      }

      if (this.phase === "error") {
        panel(c, w * 0.16, h * 0.34, w * 0.68, h * 0.22, "#ff5d7a");
        txt(c, "CONNECTION PROBLEM", w / 2, h * 0.42, Math.max(15, w * 0.018), "#ff8fa3");
        txt(c, this.error, w / 2, h * 0.51, Math.max(12, w * 0.0135), "rgba(255,255,255,0.85)", "center", 700);
        txt(c, "ENTER TO GO BACK", w / 2, h - 26, Math.max(11, w * 0.0125), "rgba(255,255,255,0.5)", "center", 700);
      }
    },

    titleHint(game) {
      const c = document.getElementById("game").getContext("2d");
      const { w, h } = SF.Render.size();
      txt(c, "O — PLAY ONLINE", w / 2, h - 44, Math.max(12, w * 0.014), "rgba(125,255,176,0.85)", "center", 700);
    },
  });
})();
