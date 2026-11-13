/* =========================================================================
   ai.js: a simple, beatable CPU opponent for player 2
   ========================================================================= */
(function () {
  const CPU = (SF.CPU = {
    sample(f, foe, dt) {
      const s = SF.input.blank();
      if (!f || !f.alive || !foe || !foe.alive) return s;

      const ai = f.ai || (f.ai = { atk: 0, jump: 0, spec: 0, dodge: 0, wander: 0, ult: SF.rand(3, 7) });
      ai.atk -= dt;
      ai.jump -= dt;
      ai.spec -= dt;
      ai.dodge -= dt;
      ai.ult -= dt;

      const dx = foe.x - f.x;
      const dy = foe.y - f.y;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      const dir = dx >= 0 ? 1 : -1;

      const foeOff = !foe.alive || foe.x < -410 || foe.x > 410 || foe.y > 145;

      /* ---- recover when off stage */
      const offStage = f.x < -438 || f.x > 438 || f.y > 140;
      if (offStage && !f.onGround) {
        const toward = f.x > 0 ? -1 : 1;
        s.left = toward < 0;
        s.right = toward > 0;
        /* spend the air jump while still near stage height, not after falling past it */
        if (f.jumps > 0 && f.y > 20 && ai.jump <= 0) {
          s.jump = true;
          ai.jump = 0.3;
        }
        return s;
      }

      /* ---- guard the ledge rather than chase someone who fell off */
      if (foeOff && f.onGround) {
        const home = f.x > 40 ? -1 : f.x < -40 ? 1 : 0;
        s.left = home < 0;
        s.right = home > 0;
        return s;
      }

      /* ---- close the distance, keep a little room */
      let move = 0;
      if (adx > 92 || ady > 70) move = dir;
      else if (adx < 40) move = -dir;

      /* never walk off the ledge on purpose */
      if (f.onGround) {
        if (f.x > 368 && move > 0) move = 0;
        if (f.x < -368 && move < 0) move = 0;
      }
      /* in the air, do not drift further toward the blast zone */
      if (!f.onGround) {
        if (f.x > 300 && move > 0) move = -1;
        if (f.x < -300 && move < 0) move = 1;
      }
      s.left = move < 0;
      s.right = move > 0;

      /* ---- attacks */
      if (adx < 104 && ady < 74 && ai.atk <= 0) {
        s.attack = true;
        if (dy < -50) s.up = true;
        else if (dy > 44) s.down = true;
        ai.atk = SF.rand(0.3, 0.62);
      }

      /* ---- specials by character */
      const type = f.char.special.type;
      if (ai.spec <= 0) {
        if (type === "pound" || type === "punch") {
          if (adx < 140 && ady < 120) {
            s.special = true;
            ai.spec = 1.8;
          }
        } else if (type === "pulse") {
          if (adx < 200 && ady < 150) {
            s.special = true;
            ai.spec = 1.8;
          }
        } else if (type === "dash") {
          if (adx > 130 && adx < 330 && ady < 80 && Math.abs(f.x) < 150) {
            s.special = true;
            ai.spec = 1.6;
          }
        } else if (adx > 150 && adx < 760 && ady < 150) {
          s.special = true;
          ai.spec = SF.rand(1.1, 2.1);
        }
      }

      /* ---- ultimate when the meter is full and the foe is in range */
      if (ai.ult <= 0 && f.ultCharge >= 1) {
        const u = f.char.ult || {};
        const far = u.kind === "beam" || u.kind === "orb" || u.kind === "barrage" || u.kind === "storm";
        if (adx < (far ? 620 : 330) && ady < 240) {
          s.ult = true;
          ai.ult = SF.rand(4, 7);
        }
      }

      /* ---- jumping (never near the ledge, always keep one air jump for recovery) */
      if (ai.jump <= 0 && Math.abs(f.x) < 250 && (f.onGround || f.jumps > 1)) {
        const foeAbove = dy < -80 && adx < 320;
        const wantsApproach = adx > 230 && f.onGround && Math.random() < 0.05;
        const pokePlatform = adx < 260 && Math.abs(foe.y - (f.y - 200)) < 90 && Math.random() < 0.05;
        if (foeAbove || wantsApproach || pokePlatform) {
          s.jump = true;
          ai.jump = 0.42;
        }
      }

      /* ---- defensive dodge */
      if (ai.dodge <= 0 && foe.state === "attack" && adx < 120 && ady < 70 && Math.random() < 0.22) {
        s.dodge = true;
        ai.dodge = 1.1;
      }

      return s;
    },
  });
})();
