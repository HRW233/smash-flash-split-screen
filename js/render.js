/* =========================================================================
   render.js: stage art, procedural fighters, HUD and menus
   ========================================================================= */
(function () {
  const R = (SF.Render = {});
  let canvas = null;
  let ctx = null;
  let W = 0;
  let H = 0;
  /* the game draws into a tiny buffer that is blown up with nearest-neighbour
     sampling, which is what gives everything its chunky pixel edges */
  const PIXELS = 420;
  let px = 3;

  R.init = function (c) {
    canvas = c;
    ctx = canvas.getContext("2d");
    R.resize();
    window.addEventListener("resize", R.resize);
  };

  R.resize = function () {
    if (!canvas) return;
    W = window.innerWidth;
    H = window.innerHeight;
    px = SF.clamp(Math.round(Math.max(W, H) / PIXELS), 2, 8);
    canvas.width = Math.max(2, Math.round(W / px));
    canvas.height = Math.max(2, Math.round(H / px));
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    canvas.style.imageRendering = "pixelated";
  };

  R.begin = function () {
    /* one virtual pixel per game unit, stretched over px screen pixels */
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#070a14";
    ctx.fillRect(0, 0, W, H);
  };

  R.size = () => ({ w: W, h: H });

  /* ------------------------------------------------------------- helpers */
  function font(size, weight) {
    return `${weight || 900} italic ${size}px "Trebuchet MS", "Segoe UI", system-ui, sans-serif`;
  }
  function fontPlain(size, weight) {
    return `${weight || 700} ${size}px "Trebuchet MS", "Segoe UI", system-ui, sans-serif`;
  }
  function rr(c, x, y, w, h, r) {
    const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    c.beginPath();
    c.moveTo(x + rad, y);
    c.lineTo(x + w - rad, y);
    c.quadraticCurveTo(x + w, y, x + w, y + rad);
    c.lineTo(x + w, y + h - rad);
    c.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    c.lineTo(x + rad, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - rad);
    c.lineTo(x, y + rad);
    c.quadraticCurveTo(x, y, x + rad, y);
    c.closePath();
  }
  function text(t, x, y, size, fill, opts) {
    const o = opts || {};
    ctx.save();
    ctx.font = o.plain ? fontPlain(size, o.weight) : font(size, o.weight);
    ctx.textAlign = o.align || "center";
    ctx.textBaseline = o.baseline || "alphabetic";
    if (o.stroke !== false) {
      ctx.lineWidth = o.lw || Math.max(3, size * 0.12);
      ctx.strokeStyle = o.stroke || "#0b0a14";
      ctx.lineJoin = "round";
      ctx.strokeText(t, x, y);
    }
    ctx.fillStyle = fill;
    ctx.fillText(t, x, y);
    ctx.restore();
  }
  function tally(x, y, w, h, p, color, back) {
    ctx.fillStyle = back || "rgba(8,10,20,0.65)";
    rr(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = color;
    if (p > 0) {
      rr(ctx, x, y, Math.max(h, w * p), h, h / 2);
      ctx.fill();
    }
  }

  /* ============================================================ FIGHTER */
  const PAL = (f, hot) => (c) => (hot ? "#fffaf0" : c);

  function poseOf(f) {
    const p = {
      legF: 0.1,
      legB: -0.1,
      armF: -0.22,
      armB: 0.22,
      lean: 0,
      bob: 0,
      crouch: 0,
      headTilt: 0,
      squash: 0,
    };
    const t = f.animT;
    switch (f.state) {
      case "idle":
        p.bob = Math.sin(t * 3) * 1.4;
        p.armF = -0.24 + Math.sin(t * 3) * 0.07;
        p.armB = 0.24 - Math.sin(t * 3) * 0.07;
        p.headTilt = Math.sin(t * 1.4) * 0.04;
        break;
      case "run": {
        const c = f.runCycle;
        const amp = SF.clamp(Math.abs(f.vx) / f.runSpeed, 0, 1);
        p.legF = Math.sin(c) * 0.95 * amp;
        p.legB = -Math.sin(c) * 0.95 * amp;
        p.armF = -Math.sin(c) * 0.85 * amp - 0.15;
        p.armB = Math.sin(c) * 0.85 * amp + 0.15;
        p.lean = 0.16 * amp;
        p.bob = -Math.abs(Math.sin(c)) * 2 * amp;
        break;
      }
      case "air":
        p.legF = 0.42;
        p.legB = -0.28;
        p.armF = -2.25;
        p.armB = 2.25;
        p.lean = 0.06;
        break;
      case "hurt":
        p.lean = -0.4;
        p.legF = -0.35;
        p.legB = 0.45;
        p.armF = -2.5;
        p.armB = 2.5;
        p.headTilt = -0.12;
        break;
      case "dodge":
        p.lean = -0.55;
        p.legF = 0.55;
        p.legB = -0.35;
        p.armF = -1.9;
        p.armB = 1.2;
        break;
      case "attack": {
        const a = f.attack;
        if (!a) break;
        const d = a.def;
        const total = d.startup + d.active + d.recovery;
        const k = SF.clamp(a.t / total, 0, 1);
        const swing = Math.sin(Math.PI * SF.clamp(a.t / (d.startup + d.active + d.recovery * 0.5), 0, 1));
        if (a.kind === "side") {
          p.armF = -1.55 - 0.35 * swing;
          p.armB = 0.9;
          p.lean = 0.26;
          p.legF = 0.35;
          p.legB = -0.25;
        } else if (a.kind === "up") {
          p.armF = -3.0;
          p.armB = 1.2;
          p.lean = -0.1;
          p.legF = 0.15;
          p.legB = -0.2;
          p.bob = -swing * 2;
        } else if (a.kind === "down") {
          p.armF = -0.45;
          p.armB = 0.8;
          p.lean = 0.42;
          p.crouch = 5 * swing;
          p.legF = 0.5;
          p.legB = -0.4;
        } else if (a.kind === "airDown") {
          p.armF = 2.2;
          p.armB = -2.2;
          p.legF = 0.95;
          p.legB = 0.75;
          p.lean = 0.3;
        } else if (a.kind === "airUp") {
          p.armF = -3.05;
          p.armB = 3.05;
          p.legF = -0.3;
          p.legB = 0.35;
          p.lean = -0.12;
        } else if (a.kind === "airBack") {
          p.armF = 2.4;
          p.armB = 2.4;
          p.legF = -0.5;
          p.legB = -0.9;
          p.lean = -0.2;
        } else {
          p.armF = -1.15;
          p.armB = 1.85;
          p.legF = 0.62;
          p.legB = -0.38;
          p.lean = 0.18;
        }
        if (a.phase === "charge") {
          p.lean = -0.12;
          p.armF = 1.0;
          p.armB = -1.0;
          p.crouch = a.chargeT * 7;
          p.headTilt = -0.1;
        }
        break;
      }
      case "special": {
        const s = f.spec;
        if (s && s.kind === "dash") {
          p.lean = 0.62;
          p.armF = 0.5;
          p.armB = 1.9;
          p.legF = 0.85;
          p.legB = -0.55;
        } else if (s && s.kind === "pound") {
          p.armF = -2.9;
          p.armB = 2.9;
          p.legF = 0.2;
          p.legB = -0.2;
        }
        break;
      }
    }
    return p;
  }

  function limb(c, x, y, len, w, angle, fill, outline) {
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    rr(c, -w / 2, -w * 0.35, w, len + w * 0.35, w * 0.45);
    c.fillStyle = fill;
    c.fill();
    if (outline) {
      c.lineWidth = 2.2;
      c.strokeStyle = outline;
      c.stroke();
    }
    c.restore();
  }

  function flameShape(c, x, y, s, t, color) {
    c.save();
    c.translate(x, y);
    const w = Math.sin(t * 8) * 0.14 + 1;
    c.scale(s * w, s);
    c.beginPath();
    c.moveTo(0, -16);
    c.quadraticCurveTo(7, -8, 4.5, 1);
    c.quadraticCurveTo(0, 5, -4.5, 1);
    c.quadraticCurveTo(-7, -8, 0, -16);
    c.fillStyle = color;
    c.fill();
    c.restore();
  }

  R.drawFighter = function (f, opts) {
    const o = opts || {};
    const c = ctx;
    const p = f.palette;
    const st = f.char.style;
    const hot = f.flash > 0.3;
    const C = PAL(f, hot);
    const pose = poseOf(f);
    const scale = o.scale || 1;
    const t = f.animT;
    const alpha = o.alpha === undefined ? 1 : o.alpha;

    c.save();
    c.globalAlpha = alpha;
    c.translate(o.x === undefined ? f.x : o.x, o.y === undefined ? f.y : o.y);
    c.scale(scale * (o.facing === undefined ? f.facing : o.facing), scale);
    const sq = 1 - f.landSquash * 0.2;
    c.scale(1 / sq, sq * (f.landSquash ? 1 : 1));
    c.translate(0, pose.crouch);

    const outline = p.outline;
    const hipY = -22;
    const shY = -39;
    const bob = pose.bob;
    const lean = pose.lean;
    const headX = lean * 15;
    const headY = -49 + bob + pose.headTilt * 10;

    /* ---- back arm & back leg */
    limb(c, -7 + lean * 6, shY + bob, 15, 6, pose.armB, C(SF.shade(p.top, -0.22)), outline);
    limb(c, -4.5, hipY, 22, 7.5, pose.legB, C(SF.shade(p.pants, -0.18)), outline);

    /* ---- torso */
    c.beginPath();
    c.moveTo(-9.5, hipY);
    c.lineTo(9.5, hipY);
    c.lineTo(9 + lean * 11, shY + bob);
    c.quadraticCurveTo(lean * 11, shY - 4 + bob, -8.5 + lean * 11, shY + bob);
    c.closePath();
    c.fillStyle = C(p.top);
    c.fill();
    c.lineWidth = 2.6;
    c.strokeStyle = outline;
    c.stroke();

    /* belt */
    c.fillStyle = C(p.accent);
    c.fillRect(-9.5, hipY - 4, 19, 4.2);
    c.strokeStyle = outline;
    c.lineWidth = 1.6;
    c.strokeRect(-9.5, hipY - 4, 19, 4.2);

    /* chest accent */
    c.fillStyle = C(SF.shade(p.top, 0.16));
    c.fillRect(-7 + lean * 9, shY + 6 + bob, 14, 6);

    /* ---- front leg */
    limb(c, 4.5, hipY, 22, 7.5, pose.legF, C(p.pants), outline);
    /* boots */
    c.save();
    c.translate(4.5, hipY);
    c.rotate(pose.legF);
    c.fillStyle = C(p.boots);
    rr(c, -5.5, 16, 11, 7, 3);
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = outline;
    c.stroke();
    c.restore();
    c.save();
    c.translate(-4.5, hipY);
    c.rotate(pose.legB);
    c.fillStyle = C(SF.shade(p.boots, -0.1));
    rr(c, -5.5, 16, 11, 7, 3);
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = outline;
    c.stroke();
    c.restore();

    /* ---- shoulders */
    if (st.plate || st.shoulders > 1.2) {
      c.fillStyle = C(SF.shade(p.top, 0.26));
      rr(c, -12 + lean * 9, shY + bob - 1, 9, 8, 4);
      c.fill();
      c.strokeStyle = outline;
      c.lineWidth = 2;
      c.stroke();
      rr(c, 3 + lean * 9, shY + bob - 1, 9, 8, 4);
      c.fill();
      c.stroke();
    }

    /* ---- scarf (behind head) */
    if (st.scarf) {
      c.save();
      c.translate(-2 + lean * 10, shY + bob + 2);
      const sway = Math.sin(t * 6) * 5;
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(-16, 2 + sway, -30, 10 + sway);
      c.quadraticCurveTo(-18, 8 + sway * 0.5, -2, 8);
      c.closePath();
      c.fillStyle = C(p.accent);
      c.fill();
      c.strokeStyle = outline;
      c.lineWidth = 2;
      c.stroke();
      c.restore();
    }

    /* ---- coat tails */
    if (st.coat) {
      c.save();
      c.translate(-2 + lean * 8, shY + bob);
      const sway = Math.sin(t * 5) * 4;
      c.beginPath();
      c.moveTo(-7, 0);
      c.quadraticCurveTo(-23, 22 + sway, -17, 45 + sway);
      c.quadraticCurveTo(-4, 34, 4, 2);
      c.closePath();
      c.fillStyle = C(p.cloak || SF.shade(p.top, -0.22));
      c.fill();
      c.strokeStyle = outline;
      c.lineWidth = 2;
      c.stroke();
      c.restore();
    }

    /* ---- head */
    c.save();
    c.translate(headX, headY + bob);
    if (st.hood) {
      c.beginPath();
      c.moveTo(0, -14);
      c.quadraticCurveTo(14, -14, 13, 3);
      c.quadraticCurveTo(10, 12, 0, 12);
      c.quadraticCurveTo(-10, 12, -13, 3);
      c.quadraticCurveTo(-14, -14, 0, -14);
      c.fillStyle = C(SF.shade(p.top, 0.1));
      c.fill();
      c.strokeStyle = outline;
      c.lineWidth = 2.4;
      c.stroke();
    }
    if (st.hair === "long") {
      c.beginPath();
      c.moveTo(-9, -8);
      c.quadraticCurveTo(-18, 2, -13, 16);
      c.quadraticCurveTo(-4, 12, -4, -6);
      c.closePath();
      c.fillStyle = C(p.hair);
      c.fill();
      c.strokeStyle = outline;
      c.lineWidth = 2;
      c.stroke();
    }
    /* face */
    rr(c, -8.5, -12, 17, 17, 5);
    c.fillStyle = C(p.skin);
    c.fill();
    c.strokeStyle = outline;
    c.lineWidth = 2.4;
    c.stroke();
    /* eyes */
    c.fillStyle = hot ? "#ffffff" : "#1b1520";
    c.fillRect(1.5, -6.5, 3.2, 4.2);
    c.fillRect(-6.5, -6.5, 3.2, 4.2);
    /* brow / mouth */
    c.strokeStyle = hot ? "#fff" : outline;
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(1, -9);
    c.lineTo(5.5, -8);
    c.moveTo(-5.5, -8);
    c.lineTo(-1.5, -9);
    c.stroke();
    c.beginPath();
    c.moveTo(-2, 1.5);
    c.lineTo(2.5, 1.5);
    c.stroke();

    /* hair / helmet on top */
    if (st.hair === "spiky") {
      c.beginPath();
      c.moveTo(-9, -9);
      c.lineTo(-10, -17);
      c.lineTo(-4.5, -13);
      c.lineTo(-2, -21);
      c.lineTo(2, -13.5);
      c.lineTo(7, -19);
      c.lineTo(8, -11);
      c.closePath();
      c.fillStyle = C(p.hair);
      c.fill();
      c.strokeStyle = outline;
      c.lineWidth = 2.2;
      c.stroke();
    } else if (st.hair === "buzz") {
      c.beginPath();
      c.moveTo(-9, -8);
      c.quadraticCurveTo(0, -17, 9, -8);
      c.closePath();
      c.fillStyle = C(p.hair);
      c.fill();
      c.strokeStyle = outline;
      c.lineWidth = 2;
      c.stroke();
    } else if (st.hair === "long") {
      c.beginPath();
      c.moveTo(-9, -9);
      c.quadraticCurveTo(-4, -20, 6, -13);
      c.lineTo(9, -6);
      c.quadraticCurveTo(2, -13, -9, -9);
      c.fillStyle = C(p.hair);
      c.fill();
      c.strokeStyle = outline;
      c.lineWidth = 2;
      c.stroke();
    } else if (st.hair === "fluffy") {
      c.beginPath();
      c.moveTo(-10, -8);
      c.quadraticCurveTo(-13, -20, -3, -17);
      c.quadraticCurveTo(0, -24, 4, -17);
      c.quadraticCurveTo(13, -20, 10, -7);
      c.quadraticCurveTo(2, -13, -10, -8);
      c.closePath();
      c.fillStyle = C(p.hair);
      c.fill();
      c.strokeStyle = outline;
      c.lineWidth = 2;
      c.stroke();
    } else if (st.hair === "goku") {
      c.beginPath();
      c.moveTo(-10, -8);
      c.lineTo(-14, -19);
      c.lineTo(-7, -15);
      c.lineTo(-7, -27);
      c.lineTo(0, -19);
      c.lineTo(3, -29);
      c.lineTo(6, -18);
      c.lineTo(13, -21);
      c.lineTo(10, -7);
      c.closePath();
      c.fillStyle = C(p.hair);
      c.fill();
      c.strokeStyle = outline;
      c.lineWidth = 2.2;
      c.stroke();
    } else if (st.hair === "ichigo") {
      c.beginPath();
      c.moveTo(-10, -8);
      c.lineTo(-12, -17);
      c.lineTo(-5, -15);
      c.lineTo(-3, -24);
      c.lineTo(2, -16);
      c.lineTo(8, -22);
      c.lineTo(10, -12);
      c.lineTo(11, -6);
      c.closePath();
      c.fillStyle = C(p.hair);
      c.fill();
      c.strokeStyle = outline;
      c.lineWidth = 2.2;
      c.stroke();
    } else if (st.hair === "short") {
      c.beginPath();
      c.moveTo(-9, -8);
      c.quadraticCurveTo(-10, -18, 0, -17);
      c.quadraticCurveTo(10, -18, 9, -7);
      c.quadraticCurveTo(0, -12, -9, -8);
      c.closePath();
      c.fillStyle = C(p.hair);
      c.fill();
      c.strokeStyle = outline;
      c.lineWidth = 2;
      c.stroke();
    } else if (st.hair === "tied") {
      c.beginPath();
      c.moveTo(-9, -8);
      c.quadraticCurveTo(-6, -19, 4, -17);
      c.quadraticCurveTo(10, -15, 9, -6);
      c.closePath();
      c.fillStyle = C(p.hair);
      c.fill();
      c.strokeStyle = outline;
      c.lineWidth = 2;
      c.stroke();
      c.beginPath();
      c.moveTo(-9, -12);
      c.quadraticCurveTo(-17, -6, -13, 2);
      c.quadraticCurveTo(-7, -2, -5, -10);
      c.closePath();
      c.fill();
      c.stroke();
    } else if (st.hair === "braid") {
      c.beginPath();
      c.moveTo(-9, -8);
      c.quadraticCurveTo(-4, -19, 5, -16);
      c.quadraticCurveTo(10, -13, 9, -6);
      c.closePath();
      c.fillStyle = C(p.hair);
      c.fill();
      c.strokeStyle = outline;
      c.lineWidth = 2;
      c.stroke();
      c.beginPath();
      c.moveTo(-8, -9);
      c.quadraticCurveTo(-15, 2, -11, 14);
      c.quadraticCurveTo(-6, 12, -5, -6);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = C(SF.shade(p.hair, -0.25));
      c.fillRect(-11, 4, 5, 2.4);
      c.fillRect(-11, 9, 4.5, 2.4);
    }
    if (st.strawhat) {
      c.fillStyle = C("#e8c56a");
      c.strokeStyle = outline;
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(1, -13, 23, 7, 0, 0, SF.TAU);
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(-11, -14);
      c.quadraticCurveTo(1, -31, 12, -14);
      c.closePath();
      c.fillStyle = C("#f0d68a");
      c.fill();
      c.stroke();
      c.fillStyle = C("#c1121f");
      c.fillRect(-10, -18, 21, 3.4);
    }
    if (st.cap) {
      c.beginPath();
      c.moveTo(-11, -10);
      c.quadraticCurveTo(-10, -23, 2, -21);
      c.quadraticCurveTo(12, -20, 11, -10);
      c.closePath();
      c.fillStyle = C(p.accent);
      c.fill();
      c.strokeStyle = outline;
      c.lineWidth = 2.2;
      c.stroke();
      c.beginPath();
      c.moveTo(-1, -12);
      c.lineTo(17, -9);
      c.lineTo(15, -4);
      c.lineTo(-1, -7);
      c.closePath();
      c.fillStyle = C(SF.shade(p.accent, -0.25));
      c.fill();
      c.stroke();
      c.fillStyle = C("#ffffff");
      c.beginPath();
      c.arc(2, -15, 3.2, 0, SF.TAU);
      c.fill();
    }
    if (st.headband) {
      c.fillStyle = C("#2b4c8c");
      c.fillRect(-9.5, -12.5, 20, 5);
      c.fillStyle = C(p.metal || "#9aa7b4");
      c.fillRect(1, -13.5, 8.5, 7);
      c.strokeStyle = outline;
      c.lineWidth = 1.2;
      c.strokeRect(1, -13.5, 8.5, 7);
      c.strokeStyle = "#55627a";
      c.beginPath();
      c.arc(5.2, -10, 2, 0, SF.TAU * 0.85);
      c.stroke();
    }
    if (st.blindfold) {
      c.fillStyle = C("#191922");
      c.fillRect(-9.5, -9.5, 20, 7.5);
      c.strokeStyle = outline;
      c.lineWidth = 1.6;
      c.strokeRect(-9.5, -9.5, 20, 7.5);
    }
    if (st.helmet) {
      c.beginPath();
      c.moveTo(-10, -9);
      c.quadraticCurveTo(-2, -20, 9, -10);
      c.lineTo(10, -6);
      c.quadraticCurveTo(0, -11, -10, -6);
      c.closePath();
      c.fillStyle = C(SF.shade(p.top, 0.35));
      c.fill();
      c.strokeStyle = outline;
      c.lineWidth = 2.4;
      c.stroke();
      c.fillStyle = C(p.accent);
      c.fillRect(-1.5, -19, 4, 9);
    }
    if (st.visor) {
      c.fillStyle = C(p.accent);
      rr(c, -9, -7.5, 18, 5, 2.5);
      c.fill();
      c.strokeStyle = outline;
      c.lineWidth = 1.4;
      c.stroke();
      c.fillStyle = "rgba(255,255,255,0.7)";
      c.fillRect(2, -7, 5, 2);
    }
    if (st.frost) {
      c.fillStyle = "#dff6ff";
      c.beginPath();
      c.moveTo(-11, -2);
      c.lineTo(-7, -7);
      c.lineTo(-5, 0);
      c.closePath();
      c.fill();
    }
    c.restore();

    /* ---- front arm (automail is bare metal) */
    const armColor = st.automail ? p.metal || "#b9c4cf" : p.top;
    limb(c, 7 + lean * 6, shY + bob, 15, 6.5, pose.armF, C(armColor), outline);
    c.save();
    c.translate(7 + lean * 6, shY + bob);
    c.rotate(pose.armF);
    c.fillStyle = C(st.automail ? p.metal || "#b9c4cf" : p.accent);
    c.beginPath();
    c.arc(0, 16, 4.4, 0, SF.TAU);
    c.fill();
    c.strokeStyle = outline;
    c.lineWidth = 1.8;
    c.stroke();
    c.restore();

    /* ---- sword */
    if (st.sword) {
      c.save();
      c.translate(7 + lean * 6, shY + bob);
      c.rotate(pose.armF);
      c.translate(0, 16);
      c.rotate(-0.55);
      c.fillStyle = C("#2a2a36");
      c.fillRect(-3, -5, 6, 11);
      c.fillStyle = C(p.blade || "#dfe9f5");
      c.beginPath();
      c.moveTo(-2.8, -36);
      c.lineTo(2.8, -36);
      c.lineTo(3.4, 0);
      c.lineTo(-3.4, 0);
      c.closePath();
      c.fill();
      c.strokeStyle = outline;
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = C("#1a1a24");
      c.fillRect(-7, -3, 14, 3.2);
      c.restore();
    }

    /* ---- aura bits */
    if (st.flame) {
      flameShape(c, -6 + lean * 8, shY - 6 + bob, 0.9, t, "rgba(255,140,40,0.85)");
      flameShape(c, 6 + lean * 8, shY - 10 + bob, 0.6, t * 1.4, "rgba(255,200,90,0.75)");
    }
    if (st.spark) {
      c.save();
      c.globalCompositeOperation = "lighter";
      c.strokeStyle = "rgba(120,240,255,0.9)";
      c.lineWidth = 1.6;
      for (let i = 0; i < 2; i++) {
        const a = t * 9 + i * 3;
        const x0 = Math.cos(a) * 16;
        const y0 = -32 + Math.sin(a) * 14;
        c.beginPath();
        c.moveTo(x0, y0);
        c.lineTo(x0 + Math.cos(a + 1) * 7, y0 + Math.sin(a + 2) * 6);
        c.lineTo(x0 + Math.cos(a + 2) * 11, y0 + Math.sin(a + 3) * 9);
        c.stroke();
      }
      c.restore();
    }

    /* ---- companion */
    if (st.companion === "pikachu") {
      c.save();
      c.translate(-27, 0);
      const pb = Math.sin(t * 7) * 1.5;
      c.fillStyle = C("#ffd23f");
      c.strokeStyle = outline;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-4, -20 + pb);
      c.lineTo(-15, -32 + pb);
      c.lineTo(-9, -33 + pb);
      c.lineTo(-1, -22 + pb);
      c.closePath();
      c.fill();
      c.stroke();
      rr(c, -9, -22 + pb, 18, 22, 8);
      c.fillStyle = C("#ffd23f");
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(-7, -20 + pb);
      c.lineTo(-12, -35 + pb);
      c.lineTo(-3, -24 + pb);
      c.closePath();
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(3, -24 + pb);
      c.lineTo(8, -37 + pb);
      c.lineTo(10, -24 + pb);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = C("#2b2b33");
      c.beginPath();
      c.moveTo(-12, -35 + pb);
      c.lineTo(-9, -30 + pb);
      c.lineTo(-8, -33 + pb);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(8, -37 + pb);
      c.lineTo(8, -32 + pb);
      c.lineTo(10, -32 + pb);
      c.closePath();
      c.fill();
      c.fillStyle = "#e63946";
      c.beginPath();
      c.arc(-5, -12 + pb, 2.4, 0, SF.TAU);
      c.fill();
      c.beginPath();
      c.arc(6, -12 + pb, 2.4, 0, SF.TAU);
      c.fill();
      c.fillStyle = "#1b1520";
      c.beginPath();
      c.arc(-3.5, -17 + pb, 1.4, 0, SF.TAU);
      c.fill();
      c.beginPath();
      c.arc(4, -17 + pb, 1.4, 0, SF.TAU);
      c.fill();
      c.restore();
    }

    /* ---- slash arc */
    const a = f.attack;
    if (a && (a.phase === "active" || a.phase === "recovery")) {
      const d = a.def;
      const prog = SF.clamp((a.t - d.startup) / d.active, 0, 1);
      if (prog < 1.05) {
        c.save();
        c.globalCompositeOperation = "lighter";
        c.globalAlpha = 0.75 * (1 - prog);
        const ARC = {
          side: [-2.2, 50],
          up: [-3.0, 62],
          down: [0.1, 46],
          air: [-1.7, 54],
          airFwd: [-1.4, 56],
          airBack: [2.5, 52],
          airUp: [-3.0, 64],
          airDown: [0.3, 52],
        };
        const arc = ARC[a.kind] || [-1.6, 50];
        const ang0 = arc[0];
        const ang1 = ang0 + 1.5;
        const rad = arc[1];
        c.strokeStyle = a.power > 1.25 ? "#ffd166" : p.accent;
        c.lineWidth = 8;
        c.lineCap = "round";
        c.beginPath();
        c.arc(4, -34, rad, ang0 + prog * 0.8, ang1 + prog * 0.8);
        c.stroke();
        c.restore();
      }
    }
    if (f.state === "attack" && a && a.phase === "charge") {
      c.save();
      c.globalCompositeOperation = "lighter";
      const k = a.chargeT / a.def.maxCharge;
      c.globalAlpha = 0.35 + k * 0.5;
      c.strokeStyle = p.accent;
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(0, -28, 26 + k * 16 + Math.sin(t * 20) * 2, 0, SF.TAU);
      c.stroke();
      c.restore();
    }

    /* ---- freeze block */
    if (f.frozen > 0) {
      c.globalAlpha = 0.55;
      c.fillStyle = "#8fe3ff";
      rr(c, -20, -58, 40, 60, 6);
      c.fill();
      c.globalAlpha = 0.9;
      c.strokeStyle = "#e7fbff";
      c.lineWidth = 2;
      c.stroke();
      c.globalAlpha = alpha;
    }

    c.restore();

    /* ---- player tag */
    if (o.tag) {
      const tx = (o.x === undefined ? f.x : o.x);
      const ty = (o.y === undefined ? f.y : o.y) - 78 * scale;
      c.save();
      c.globalAlpha = alpha;
      c.fillStyle = o.tagColor || p.accent;
      c.beginPath();
      c.moveTo(tx, ty + 10);
      c.lineTo(tx - 7, ty);
      c.lineTo(tx + 7, ty);
      c.closePath();
      c.fill();
      c.font = fontPlain(15 * scale, 800);
      c.textAlign = "center";
      c.fillStyle = "#0a0a12";
      c.fillRect(tx - 18, ty - 16, 36, 16);
      c.fillStyle = o.tagColor || p.accent;
      c.fillText(o.tag, tx, ty - 3.5);
      c.restore();
    }
  };

  /* ================================================================ SKY */
  function drawSky(panel, cam, tint) {
    const g = ctx.createLinearGradient(0, panel.y, 0, panel.y + panel.h);
    g.addColorStop(0, tint ? tint[0] : "#0c1030");
    g.addColorStop(0.45, tint ? tint[1] : "#2b2160");
    g.addColorStop(0.75, tint ? tint[2] : "#8b3f6d");
    g.addColorStop(1, tint ? tint[3] : "#f2836b");
    ctx.fillStyle = g;
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);

    const cx = panel.x + panel.w / 2;
    const cy = panel.y + panel.h / 2;

    /* sun */
    const sx = cx + (0.55 - 0) * panel.w * 0.5 - (cam.x * 0.04);
    const sy = panel.y + panel.h * 0.36;
    const sun = ctx.createRadialGradient(sx, sy, 4, sx, sy, panel.w * 0.42);
    sun.addColorStop(0, "rgba(255,214,160,0.95)");
    sun.addColorStop(0.12, "rgba(255,170,120,0.5)");
    sun.addColorStop(1, "rgba(255,140,100,0)");
    ctx.fillStyle = sun;
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);

    /* distant pillars */
    ctx.save();
    for (const p of SF.STAGE.pillars) {
      const px = cx + (p.x - cam.x * 0.22) * 0.55;
      if (px < panel.x - 200 || px > panel.x + panel.w + 200) continue;
      const base = panel.y + panel.h * 0.62 - cam.y * 0.06;
      ctx.fillStyle = "rgba(24,18,52,0.5)";
      ctx.fillRect(px, base - p.h, p.w, p.h);
      ctx.beginPath();
      ctx.moveTo(px - 8, base - p.h);
      ctx.lineTo(px + p.w / 2, base - p.h - 26);
      ctx.lineTo(px + p.w + 8, base - p.h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    /* clouds */
    ctx.save();
    for (const cl of SF.STAGE.clouds) {
      const px = cx + (cl.x - cam.x * 0.35) * 0.75;
      const py = panel.y + panel.h * 0.16 + (cl.y + 560) * 0.42 - cam.y * 0.05;
      if (px < panel.x - 220 || px > panel.x + panel.w + 220) continue;
      ctx.globalAlpha = cl.a;
      ctx.fillStyle = "#ffd9c9";
      const s = cl.s * 1.5;
      ctx.beginPath();
      ctx.ellipse(px, py, 70 * s, 18 * s, 0, 0, SF.TAU);
      ctx.ellipse(px + 34 * s, py + 4, 44 * s, 13 * s, 0, 0, SF.TAU);
      ctx.ellipse(px - 38 * s, py + 5, 38 * s, 11 * s, 0, 0, SF.TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ============================================================== STAGE */
  function drawStage() {
    const f = SF.STAGE.floor;
    const t = performance.now() / 1000;

    /* ground glow */
    const glow = ctx.createRadialGradient(0, f.y + 40, 20, 0, f.y + 40, 620);
    glow.addColorStop(0, "rgba(120,90,255,0.20)");
    glow.addColorStop(1, "rgba(120,90,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-700, f.y - 220, 1400, 560);

    /* island body */
    ctx.beginPath();
    ctx.moveTo(f.x1 - 26, f.y + 6);
    ctx.quadraticCurveTo(f.x2 - 40, f.y + 120, 210, f.y + 300);
    ctx.quadraticCurveTo(120, f.y + 360, 0, f.y + 372);
    ctx.quadraticCurveTo(-140, f.y + 366, -230, f.y + 296);
    ctx.quadraticCurveTo(f.x1 + 34, f.y + 120, f.x1 + 22, f.y + 6);
    ctx.closePath();
    const rock = ctx.createLinearGradient(0, f.y, 0, f.y + 380);
    rock.addColorStop(0, "#4a3a72");
    rock.addColorStop(0.35, "#372a58");
    rock.addColorStop(1, "#1b1533");
    ctx.fillStyle = rock;
    ctx.fill();
    ctx.strokeStyle = "#120e24";
    ctx.lineWidth = 4;
    ctx.stroke();

    /* rock striations */
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = "#6f5a9e";
    ctx.lineWidth = 2;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 90 - 20, f.y + 46);
      ctx.quadraticCurveTo(i * 70, f.y + 150, i * 40, f.y + 240 - Math.abs(i) * 26);
      ctx.stroke();
    }
    ctx.restore();

    /* hanging runes */
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 5; i++) {
      const x = -260 + i * 130;
      const y = f.y + 150 + Math.sin(t * 1.5 + i) * 6;
      ctx.globalAlpha = 0.35 + Math.sin(t * 2 + i * 2) * 0.15;
      ctx.fillStyle = "#9b7bff";
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, SF.TAU);
      ctx.fill();
    }
    ctx.restore();

    /* grass top */
    ctx.fillStyle = "#3f8f5b";
    rr(ctx, f.x1 - 12, f.y - 4, f.x2 - f.x1 + 24, 20, 10);
    ctx.fill();
    ctx.fillStyle = "#57c177";
    rr(ctx, f.x1 - 10, f.y - 6, f.x2 - f.x1 + 20, 12, 6);
    ctx.fill();
    ctx.fillStyle = "#2b6b46";
    ctx.fillRect(f.x1 - 8, f.y + 10, f.x2 - f.x1 + 16, 5);
    ctx.strokeStyle = "#183a26";
    ctx.lineWidth = 3;
    rr(ctx, f.x1 - 12, f.y - 4, f.x2 - f.x1 + 24, 20, 10);
    ctx.stroke();

    /* edge towers */
    for (const s of [-1, 1]) {
      const x = s * (f.x2 + 22);
      ctx.save();
      ctx.translate(x, f.y);
      ctx.fillStyle = "#3a2f5c";
      rr(ctx, -16, -46, 32, 52, 6);
      ctx.fill();
      ctx.strokeStyle = "#140f26";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#ffb703";
      ctx.beginPath();
      ctx.arc(0, -52, 6 + Math.sin(t * 2) * 1.5, 0, SF.TAU);
      ctx.fill();
      ctx.restore();
    }

    /* floating platforms */
    for (const p of SF.STAGE.platforms) {
      if (p.main) continue;
      const w = p.x2 - p.x1;
      ctx.save();
      /* underside */
      ctx.beginPath();
      ctx.moveTo(p.x1, p.y + 4);
      ctx.lineTo(p.x2, p.y + 4);
      ctx.lineTo(p.x2 - 14, p.y + 44);
      ctx.quadraticCurveTo(p.x1 + w / 2, p.y + 66, p.x1 + 14, p.y + 44);
      ctx.closePath();
      ctx.fillStyle = "#372a58";
      ctx.fill();
      ctx.strokeStyle = "#140f26";
      ctx.lineWidth = 3;
      ctx.stroke();
      /* top */
      ctx.fillStyle = "#57c177";
      rr(ctx, p.x1, p.y - 5, w, 12, 6);
      ctx.fill();
      ctx.fillStyle = "#8ce49e";
      rr(ctx, p.x1 + 3, p.y - 5, w - 6, 4, 2);
      ctx.fill();
      ctx.strokeStyle = "#183a26";
      ctx.lineWidth = 2.5;
      rr(ctx, p.x1, p.y - 5, w, 12, 6);
      ctx.stroke();
      /* rune glow */
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.5 + Math.sin(t * 2 + p.y) * 0.15;
      ctx.fillStyle = "#8f7bff";
      ctx.beginPath();
      ctx.arc(p.x1 + w / 2, p.y + 30, 5, 0, SF.TAU);
      ctx.fill();
      ctx.restore();
    }

    /* blast zone hints */
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = "#ff6b9d";
    ctx.lineWidth = 6;
    ctx.setLineDash([18, 26]);
    ctx.strokeRect(SF.BLAST.left, SF.BLAST.top, SF.BLAST.right - SF.BLAST.left, SF.BLAST.bottom - SF.BLAST.top);
    ctx.restore();
  }

  /* ============================================================== PANEL */
  R.drawPanel = function (panel, cam, game, fighter) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(panel.x, panel.y, panel.w, panel.h);
    ctx.clip();

    drawSky(panel, cam);

    const shake = SF.World.shake;
    const sx = shake ? SF.rand(-shake, shake) : 0;
    const sy = shake ? SF.rand(-shake, shake) : 0;

    ctx.save();
    ctx.translate(panel.x + panel.w / 2 + sx, panel.y + panel.h / 2 + panel.h * 0.04 + sy);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    drawStage();
    SF.World.draw(ctx);

    /* fighters, sorted so the lower one draws last */
    const list = game.fighters.slice().sort((a, b) => a.y - b.y);
    for (const f of list) {
      if (f.state === "ko" || f.dead) continue;
      if (f.invuln > 0 && Math.floor(performance.now() / 70) % 2 === 0) continue;
      R.drawFighter(f, { tag: f === fighter ? "YOU" : null, tagColor: f.index === 0 ? "#4cc9f0" : "#f72585" });
    }

    /* off-screen opponent arrow */
    const foe = game.fighters.find((x) => x !== fighter);
    if (foe && foe.alive) {
      const vw = panel.w / cam.zoom;
      const vh = panel.h / cam.zoom;
      const lx = cam.x - vw / 2;
      const rx = cam.x + vw / 2;
      const ty = cam.y - vh / 2;
      const by = cam.y + vh / 2;
      const out = foe.x < lx || foe.x > rx || foe.y < ty || foe.y > by;
      if (out) drawOffscreenArrow(panel, cam, foe, fighter);
    }

    ctx.restore();

    /* vignette */
    const vig = ctx.createRadialGradient(
      panel.x + panel.w / 2,
      panel.y + panel.h / 2,
      panel.w * 0.25,
      panel.x + panel.w / 2,
      panel.y + panel.h / 2,
      panel.w * 0.85
    );
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(4,2,12,0.55)");
    ctx.fillStyle = vig;
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);

    /* ko flash */
    if (game.koFlash > 0) {
      ctx.fillStyle = `rgba(255,240,230,${game.koFlash * 0.35})`;
      ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    }

    ctx.restore();
  };

  function drawOffscreenArrow(panel, cam, foe, self) {
    const cx = panel.x + panel.w / 2;
    const cy = panel.y + panel.h / 2;
    const dx = foe.x - self.x;
    const dy = foe.y - self.y;
    const a = Math.atan2(dy, dx);
    const rx = Math.min(panel.w, panel.h) * 0.36;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * rx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = foe.palette.accent;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-8, 9);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-8, -9);
    ctx.closePath();
    ctx.fill();
    ctx.rotate(-a);
    ctx.font = fontPlain(12, 800);
    ctx.textAlign = "center";
    ctx.fillStyle = "#0a0a12";
    const label = foe.damage + "%";
    ctx.fillRect(-20, 14, 40, 16);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, 0, 26);
    ctx.restore();
  }

  /* ================================================================= HUD */
  R.hud = function (panel, f, game) {
    const pad = Math.max(14, panel.w * 0.035);
    const baseY = panel.y + panel.h - pad;
    const pcol = f.index === 0 ? "#4cc9f0" : "#f72585";
    const hot = f.damage >= 120;

    /* portrait chip */
    ctx.save();
    ctx.fillStyle = "rgba(8,8,18,0.62)";
    rr(ctx, panel.x + pad, baseY - 76, 52, 52, 12);
    ctx.fill();
    ctx.strokeStyle = pcol;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    /* mini head */
    ctx.save();
    ctx.beginPath();
    rr(ctx, panel.x + pad, baseY - 76, 52, 52, 12);
    ctx.clip();
    const fake = {
      x: panel.x + pad + 26,
      y: baseY - 24,
      facing: 1,
      palette: f.palette,
      char: f.char,
      animT: game.time,
      state: "idle",
      attack: null,
      runCycle: 0,
      landSquash: 0,
      flash: 0,
      frozen: 0,
      damage: f.damage,
    };
    R.drawFighter(fake, { scale: 0.6, tag: null });
    ctx.restore();
    ctx.restore();

    /* name + stocks */
    ctx.save();
    text(f.name, panel.x + pad + 64, baseY - 56, Math.max(18, panel.w * 0.03), "#ffffff", {
      align: "left",
      lw: 4,
    });
    for (let i = 0; i < SF.STOCKS; i++) {
      const x = panel.x + pad + 64 + i * 16;
      const y = baseY - 44;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, SF.TAU);
      const alive = i < f.stocks;
      ctx.fillStyle = alive ? pcol : "rgba(255,255,255,0.14)";
      ctx.fill();
      if (alive) {
        ctx.strokeStyle = "rgba(255,255,255,0.65)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
    ctx.restore();

    /* percent */
    const pctSize = Math.max(30, panel.w * 0.062);
    const col = f.damage < 45 ? "#f3f4ff" : f.damage < 80 ? "#ffe066" : f.damage < 120 ? "#ff9f43" : "#ff4d6d";
    text(
      f.damage + "%",
      panel.x + pad + 4,
      baseY - 8,
      pctSize,
      col,
      { align: "left", lw: pctSize * 0.16 }
    );
    if (hot) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.25 + Math.sin(game.time * 10) * 0.1;
      ctx.fillStyle = "#ff2d55";
      ctx.beginPath();
      ctx.arc(panel.x + pad + 8, baseY - 30, 70, 0, SF.TAU);
      ctx.fill();
      ctx.restore();
    }

    /* special meter */
    const sp = f.char.special;
    const ready = f.specialCd <= 0;
    const w = Math.min(200, panel.w * 0.3);
    tally(panel.x + panel.w - pad - w, baseY - 22, w, 8, ready ? 1 : 1 - f.specialCd / sp.cooldown, ready ? f.palette.accent : "#6b7280");
    ctx.save();
    ctx.font = fontPlain(Math.max(13, panel.w * 0.019), 800);
    ctx.textAlign = "right";
    ctx.fillStyle = ready ? "#ffffff" : "rgba(255,255,255,0.45)";
    ctx.fillText(sp.label + (ready ? " READY" : ""), panel.x + panel.w - pad, baseY - 30);
    ctx.restore();
  };

  /* ============================================================== SCREENS */
  R.title = function (game) {
    const { w, h } = R.size();
    const t = game.time;

    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#0a0a1e");
    g.addColorStop(0.5, "#221046");
    g.addColorStop(1, "#5b1840");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    /* rays */
    ctx.save();
    ctx.translate(w / 2, h * 0.42);
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = "#ff6bd6";
    for (let i = 0; i < 14; i++) {
      const a = t * 0.08 + (i / 14) * SF.TAU;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, Math.max(w, h), a, a + 0.12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    /* grid floor */
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "#ff4fa3";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 16; i++) {
      const y = h * 0.72 + i * i * 2.2;
      if (y > h) break;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (let i = -12; i <= 12; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + i * 40, h * 0.72);
      ctx.lineTo(w / 2 + i * 220, h);
      ctx.stroke();
    }
    ctx.restore();

    /* logo */
    const big = Math.min(w * 0.13, h * 0.165);
    const ly = h * 0.34;
    ctx.save();
    ctx.translate(w / 2, ly);
    const beat = 1 + Math.sin(t * 3) * 0.012;
    ctx.scale(beat, beat);
    text("SMASH", 0, 0, big, "#ffe066", { lw: big * 0.13, stroke: "#1a0820" });
    text("FLASH", 0, big * 0.82, big, "#4cc9f0", { lw: big * 0.13, stroke: "#1a0820" });
    ctx.restore();
    text("SPLIT SCREEN EDITION", w / 2, ly + big * 1.16, Math.max(13, w * 0.016), "#ffb3e6", {
      lw: 4,
      stroke: "#210a26",
    });

    /* character line-up */
    const rosterN = SF.ROSTER.length;
    const spacing = Math.min(w * 0.062, 96);
    const lineScale = Math.min(1.35, spacing / 58);
    for (let i = 0; i < rosterN; i++) {
      const c = SF.ROSTER[i];
      const x = w / 2 + (i - (rosterN - 1) / 2) * spacing;
      const y = h * 0.82 + Math.sin(t * 2 + i) * 4;
      const fake = {
        x,
        y,
        facing: i % 2 ? -1 : 1,
        palette: c.palette,
        char: c,
        animT: t + i,
        state: "idle",
        attack: null,
        runCycle: 0,
        landSquash: 0,
        flash: 0,
        frozen: 0,
      };
      R.drawFighter(fake, { scale: lineScale, tag: null });
    }

    /* menu */
    const opts = ["VS PLAYER", "VS CPU"];
    const my = h * 0.9;
    ctx.save();
    ctx.font = font(Math.max(15, w * 0.018));
    ctx.textAlign = "center";
    opts.forEach((o, i) => {
      const x = w / 2 + (i === 0 ? -Math.min(w * 0.13, 170) : Math.min(w * 0.13, 170));
      const sel = game.mode === i;
      const col = sel ? "#ffe066" : "rgba(255,255,255,0.4)";
      if (sel) {
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = "#ffe066";
        rr(ctx, x - 84, my - 26, 168, 38, 10);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      text(o, x, my, Math.max(15, w * 0.018), col, { lw: 4 });
      if (sel) {
        ctx.fillStyle = "#ffe066";
        const bx = x - 100 + Math.sin(t * 5) * 3;
        ctx.beginPath();
        ctx.moveTo(bx - 8, my - 6);
        ctx.lineTo(bx, my - 14);
        ctx.lineTo(bx, my + 2);
        ctx.closePath();
        ctx.fill();
        const bx2 = x + 100 - Math.sin(t * 5) * 3;
        ctx.beginPath();
        ctx.moveTo(bx2 + 8, my - 6);
        ctx.lineTo(bx2, my - 14);
        ctx.lineTo(bx2, my + 2);
        ctx.closePath();
        ctx.fill();
      }
    });
    text("W / S  OR  ARROWS TO SWITCH   -   ENTER TO START", w / 2, h - 22, Math.max(13, w * 0.014), "rgba(255,255,255,0.5)", {
      plain: true,
      weight: 700,
      stroke: false,
    });
    ctx.restore();

    /* controls strip */
    const cw = Math.min(w * 0.42, 470);
    const cy = h * 0.47;
    controlCard(w / 2 - cw - 12, cy, cw, "#4cc9f0", "PLAYER 1", ["A D  MOVE", "W  JUMP", "S  FAST FALL", "F  ATTACK", "G  SPECIAL", "V  DODGE"]);
    controlCard(w / 2 + 12, cy, cw, "#f72585", "PLAYER 2", ["← →  MOVE", "↑  JUMP", "↓  FAST FALL", "K  ATTACK", "L  SPECIAL", ";  DODGE"]);
  };

  function controlCard(x, y, w, color, title, lines) {
    const h = 36 + lines.length * 19;
    ctx.save();
    ctx.fillStyle = "rgba(6,6,18,0.55)";
    rr(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = fontPlain(15, 800);
    ctx.textAlign = "left";
    ctx.fillStyle = color;
    ctx.fillText(title, x + 14, y + 23);
    ctx.font = fontPlain(14, 700);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    lines.forEach((l, i) => ctx.fillText(l, x + 14, y + 40 + i * 19));
    ctx.restore();
  }

  R.select = function (game) {
    const { w, h } = R.size();
    const t = game.time;
    const n = SF.ROSTER.length;

    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#070716");
    g.addColorStop(0.6, "#181034");
    g.addColorStop(1, "#33103a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = "#7b6bff";
    ctx.lineWidth = 1;
    for (let i = 0; i < 24; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * 40);
      ctx.lineTo(w, i * 40);
      ctx.stroke();
    }
    ctx.restore();

    text("CHOOSE YOUR FIGHTER", w / 2, h * 0.082, Math.max(15, w * 0.026), "#ffffff", { lw: 6 });

    const rows = Math.ceil(n / 7);
    const cols = Math.ceil(n / rows);
    const gap = Math.min(16, w * 0.011);
    const cardW = Math.min((w * 0.9 - (cols - 1) * gap) / cols, 190);
    const cardH = Math.min((h * 0.55 - (rows - 1) * gap) / rows, 200);
    const gridW = cols * cardW + (cols - 1) * gap;
    const startX = w / 2 - gridW / 2;
    const startY = h * 0.11;

    for (let i = 0; i < n; i++) {
      const c = SF.ROSTER[i];
      const cx = startX + (i % cols) * (cardW + gap);
      const cy = startY + Math.floor(i / cols) * (cardH + gap);
      const sel1 = game.cursor[0] === i;
      const sel2 = game.cursor[1] === i;
      const hover = sel1 || sel2;

      ctx.save();
      const yy = cy + (hover ? -4 : 0);
      ctx.fillStyle = hover ? "rgba(26,22,54,0.96)" : "rgba(14,12,30,0.82)";
      rr(ctx, cx, yy, cardW, cardH, 12);
      ctx.fill();
      ctx.lineWidth = hover ? 3 : 1.5;
      if (sel1 && sel2) {
        const grd = ctx.createLinearGradient(cx, yy, cx + cardW, yy + cardH);
        grd.addColorStop(0, "#4cc9f0");
        grd.addColorStop(1, "#f72585");
        ctx.strokeStyle = grd;
      } else if (sel1) ctx.strokeStyle = "#4cc9f0";
      else if (sel2) ctx.strokeStyle = "#f72585";
      else ctx.strokeStyle = "rgba(255,255,255,0.1)";
      rr(ctx, cx, yy, cardW, cardH, 12);
      ctx.stroke();
      ctx.restore();

      /* portrait */
      const ph = cardH * 0.66;
      ctx.save();
      rr(ctx, cx + 4, yy + 4, cardW - 8, ph, 9);
      ctx.clip();
      const pg = ctx.createLinearGradient(cx, yy, cx, yy + ph);
      pg.addColorStop(0, SF.rgba(c.palette.glow, 0.35));
      pg.addColorStop(1, "rgba(6,4,16,0.1)");
      ctx.fillStyle = pg;
      ctx.fillRect(cx, yy, cardW, ph);
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = c.palette.glow;
      ctx.beginPath();
      ctx.arc(cx + cardW / 2, yy + ph * 0.55, cardW * 0.3, 0, SF.TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      const fake = {
        x: cx + cardW / 2,
        y: yy + ph * 0.94,
        facing: 1,
        palette: c.palette,
        char: c,
        animT: t + i * 1.3,
        state: "idle",
        attack: null,
        runCycle: 0,
        landSquash: 0,
        flash: 0,
        frozen: 0,
      };
      R.drawFighter(fake, { scale: Math.min(1.9, cardW / 96), tag: null });
      ctx.restore();

      text(c.name, cx + cardW / 2, yy + cardH * 0.78, Math.max(10, cardW * 0.082), "#ffffff", { lw: 4 });
      ctx.save();
      ctx.font = fontPlain(Math.max(6.5, cardW * 0.045), 700);
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.42)";
      ctx.fillText(c.series, cx + cardW / 2, yy + cardH * 0.885);
      ctx.restore();

      /* player chips */
      const chips = [];
      if (sel1) chips.push({ label: game.locked[0] ? "P1 ✓" : "P1", color: "#4cc9f0" });
      if (sel2)
        chips.push({
          label: game.locked[1] ? (game.mode === 1 ? "CPU ✓" : "P2 ✓") : game.mode === 1 ? "CPU" : "P2",
          color: "#f72585",
        });
      chips.forEach((ch, j) => {
        const chipY = yy + 2 + j * 20;
        ctx.save();
        ctx.fillStyle = ch.color;
        rr(ctx, cx + cardW - 54, chipY, 50, 18, 9);
        ctx.fill();
        ctx.font = fontPlain(10.5, 800);
        ctx.textAlign = "center";
        ctx.fillStyle = "#0b0b16";
        ctx.fillText(ch.label, cx + cardW - 29, chipY + 13);
        ctx.restore();
      });
    }

    /* detail panel */
    const activeIdx = game.locked[0] ? game.cursor[1] : game.cursor[0];
    const ac = SF.ROSTER[activeIdx];
    const dy = startY + rows * (cardH + gap) + 6;
    const dh = Math.max(48, Math.min(h * 0.19, h - dy - 66));

    ctx.save();
    ctx.fillStyle = "rgba(8,8,20,0.72)";
    rr(ctx, w * 0.1, dy, w * 0.8, dh, 12);
    ctx.fill();
    ctx.strokeStyle = SF.rgba(ac.palette.accent, 0.5);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    text(ac.name, w * 0.135, dy + dh * 0.34, Math.max(12, Math.min(w * 0.021, dh * 0.3)), ac.palette.accent, {
      align: "left",
      lw: 4,
    });
    ctx.save();
    ctx.font = fontPlain(Math.max(8.5, Math.min(w * 0.0115, dh * 0.155)), 700);
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText(ac.tag + "   ·   " + ac.series, w * 0.135, dy + dh * 0.58);
    ctx.fillStyle = "rgba(255,255,255,0.44)";
    ctx.fillText(ac.blurb, w * 0.135, dy + dh * 0.83);
    ctx.restore();

    /* stat bars on the right */
    const stats = [
      ["SPD", ac.gauge.speed],
      ["PWR", ac.gauge.power],
      ["JMP", ac.gauge.jump],
      ["WGT", ac.gauge.weight],
    ];
    const bw = Math.min(w * 0.16, 180);
    stats.forEach((s, j) => {
      const bx = w * 0.84 - bw;
      const by = dy + dh * (0.16 + j * 0.19);
      ctx.save();
      ctx.font = fontPlain(Math.max(7.5, dh * 0.115), 700);
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillText(s[0], bx, by + 6);
      ctx.restore();
      tally(bx + 34, by, bw - 34, 6, s[1], ac.palette.accent, "rgba(255,255,255,0.12)");
    });

    /* prompt */
    const ready = game.locked[0] && (game.mode === 1 || game.locked[1]);
    const prompt = ready
      ? "PRESS ENTER TO FIGHT"
      : !game.locked[0]
      ? "P1: A / D / W / S TO BROWSE, F OR ENTER TO LOCK IN"
      : game.mode === 1
      ? "CPU IS READY — PRESS ENTER"
      : "P2: ARROWS TO BROWSE, K TO LOCK IN";
    text(prompt, w / 2, h - 28, Math.max(10.5, w * 0.014), ready ? "#ffe066" : "rgba(255,255,255,0.8)", { lw: 4 });
    text("ESC — BACK TO TITLE", w / 2, h - 10, Math.max(8, w * 0.01), "rgba(255,255,255,0.35)", {
      plain: true,
      stroke: false,
    });
  };

  R.results = function (game) {
    const { w, h } = R.size();
    const t = game.time;
    ctx.fillStyle = "rgba(4,4,14,0.72)";
    ctx.fillRect(0, 0, w, h);

    const win = game.winner;
    if (!win) return;
    const col = win.palette.accent;

    ctx.save();
    const a = Math.min(1, game.resultT * 2.5);
    ctx.globalAlpha = a;
    ctx.translate(w / 2, h * 0.44);
    ctx.scale(1 + Math.sin(t * 4) * 0.008, 1 + Math.sin(t * 4) * 0.008);
    text((win.index === 0 ? "PLAYER 1" : game.mode === 1 ? "CPU" : "PLAYER 2") + " WINS!", 0, -60, Math.max(22, w * 0.05), "#ffffff", {
      lw: 10,
    });
    text(win.name, 0, 30, Math.max(30, w * 0.075), col, { lw: 12 });
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = a;
    const fake = {
      x: w / 2,
      y: h * 0.63,
      facing: 1,
      palette: win.palette,
      char: win.char,
      animT: t * 2,
      state: "idle",
      attack: null,
      runCycle: 0,
      landSquash: 0,
      flash: 0,
      frozen: 0,
    };
    R.drawFighter(fake, { scale: Math.min(w, h) / 330, tag: null });
    ctx.restore();

    const secs = Math.floor(game.elapsed);
    const timeStr = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    text(`${win.stocks} STOCK${win.stocks === 1 ? "" : "S"} LEFT  -  ${timeStr}`, w / 2, h * 0.78, Math.max(12, w * 0.015), "rgba(255,255,255,0.75)", {
      lw: 4,
    });
    text("ENTER — REMATCH", w / 2, h * 0.86, Math.max(14, w * 0.017), "#ffe066", { lw: 4 });
    text("ESC — CHARACTER SELECT", w / 2, h * 0.91, Math.max(12, w * 0.014), "rgba(255,255,255,0.6)", { lw: 3 });
  };

  R.pause = function (game) {
    const { w, h } = R.size();
    ctx.fillStyle = "rgba(4,4,14,0.7)";
    ctx.fillRect(0, 0, w, h);
    text("PAUSED", w / 2, h * 0.4, Math.max(30, w * 0.05), "#ffffff", { lw: 10 });
    text("ESC — RESUME", w / 2, h * 0.49, Math.max(13, w * 0.015), "#ffe066", { lw: 4 });
    text("ENTER — QUIT TO CHARACTER SELECT", w / 2, h * 0.55, Math.max(13, w * 0.015), "rgba(255,255,255,0.75)", { lw: 4 });
    text("P1  A/D MOVE  W JUMP  S FALL  F ATTACK  G SPECIAL  V DODGE", w / 2, h * 0.64, Math.max(13, w * 0.014), "rgba(180,225,255,0.8)", {
      plain: true,
      stroke: false,
    });
    text("P2  ← → MOVE  ↑ JUMP  ↓ FALL  K ATTACK  L SPECIAL  ; DODGE", w / 2, h * 0.68, Math.max(13, w * 0.014), "rgba(255,190,225,0.8)", {
      plain: true,
      stroke: false,
    });
    text("M — MUTE SOUND", w / 2, h * 0.74, Math.max(12, w * 0.013), "rgba(255,255,255,0.4)", { plain: true, stroke: false });
  };

  R.countdown = function (game, panel) {
    const txt = game.countdown > 2.2 ? "3" : game.countdown > 1.2 ? "2" : game.countdown > 0.2 ? "1" : "GO!";
    const k = (game.countdown % 1) || 1;
    const size = Math.max(34, panel.w * 0.14) * (1.15 - k * 0.15);
    ctx.save();
    ctx.globalAlpha = SF.clamp(k * 1.6, 0, 1);
    text(txt, panel.x + panel.w / 2, panel.y + panel.h * 0.4, size, txt === "GO!" ? "#7dffb0" : "#ffffff", {
      lw: size * 0.14,
    });
    ctx.restore();
  };

  R.koBanner = function (game) {
    if (game.koFlash <= 0 || !game.koText) return;
    const { w, h } = R.size();
    const a = SF.clamp(game.koFlash * 2, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    text(game.koText, w / 2, h * 0.22, Math.max(18, w * 0.028), "#ff5d7a", { lw: 8 });
    ctx.restore();
  };
})();
