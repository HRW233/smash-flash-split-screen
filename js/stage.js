/* =========================================================================
   stage.js: layout, platforms, spawn points and parallax scenery
   ========================================================================= */
(function () {
  const STAGE = {
    name: "SKY TEMPLE",
    floor: { x1: -430, x2: 430, y: 120 },
    platforms: [
      { x1: -430, x2: 430, y: 120, main: true },
      { x1: -300, x2: -124, y: -14, main: false },
      { x1: 124, x2: 300, y: -14, main: false },
      { x1: -92, x2: 92, y: -188, main: false },
    ],
    spawns: [
      { x: -180, y: 120 },
      { x: 180, y: 120 },
    ],
    respawn: { x: 0, y: -250 },
  };

  /* deterministic backdrop props */
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    clouds.push({
      x: -1700 + (i / 13) * 3400 + Math.sin(i * 7.3) * 90,
      y: -560 + ((i * 173) % 520),
      s: 0.55 + ((i * 37) % 100) / 130,
      v: 6 + ((i * 13) % 9),
      a: 0.1 + ((i * 11) % 7) / 40,
    });
  }
  const pillars = [];
  for (let i = 0; i < 7; i++) {
    pillars.push({ x: -1500 + i * 500, h: 260 + ((i * 97) % 220), w: 70 + ((i * 41) % 60) });
  }

  STAGE.clouds = clouds;
  STAGE.pillars = pillars;

  /* is a point inside the solid body of the main island? */
  STAGE.solidAt = (x, y) => {
    if (y < STAGE.floor.y) return false;
    if (x < STAGE.floor.x1 || x > STAGE.floor.x2) return false;
    const depth = y - STAGE.floor.y;
    const taper = 60 - depth * 0.55;
    return x > STAGE.floor.x1 + Math.max(0, taper) && x < STAGE.floor.x2 - Math.max(0, taper);
  };

  STAGE.platformAt = (x) => {
    for (const p of STAGE.platforms) {
      if (x >= p.x1 && x <= p.x2) return p;
    }
    return null;
  };

  SF.STAGE = STAGE;
})();
