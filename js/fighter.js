/* =========================================================================
   fighter.js: physics, states, attacks, knockback
   ========================================================================= */
class Fighter {
  constructor(char, index, x, y) {
    this.char = char;
    this.index = index;
    this.name = char.name;
    this.palette = char.palette;
    this.hw = 16;
    this.hh = 48;

    this.runSpeed = 336 * char.stats.speed;
    this.jumpV = 1015 * char.stats.jump;
    this.airJumpV = 940 * char.stats.jump;
    this.weight = char.stats.weight;

    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = index === 0 ? 1 : -1;
    this.onGround = false;
    this.jumps = 2;
    this.cutJump = false;

    this.damage = 0;
    this.stocks = SF.STOCKS;
    this.state = "air";
    this.attack = null;
    this.spec = null;
    this.animT = Math.random() * 6;
    this.runCycle = 0;
    this.landSquash = 0;

    this.hitlag = 0;
    this.hitstun = 0;
    this.invuln = 0;
    this.frozen = 0;
    this.flash = 0;
    this.dodgeCd = 0;
    this.dodgeT = 0;
    this.specialCd = 0;
    this.koTimer = 0;
    this.dead = false;
    this.lastHitBy = null;
    this.moved = 0;
  }

  get hurtbox() {
    return { x: this.x - 15, y: this.y - this.hh, w: 30, h: this.hh };
  }

  get alive() {
    return !this.dead && this.state !== "ko";
  }

  canBeHit() {
    return this.alive && this.invuln <= 0;
  }

  /* ------------------------------------------------------------- update */
  update(dt, input, foe) {
    this.animT += dt;
    this.landSquash = Math.max(0, this.landSquash - dt * 3.6);
    this.flash = Math.max(0, this.flash - dt * 4.5);
    if (this.state !== "ko" && !this.dead) {
      this.invuln = Math.max(0, this.invuln - dt);
      this.dodgeCd = Math.max(0, this.dodgeCd - dt);
      this.specialCd = Math.max(0, this.specialCd - dt);
    }
    if (this.dead) return;
    if (this.hitlag > 0) {
      this.hitlag -= dt;
      return;
    }
    if (this.state === "ko") {
      this.koTimer -= dt;
      return;
    }

    if (this.frozen > 0) {
      this.frozen -= dt;
      this.vx *= Math.pow(0.02, dt);
      this.physics(dt);
      this.checkBlast();
      return;
    }

    if (this.state === "hurt") {
      this.hitstun -= dt;
      if (this.hitstun <= 0) this.state = this.onGround ? "idle" : "air";
    } else if (this.state === "dodge") {
      this.dodgeT -= dt;
      if (this.dodgeT <= 0) this.state = this.onGround ? "idle" : "air";
    } else if (this.state === "attack") {
      this.updateAttack(dt, input, foe);
    } else if (this.state === "special") {
      this.updateSpecial(dt, foe);
    } else {
      this.handleInput(dt, input);
    }

    this.physics(dt);
    this.checkBlast();
    this.runCycle += Math.abs(this.vx) * dt * 0.055;
  }

  handleInput(dt, input) {
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);

    if (input.dodge && this.dodgeCd <= 0) {
      this.doDodge(dir);
      return;
    }
    if (input.attack) {
      this.attackInput(input);
      return;
    }
    if (input.special) {
      this.doSpecial();
      return;
    }
    if (input.jump) this.jump();

    if (this.onGround) {
      if (dir !== 0) this.facing = dir;
      const target = dir * this.runSpeed;
      this.vx = SF.approach(this.vx, target, (dir ? SF.PHYS.groundAccel : SF.PHYS.friction) * dt);
      this.state = Math.abs(this.vx) > 26 ? "run" : "idle";
    } else {
      if (dir !== 0) this.facing = dir;
      this.vx = SF.approach(this.vx, dir * this.runSpeed * 0.92, SF.PHYS.airAccel * dt);
      if (input.down && this.vy > -120) this.vy = Math.max(this.vy, 820);
      this.state = "air";
    }

