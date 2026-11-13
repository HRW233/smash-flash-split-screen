/* =========================================================================
   effects.js: particles, projectiles, screen shake
   ========================================================================= */
(function () {
  function rbox(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, r);
    else c.rect(x, y, w, h);
  }

  function drawShot(c, p) {
    const style = p.style || "orb";
    const col = p.color || "#ffffff";
    c.save();

    if (style === "fist") {
      const ox = p.owner ? p.owner.x : p.x - p.vx * 0.05;
      const oy = p.owner ? p.owner.y - 34 : p.y;
      const skin = p.owner ? p.owner.palette.skin : "#f2c49b";
      c.strokeStyle = skin;
      c.lineWidth = 8;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(ox, oy);
      c.lineTo(p.x - (p.vx >= 0 ? 12 : -12), p.y);
      c.stroke();
      c.strokeStyle = "rgba(30,20,20,0.35)";
      c.lineWidth = 2;
      c.stroke();
      c.translate(p.x, p.y);
      c.fillStyle = skin;
      c.strokeStyle = "#1a1214";
      c.lineWidth = 2.4;
      rbox(c, -11, -11, 22, 22, 7);
      c.fill();
      c.stroke();
      c.strokeStyle = "rgba(90,50,40,0.6)";
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(-4, -10);
      c.lineTo(-4, 7);
      c.moveTo(3, -10);
      c.lineTo(3, 7);
      c.stroke();
    } else if (style === "beam") {
      c.translate(p.x, p.y);
      c.scale(p.vx >= 0 ? 1 : -1, 1);
      c.globalCompositeOperation = "lighter";
      const g = c.createLinearGradient(-70, 0, 30, 0);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.55, col);
      g.addColorStop(1, "rgba(255,255,255,0.95)");
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(-16, 0, 62, p.r, 0, 0, SF.TAU);
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.95)";
      c.beginPath();
      c.ellipse(6, 0, 32, p.r * 0.42, 0, 0, SF.TAU);
      c.fill();
      c.fillStyle = col;
      c.beginPath();
      c.arc(20, 0, p.r * 0.9, 0, SF.TAU);
      c.fill();
    } else if (style === "bolt") {
      c.translate(p.x, p.y);
      c.globalCompositeOperation = "lighter";
      const dir = p.vx >= 0 ? 1 : -1;
      c.strokeStyle = col;
      c.lineWidth = 4;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(-dir * 46, 0);
      for (let i = 0; i < 5; i++) {
        c.lineTo(-dir * (36 - i * 10), (i % 2 ? 1 : -1) * (9 - i));
      }
      c.lineTo(0, 0);
      c.stroke();
      c.fillStyle = "#fffbe0";
      c.beginPath();
      c.arc(0, 0, p.r * 0.85, 0, SF.TAU);
      c.fill();
      c.strokeStyle = col;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, 0, p.r * 1.4, 0, SF.TAU);
      c.stroke();
    } else if (style === "crescent") {
      c.translate(p.x, p.y);
      if (p.vx < 0) c.rotate(Math.PI);
      c.globalCompositeOperation = "lighter";
      c.strokeStyle = col;
      c.lineWidth = 9;
      c.beginPath();
      c.arc(0, 0, p.r * 0.9, -1.15, 1.15);
      c.stroke();
      c.strokeStyle = "rgba(240,252,255,0.95)";
      c.lineWidth = 3;
      c.beginPath();
      c.arc(0, 0, p.r * 0.9, -0.95, 0.95);
      c.stroke();
    } else if (style === "spike") {
      c.translate(p.x, p.y);
      c.fillStyle = "#6d4f36";
      c.strokeStyle = "#2a1d14";
      c.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const x = -16 + i * 15;
        const hh = 34 - i * 8;
        c.beginPath();
        c.moveTo(x - 8, 4);
        c.lineTo(x, -hh);
        c.lineTo(x + 8, 4);
        c.closePath();
        c.fill();
        c.stroke();
      }
      c.globalCompositeOperation = "lighter";
      c.fillStyle = col;
      c.globalAlpha = 0.5;
      c.beginPath();
      c.ellipse(0, 0, 24, 6, 0, 0, SF.TAU);
      c.fill();
    } else if (style === "ice") {
      c.translate(p.x, p.y);
      c.rotate(p.t * 14 * (p.vx >= 0 ? 1 : -1));
      c.globalCompositeOperation = "lighter";
      c.fillStyle = "rgba(150,235,255,0.45)";
      c.beginPath();
      c.arc(0, 0, p.r * 1.9, 0, SF.TAU);
      c.fill();
      c.fillStyle = "#e9fbff";
      c.beginPath();
      c.moveTo(0, -p.r * 1.5);
      c.lineTo(p.r * 0.8, 0);
      c.lineTo(0, p.r * 1.5);
      c.lineTo(-p.r * 0.8, 0);
      c.closePath();
      c.fill();
      c.strokeStyle = "#57c8ee";
      c.lineWidth = 2;
      c.stroke();
    } else if (style === "column") {
      /* a bolt of lightning dropped straight down out of the sky */
      c.globalCompositeOperation = "lighter";
      let seed = (p.seed || 7) % 2147483647;
      const pts = [];
      let y = -560;
      pts.push([0, y]);
      for (let i = 0; i < 11; i++) {
        seed = (seed * 16807) % 2147483647;
        const jx = ((seed % 1000) / 1000 - 0.5) * 40;
        y += 58;
        pts.push([jx, y]);
      }
      c.strokeStyle = SF.rgba(col, 0.35);
      c.lineWidth = 16;
      c.lineJoin = "round";
      c.beginPath();
      pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])));
      c.stroke();
      c.strokeStyle = col;
      c.lineWidth = 5;
      c.beginPath();
      pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])));
      c.stroke();
      c.strokeStyle = "rgba(255,255,245,0.95)";
      c.lineWidth = 2;
      c.beginPath();
      pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])));
      c.stroke();
      const g2 = c.createRadialGradient(0, 0, 2, 0, 0, 46);
      g2.addColorStop(0, "rgba(255,255,240,0.9)");
      g2.addColorStop(1, SF.rgba(col, 0));
      c.fillStyle = g2;
      c.beginPath();
      c.arc(0, 0, 46, 0, SF.TAU);
      c.fill();
    } else if (style === "fire") {
      c.translate(p.x, p.y);
      c.globalCompositeOperation = "lighter";
      const grd = c.createRadialGradient(0, 0, 2, 0, 0, p.r * 2.1);
      grd.addColorStop(0, "#fff3c4");
      grd.addColorStop(0.4, "#ffb03a");
      grd.addColorStop(1, "rgba(255,80,20,0)");
      c.fillStyle = grd;
      c.beginPath();
      c.arc(0, 0, p.r * 2.1, 0, SF.TAU);
      c.fill();
      c.fillStyle = "#ffe9a8";
      c.beginPath();
      c.arc(0, 0, p.r * 0.55, 0, SF.TAU);
      c.fill();
    } else {
      /* orb */
      c.translate(p.x, p.y);
      c.globalCompositeOperation = "lighter";
      const grd = c.createRadialGradient(0, 0, 2, 0, 0, p.r * 2.2);
      grd.addColorStop(0, "#ffffff");
      grd.addColorStop(0.35, col);
      grd.addColorStop(1, "rgba(80,120,255,0)");
      c.fillStyle = grd;
      c.beginPath();
      c.arc(0, 0, p.r * 2.2, 0, SF.TAU);
      c.fill();
      c.strokeStyle = "rgba(255,255,255,0.9)";
      c.lineWidth = 2;
      for (let i = 0; i < 2; i++) {
        c.beginPath();
        c.ellipse(0, 0, p.r * (0.7 + i * 0.35), p.r * 0.42, p.t * 12 + i, 0, SF.TAU);
        c.stroke();
      }
    }

    c.restore();
  }

  const W = (SF.World = {
    particles: [],
    projectiles: [],
    shake: 0,

    reset() {
      this.particles.length = 0;
      this.projectiles.length = 0;
      this.shake = 0;
    },

    shakeTo(n) {
      this.shake = Math.min(30, Math.max(this.shake, n));
    },

    add(p) {
      if (this.particles.length > 640) this.particles.shift();
      if (p.life === undefined) p.life = 0.3;
      p.max = p.life;
      this.particles.push(p);
    },

    burst(x, y, color, count, speed, opts) {
      const o = opts || {};
      for (let i = 0; i < count; i++) {
        const a = o.angle !== undefined ? o.angle + SF.rand(-o.spread, o.spread) : SF.rand(0, SF.TAU);
        const s = speed * SF.rand(0.35, 1.15);
        this.add({
          type: o.type || "spark",
          x,
          y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: (o.life || 0.32) * SF.rand(0.7, 1.25),
          size: (o.size || 4) * SF.rand(0.7, 1.3),
          color,
          grav: o.grav === undefined ? 700 : o.grav,
          drag: o.drag || 1.5,
          rot: SF.rand(0, SF.TAU),
          vr: SF.rand(-8, 8),
        });
      }
    },

    dust(x, y, dir, count) {
      const n = count === undefined ? 6 : count;
      for (let i = 0; i < n; i++) {
        this.add({
          type: "puff",
          x: x + SF.rand(-10, 10),
          y: y - SF.rand(0, 5),
          vx: SF.rand(-70, 70) + (dir || 0) * 40,
          vy: SF.rand(-90, -20),
          life: SF.rand(0.25, 0.5),
          size: SF.rand(5, 11),
          color: "#cdd6e6",
          grav: -40,
          drag: 2.6,
        });
      }
    },

    hitSpark(x, y, p, color) {
      const n = 6 + Math.round(p * 14);
      this.burst(x, y, color, n, 420 + p * 620, { size: 4 + p * 3, life: 0.28 + p * 0.16 });
      this.burst(x, y, "#ffffff", Math.round(3 + p * 5), 260 + p * 240, { size: 3.5, life: 0.16 });
      this.add({
        type: "star",
        x,
        y,
        vx: 0,
        vy: 0,
        life: 0.16 + p * 0.1,
        size: 20 + p * 46,
        color: "#ffffff",
        rot: SF.rand(0, 0.6),
        vr: 2,
      });
      this.add({
        type: "ring",
        x,
        y,
        vx: 0,
        vy: 0,
        life: 0.24,
        size: 26 + p * 50,
        color,
      });
    },

    ring(x, y, color, size) {
      this.add({ type: "ring", x, y, vx: 0, vy: 0, life: 0.3, size: size || 26, color });
    },

    smashText(x, y, p) {
      this.add({
        type: "text",
        x,
        y,
        vx: 0,
        vy: -90,
        life: 0.5,
        size: 22 + p * 14,
        color: p > 0.85 ? "#ff4d4d" : "#ffd166",
        text: p > 0.85 ? "SMASH!!" : "SMASH!",
      });
    },

    muzzle(x, y, color, dir) {
      this.burst(x, y, color, 8, 220, {
        angle: dir > 0 ? 0 : Math.PI,
        spread: 0.5,
        size: 5,
        life: 0.22,
        grav: 0,
      });
    },

    dashBurst(x, y, color, dir) {
      this.burst(x, y, color, 12, 260, {
        angle: dir > 0 ? Math.PI : 0,
        spread: 0.7,
        size: 5,
        life: 0.3,
        grav: 0,
      });
    },

    dashTrail(f) {
      this.add({
        type: "streak",
        x: f.x - f.facing * 20,
        y: f.y - 26 + SF.rand(-12, 12),
        vx: -f.facing * 120,
        vy: 0,
        life: 0.2,
        size: 24,
        color: f.palette.glow,
        alpha: 0.55,
        grav: 0,
      });
    },

    shockwave(x, y, owner, opts) {
      const o = opts || {};
      this.projectiles.push({
        kind: "shock",
        owner,
        x,
        y,
        r: 20,
        rMax: o.rMax || 165,
        dur: o.dur || 0.3,
        t: 0,
        life: 1,
        dmg: o.dmg || 15,
        base: o.base || 360,
        scale: o.scale || 6.5,
        angle: o.angle || 74,
        power: 1,
        hit: new Set(),
        dir: 0,
        color: o.color || "#ffb454",
        circle: !!o.circle,
      });
      this.burst(x, y, o.color || "#ffcf7a", 16, 380, { angle: -Math.PI / 2, spread: 1.5, size: 5, life: 0.4 });
    },

    spawnProjectile(o) {
      o.t = 0;
      if (!o.hit) o.hit = new Set();
      if (o.life === undefined) o.life = 1.4;
      if (o.grav === undefined) o.grav = 0;
      this.projectiles.push(o);
      return o;
    },

    koBurst(x, y, color) {
      this.burst(x, y, color, 26, 720, { size: 7, life: 0.7, grav: 300 });
      this.burst(x, y, "#ffffff", 12, 420, { size: 5, life: 0.5, grav: 100 });
      this.add({ type: "ring", x, y, vx: 0, vy: 0, life: 0.55, size: 150, color });
      this.add({ type: "ring", x, y, vx: 0, vy: 0, life: 0.35, size: 90, color: "#ffffff" });
    },

    chargePuff(f) {
      if (Math.random() > 0.45) return;
      const a = SF.rand(0, SF.TAU);
      this.add({
        type: "spark",
        x: f.x + Math.cos(a) * SF.rand(16, 40),
        y: f.y - 26 + Math.sin(a) * SF.rand(16, 36),
        vx: -Math.cos(a) * 120,
        vy: -Math.sin(a) * 120,
        life: 0.22,
        size: 4,
        color: f.palette.glow,
        grav: 0,
        drag: 0.4,
      });
    },

    /* ------------------------------------------------------------- update */
    update(dt, fighters) {
      this.shake *= Math.pow(0.0009, dt);
      if (this.shake < 0.3) this.shake = 0;

      const ps = this.particles;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.life -= dt;
        if (p.life <= 0) {
          ps.splice(i, 1);
          continue;
        }
        p.vy += (p.grav || 0) * dt;
        if (p.drag) {
          const d = Math.pow(0.5, p.drag * dt * 4);
          p.vx *= d;
          p.vy *= d;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.vr) p.rot += p.vr * dt;
      }

      const prs = this.projectiles;
      for (let i = prs.length - 1; i >= 0; i--) {
        const p = prs[i];
        p.t += dt;
        p.life -= dt;
        let dead = p.life <= 0;

        if (p.kind === "shock") {
          const k = SF.clamp(p.t / p.dur, 0, 1);
          p.r = p.rMax * SF.easeOutCubic(k);
          if (k >= 1) dead = true;
        } else {
          p.vy += (p.grav || 0) * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          const look = p.style || "orb";
          if (look === "fire" || look === "orb" || look === "bolt" || look === "beam") {
            if (Math.random() < 0.5) {
              this.add({
                type: "puff",
                x: p.x - p.vx * 0.012,
                y: p.y - p.vy * 0.012,
                vx: SF.rand(-40, 40),
                vy: SF.rand(-50, -10),
                life: 0.24,
                size: look === "beam" ? 7 : 9,
                color: p.color || "#ff9d3d",
                grav: -60,
                drag: 2,
              });
            }
          } else if (look === "ice" || look === "spike" || look === "crescent") {
            if (Math.random() < 0.4) {
              this.add({
                type: "shard",
                x: p.x,
                y: p.y,
                vx: SF.rand(-60, 60),
                vy: SF.rand(-40, 60),
                life: 0.3,
                size: 3,
                color: p.color || "#d9f6ff",
                grav: 300,
                rot: SF.rand(0, 6),
                vr: 6,
              });
            }
          }
          /* stage collision (piercing beams ignore it) */
          if (!p.pierce) {
            const py = p.y;
            for (const pl of SF.STAGE.platforms) {
              if (p.x > pl.x1 && p.x < pl.x2 && py > pl.y - 4 && py - p.vy * dt < pl.y + 14) {
                this.burst(p.x, pl.y, p.color || "#fff", 8, 190, { size: 4, life: 0.28 });
                dead = true;
              }
            }
          }
          if (p.x < SF.BLAST.left || p.x > SF.BLAST.right || p.y < SF.BLAST.top || p.y > SF.BLAST.bottom) dead = true;
        }

        /* hits */
        for (const f of fighters) {
          if (!f || f === p.owner || p.hit.has(f) || !f.canBeHit()) continue;
          let hit = false;
          if (p.kind === "shock") {
            const d = Math.hypot(f.x - p.x, f.y - 26 - p.y);
            hit = d < p.r + 16;
          } else {
            const hb = f.hurtbox;
            const cx = SF.clamp(p.x, hb.x, hb.x + hb.w);
            const cy = SF.clamp(p.y, hb.y, hb.y + hb.h);
            hit = Math.hypot(p.x - cx, p.y - cy) < (p.r || 14) * 0.85;
          }
          if (hit) {
            p.hit.add(f);
            const dx = f.x - p.x;
            const dir = p.kind === "shock" ? (dx >= 0 ? 1 : -1) : p.dir || (p.vx >= 0 ? 1 : -1);
            f.receiveHit(
              p.owner,
              { dmg: p.dmg, base: p.base, scale: p.scale, angle: p.angle, freeze: p.freeze || 0 },
              p.power || 1,
              dir,
              p.x,
              p.y
            );
            if (p.kind !== "shock" && !p.pierce) dead = true;
          }
        }

        if (dead) prs.splice(i, 1);
      }
    },

    /* --------------------------------------------------------------- draw */
    draw(ctx) {
      for (const p of this.particles) {
        const k = SF.clamp(p.life / p.max, 0, 1);
        if (p.type === "spark" || p.type === "streak") {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = k;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.type === "streak" ? p.size * k : p.size * k;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * (p.type === "streak" ? 0.09 : 0.02), p.y - p.vy * 0.02);
          ctx.stroke();
          ctx.restore();
        } else if (p.type === "puff") {
          ctx.save();
          ctx.globalAlpha = k * 0.5;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1.5 - k * 0.6), 0, SF.TAU);
          ctx.fill();
          ctx.restore();
        } else if (p.type === "star") {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = k;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          const r = p.size * (0.7 + (1 - k) * 0.7);
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * SF.TAU;
            const rr = i % 2 ? r * 0.22 : r;
            const x = Math.cos(a) * rr;
            const y = Math.sin(a) * rr;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else if (p.type === "ring") {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = k * 0.85;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2 + 5 * k;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.25 + (1 - k) * 0.95), 0, SF.TAU);
          ctx.stroke();
          ctx.restore();
        } else if (p.type === "shard") {
          ctx.save();
          ctx.globalAlpha = k;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6);
          ctx.restore();
        } else if (p.type === "text") {
          ctx.save();
          ctx.globalAlpha = Math.min(1, k * 2.2);
          ctx.font = `900 italic ${p.size}px "Trebuchet MS", "Segoe UI", sans-serif`;
          ctx.textAlign = "center";
          ctx.lineWidth = 6;
          ctx.strokeStyle = "rgba(10,8,18,0.85)";
          ctx.strokeText(p.text, p.x, p.y);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text, p.x, p.y);
          ctx.restore();
        }
      }

      for (const p of this.projectiles) {
        if (p.kind === "shock") {
          const k = SF.clamp(p.t / p.dur, 0, 1);
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = (1 - k) * 0.9;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 8 * (1 - k) + 1;
          ctx.beginPath();
          if (p.circle) ctx.arc(p.x, p.y, p.r, 0, SF.TAU);
          else ctx.ellipse(p.x, p.y - 4, p.r, p.r * 0.42, 0, 0, SF.TAU);
          ctx.stroke();
          ctx.globalAlpha = (1 - k) * 0.45;
          ctx.strokeStyle = "#fff2c4";
          ctx.lineWidth = 3;
          ctx.beginPath();
          if (p.circle) ctx.arc(p.x, p.y, p.r * 0.72, 0, SF.TAU);
          else ctx.ellipse(p.x, p.y - 4, p.r * 0.7, p.r * 0.28, 0, 0, SF.TAU);
          ctx.stroke();
          ctx.restore();
          continue;
        }
        drawShot(ctx, p);
      }
    },
  });
})();