    if (!input.up && this.vy < -420 && !this.cutJump) {
      this.vy *= 0.44;
      this.cutJump = true;
    }
  }

  jump() {
    if (this.onGround) {
      this.vy = -this.jumpV;
      this.onGround = false;
      this.jumps = 2;
      this.cutJump = false;
      this.state = "air";
      SF.World.dust(this.x, this.y, 0, 5);
      SF.Sound.jump();
    } else if (this.jumps > 0) {
      this.jumps -= 1;
      this.vy = -this.airJumpV;
      this.cutJump = false;
      this.state = "air";
      SF.World.ring(this.x, this.y - 22, this.palette.accent, 22);
      SF.World.burst(this.x, this.y - 18, this.palette.glow, 8, 190, { size: 4, life: 0.26, grav: 0 });
      SF.Sound.airJump();
    }
  }

  /* ------------------------------------------------------------ attacks */
  attackInput(input) {
    if (this.onGround) {
      const kind = input.up ? "up" : input.down ? "down" : "side";
      this.startAttack(kind, input);
      return;
    }
    /* in the air every direction is its own move */
    const toward = this.facing > 0 ? input.right : input.left;
    const away = this.facing > 0 ? input.left : input.right;
    const kind = input.up
      ? "airUp"
      : input.down
      ? "airDown"
      : toward
      ? "airFwd"
      : away
      ? "airBack"
      : "air";
    this.startAttack(kind, input);
  }

  startAttack(kind, input) {
    const def = this.char.moves[kind];
    this.attack = { def, kind, t: 0, phase: "startup", chargeT: 0, power: 1, hit: new Set() };
    this.state = "attack";
    this.vx *= 0.25;
    if (def.chargeable && input && input.attackHeld) {
      this.attack.phase = "charge";
    } else {
      SF.Sound.swing();
    }
    if (!this.onGround && kind.startsWith("air")) this.vy = Math.min(this.vy, 120);
  }

  updateAttack(dt, input, foe) {
    const a = this.attack;
    if (!a) {
      this.state = this.onGround ? "idle" : "air";
      return;
    }
    const d = a.def;

    if (a.phase === "charge") {
      a.chargeT = Math.min(d.maxCharge, a.chargeT + dt);
      this.vx = SF.approach(this.vx, 0, 2800 * dt);
      if (a.chargeT > 0.1) SF.World.chargePuff(this);
      if (!input.attackHeld || a.chargeT >= d.maxCharge) {
        a.power = 1 + 0.8 * (a.chargeT / d.maxCharge);
        a.phase = "startup";
        a.t = 0;
        SF.Sound.swing();
      }
      return;
    }

    a.t += dt;
    if (a.phase === "startup" && a.t >= d.startup) {
      a.phase = "active";
      SF.World.burst(
        this.x + this.facing * 34,
        this.y - 34,
        this.palette.accent,
        5,
        150,
        { angle: this.facing > 0 ? 0 : Math.PI, spread: 0.9, size: 3, life: 0.2, grav: 0 }
      );
    }
    if (a.phase === "active") {
      this.checkHits(foe, d, a.power);
      if (a.t >= d.startup + d.active) a.phase = "recovery";
    }

    if (this.onGround) this.vx = SF.approach(this.vx, 0, 3200 * dt);
    else this.vx = SF.approach(this.vx, this.facing * this.runSpeed * 0.2, 700 * dt);

    if (a.t >= d.startup + d.active + d.recovery) {
      this.attack = null;
      this.state = this.onGround ? "idle" : "air";
    }
  }

  hitbox(box) {
    if (this.facing > 0) {
      return { x: this.x + box.x, y: this.y + box.y, w: box.w, h: box.h };
    }
    return { x: this.x - box.x - box.w, y: this.y + box.y, w: box.w, h: box.h };
  }

  checkHits(foe, d, power) {
    if (!foe || foe === this || !foe.canBeHit() || !this.attack) return;
    if (this.attack.hit.has(foe)) return;
    const box = this.hitbox(d.box);
    if (!SF.overlap(box, foe.hurtbox)) return;
    this.attack.hit.add(foe);
    foe.receiveHit(this, d, power, this.facing, box.x + box.w / 2, box.y + box.h / 2);
  }

  receiveHit(attacker, hit, power, dir, hx, hy) {
    if (!this.canBeHit()) return false;
    const pw = power || 1;
    const dmg = hit.dmg * pw;
    this.damage = Math.min(999, this.damage + dmg);

    const wf = 1.16 - (this.weight - 1) * 0.42;
    const kb = (hit.base + this.damage * hit.scale) * wf * 1.02;
    const launch = SF.clamp(kb, 100, 3100);
    const ang = SF.deg(hit.angle);
    this.vx = Math.cos(ang) * launch * dir;
    this.vy = -Math.sin(ang) * launch;

    this.onGround = false;
    this.state = "hurt";
    this.hitstun = SF.clamp(launch / 2100, 0.12, 1.4);
    this.hitlag = 0.045 + SF.clamp(dmg * 0.004, 0, 0.08);
    this.flash = 1;
    this.attack = null;
    this.spec = null;
    this.jumps = 2;
    this.cutJump = true;
    this.frozen = 0;
    if (hit.freeze) this.frozen = hit.freeze;
    this.lastHitBy = attacker;
    if (attacker) attacker.hitlag = this.hitlag;

    const p = SF.clamp(launch / 1900, 0, 1);
    SF.World.hitSpark(hx === undefined ? this.x : hx, hy === undefined ? this.y - 26 : hy, p, attacker ? attacker.palette.accent : "#ffffff");
    SF.World.shakeTo(3 + p * 10);
    SF.Sound.hit(p);
    if (p > 0.58) SF.World.smashText(this.x, this.y - 74, p);
    return true;
  }

  /* ------------------------------------------------------------- dodge */
  doDodge(dir) {
    this.dodgeCd = 0.62;
    this.state = "dodge";
    this.dodgeT = 0.34;
    this.invuln = Math.max(this.invuln, 0.26);
    this.attack = null;
    const d = dir !== 0 ? dir : -this.facing;
    this.vx = d * 560;
    if (!this.onGround) this.vy = Math.min(this.vy, -60);
    SF.World.dust(this.x, this.y, d, 4);
    SF.Sound.dodge();
  }

  /* ----------------------------------------------------------- specials */
  doSpecial() {
    const sp = this.char.special;
    if (this.specialCd > 0) return;
    this.specialCd = sp.cooldown;
    const snd =
      sp.type === "dash"
        ? "dash"
        : sp.type === "pound" || sp.type === "punch" || sp.type === "pulse"
        ? "pound"
        : sp.style === "ice"
        ? "ice"
        : "fire";
    SF.Sound.special(snd);
    this.attack = null;

    if (sp.type === "projectile") {
      const ground = !!sp.ground;
      SF.World.spawnProjectile({
        kind: "shot",
        style: sp.style || "orb",
        color: sp.color || this.palette.glow,
        owner: this,
        x: this.x + this.facing * (ground ? 16 : 26),
        y: this.y - (ground ? 12 : 34),
        vx: this.facing * (sp.speed || 600),
        vy: 0,
        grav: sp.gravity || 0,
        r: sp.r || 14,
        dmg: sp.dmg,
        base: sp.base,
        scale: sp.scale,
        angle: sp.angle,
        freeze: sp.freeze || 0,
        pierce: !!sp.pierce,
        dir: this.facing,
        life: sp.life || 1.2,
      });
      SF.World.muzzle(this.x + this.facing * 30, this.y - 34, sp.color || "#ffffff", this.facing);
      this.vx -= this.facing * 70;
      this.landSquash = 0.3;
      this.state = this.onGround ? "idle" : "air";
    } else if (sp.type === "dash") {
      this.state = "special";
      this.spec = { kind: "dash", t: 0, dur: 0.36, hit: new Set(), sp };
      this.invuln = Math.max(this.invuln, 0.22);
      this.vx = this.facing * (sp.speed || 1080);
      this.vy = 0;
      this.onGround = false;
      SF.World.dashBurst(this.x, this.y - 26, sp.color || this.palette.accent, this.facing);
    } else if (sp.type === "pound") {
      this.state = "special";
      this.spec = { kind: "pound", t: 0, dur: 1.2, hit: new Set(), slammed: false, sp };
      this.vy = -760;
      this.vx = this.facing * 280;
      this.onGround = false;
      SF.World.dust(this.x, this.y, 1, 8);
    } else if (sp.type === "punch") {
      this.state = "special";
      this.spec = { kind: "punch", t: 0, dur: 0.66, hit: new Set(), sp };
      this.vx *= 0.3;
      SF.World.ring(this.x + this.facing * 26, this.y - 34, sp.color || this.palette.glow, 26);
      SF.World.chargePuff(this);
    } else if (sp.type === "pulse") {
      this.state = "special";
      this.spec = { kind: "pulse", t: 0, dur: 0.44, hit: new Set(), sp };
      this.vx *= 0.3;
      SF.World.shockwave(this.x, this.y - 24, this, {
        dmg: sp.dmg,
        base: sp.base,
        scale: sp.scale,
        angle: sp.angle,
        rMax: sp.rMax || 200,
        color: sp.color || this.palette.glow,
        circle: true,
      });
      SF.World.ring(this.x, this.y - 24, sp.color || this.palette.glow, 96);
      SF.World.shakeTo(10);
    }
  }

  updateSpecial(dt, foe) {
    const s = this.spec;
    if (!s) {
      this.state = this.onGround ? "idle" : "air";
      return;
    }
    s.t += dt;
    const sp = s.sp || this.char.special;

    if (s.kind === "dash") {
      this.vx = SF.approach(this.vx, this.facing * 240, 2200 * dt);
      if (s.t > 0.02 && s.t < 0.28) {
        SF.World.dashTrail(this);
        if (foe && foe.canBeHit() && !s.hit.has(foe)) {
          const box = { x: this.x - 36, y: this.y - 58, w: 72, h: 58 };
          if (SF.overlap(box, foe.hurtbox)) {
            s.hit.add(foe);
            foe.receiveHit(
              this,
              { dmg: sp.dmg, base: sp.base, scale: sp.scale, angle: sp.angle },
              1,
              this.facing,
              this.x + this.facing * 26,
              this.y - 32
            );
          }
        }
      }
      if (s.t >= s.dur) {
        this.state = this.onGround ? "idle" : "air";
        this.spec = null;
      }
      return;
    }

    if (s.kind === "pound") {
      this.vx = SF.approach(this.vx, 0, 1700 * dt);
      if (this.onGround && s.t > 0.08 && !s.slammed) {
        s.slammed = true;
        SF.World.shockwave(this.x, this.y, this, {
          dmg: sp.dmg,
          base: sp.base,
          scale: sp.scale,
          angle: sp.angle,
          rMax: sp.rMax || 165,
          color: sp.color || this.palette.glow,
        });
        SF.World.dust(this.x, this.y, 0, 12);
        SF.World.shakeTo(13);
        SF.Sound.special("pound");
      }
      if (s.slammed && this.onGround && s.t > 0.5) {
        this.state = "idle";
        this.spec = null;
      }
      return;
    }

    if (s.kind === "punch") {
      this.vx = SF.approach(this.vx, 0, 3200 * dt);
      if (s.t > 0.2 && s.t < 0.36) {
        if (!s.swung) {
          s.swung = true;
          SF.World.burst(this.x + this.facing * 34, this.y - 34, sp.color || this.palette.accent, 10, 280, {
            angle: this.facing > 0 ? 0 : Math.PI,
            spread: 0.8,
            size: 3,
            life: 0.24,
            grav: 0,
          });
        }
        if (foe && foe.canBeHit() && !s.hit.has(foe)) {
          const box = this.hitbox({ x: 18, y: -68, w: 96, h: 64 });
          if (SF.overlap(box, foe.hurtbox)) {
            s.hit.add(foe);
            foe.receiveHit(
              this,
              { dmg: sp.dmg, base: sp.base, scale: sp.scale, angle: sp.angle },
              1,
              this.facing,
              box.x + box.w / 2,
              box.y + box.h / 2
            );
            SF.World.shakeTo(12);
          }
        }
      }
      if (s.t >= s.dur) {
        this.state = this.onGround ? "idle" : "air";
        this.spec = null;
      }
      return;
    }

    /* pulse: the damage is the shockwave spawned on cast */
    this.vx = SF.approach(this.vx, 0, 2600 * dt);
    if (s.t >= s.dur) {
      this.state = this.onGround ? "idle" : "air";
      this.spec = null;
    }
  }

  /* ------------------------------------------------------------ physics */
  physics(dt) {
    const wasGround = this.onGround;
    const impactV = this.vy;

    if (!this.onGround) {
      this.vy += SF.PHYS.gravity * dt;
      if (this.vy > SF.PHYS.maxFall) this.vy = SF.PHYS.maxFall;
      if (this.state === "hurt" || this.state === "dodge" || this.state === "special") {
        this.vx *= Math.pow(0.6, dt);
      }
    }

    if (this.state === "hurt" && this.onGround) {
      this.vx = SF.approach(this.vx, 0, 1100 * dt);
    }

    this.x += this.vx * dt;
    const prevY = this.y;
    this.y += this.vy * dt;
    this.onGround = false;

    if (this.vy >= 0) {
      for (const p of SF.STAGE.platforms) {
        if (this.x + 9 < p.x1 || this.x - 9 > p.x2) continue;
        if (prevY <= p.y + 3 && this.y >= p.y) {
          this.y = p.y;
          this.vy = 0;
          this.onGround = true;
          break;
        }
      }
    }

    if (this.onGround && !wasGround) this.onLand(impactV);
    if (this.onGround) this.cutJump = false;
  }

  onLand(impactV) {
    this.jumps = 2;
    const impact = SF.clamp(Math.abs(impactV) / 1250, 0, 1);
    this.landSquash = 0.4 + impact * 0.6;
    if (impact > 0.3) {
      SF.World.dust(this.x, this.y, 0, 3 + Math.round(impact * 6));
      SF.Sound.land();
    }
    if (this.state === "air") this.state = "idle";
  }

  checkBlast() {
    if (!this.alive) return;
    if (
      this.x < SF.BLAST.left ||
      this.x > SF.BLAST.right ||
      this.y < SF.BLAST.top ||
      this.y > SF.BLAST.bottom
    ) {
      this.ko();
    }
  }

  ko() {
    this.stocks -= 1;
    this.state = "ko";
    this.koTimer = 1.05;
    this.attack = null;
    this.spec = null;
    this.vx = 0;
    this.vy = 0;
    this.frozen = 0;
    this.damage = 0;
    if (this.stocks <= 0) this.dead = true;
    SF.World.koBurst(
      SF.clamp(this.x, -1080, 1080),
      SF.clamp(this.y, -960, 780),
      this.palette.glow
    );
    SF.World.shakeTo(20);
    SF.Sound.ko();
  }

  respawn() {
    this.x = SF.STAGE.respawn.x + (this.index === 0 ? -46 : 46);
    this.y = SF.STAGE.respawn.y;
    this.vx = 0;
    this.vy = 0;
    this.damage = 0;
    this.state = "air";
    this.onGround = false;
    this.invuln = 1.8;
    this.hitstun = 0;
    this.frozen = 0;
    this.jumps = 2;
    this.dead = false;
    this.stocks = Math.max(0, this.stocks);
    this.facing = this.index === 0 ? 1 : -1;
    SF.World.ring(this.x, this.y - 20, this.palette.accent, 30);
    SF.World.burst(this.x, this.y - 20, this.palette.glow, 12, 220, { size: 4, life: 0.35, grav: 0 });
  }

  updateKo() {
    if (this.state !== "ko") return;
    if (this.stocks > 0 && this.koTimer <= 0) this.respawn();
  }
}
