/* =========================================================================
   roster.js: the fighter roster, their stats, moves and palettes
   ========================================================================= */
(function () {
  const B = {
    side: { startup: 0.105, active: 0.09, recovery: 0.21, box: { x: 12, y: -58, w: 58, h: 46 }, dmg: 11, base: 315, scale: 7, angle: 34, chargeable: true, maxCharge: 0.85 },
    up: { startup: 0.1, active: 0.11, recovery: 0.24, box: { x: -8, y: -106, w: 64, h: 68 }, dmg: 9, base: 305, scale: 6.5, angle: 84 },
    down: { startup: 0.13, active: 0.1, recovery: 0.27, box: { x: -42, y: -24, w: 86, h: 30 }, dmg: 13, base: 265, scale: 6, angle: 18 },
    air: { startup: 0.09, active: 0.17, recovery: 0.22, box: { x: -10, y: -82, w: 74, h: 72 }, dmg: 11, base: 290, scale: 7, angle: 42 },
    /* one aerial per direction: forward kicks, back kicks, rising uppercut, downward spike */
    airFwd: { startup: 0.09, active: 0.15, recovery: 0.24, box: { x: 12, y: -78, w: 74, h: 60 }, dmg: 12, base: 300, scale: 7, angle: 38 },
    airBack: { startup: 0.1, active: 0.14, recovery: 0.26, box: { x: -74, y: -72, w: 66, h: 58 }, dmg: 13, base: 320, scale: 7.2, angle: 145 },
    airUp: { startup: 0.08, active: 0.16, recovery: 0.22, box: { x: -16, y: -120, w: 62, h: 66 }, dmg: 10, base: 305, scale: 6.4, angle: 86 },
    airDown: { startup: 0.11, active: 0.16, recovery: 0.28, box: { x: -24, y: -40, w: 58, h: 58 }, dmg: 14, base: 255, scale: 5.8, angle: 282 },
  };

  /* scale a move set by a fighter's stats */
  function build(stats, tweak) {
    const t = tweak || {};
    const power = stats.power;
    const slow = 1 + (1 - stats.speed) * 0.45;
    const out = {};
    for (const k of Object.keys(B)) {
      const m = B[k];
      const dmgMul = k === "side" ? t.sideDmg || 1 : 1;
      const kbMul = k === "side" ? t.sideKb || 1 : 1;
      out[k] = {
        kind: k,
        startup: m.startup * slow * (t.startup || 1),
        active: m.active,
        recovery: m.recovery * slow * (t.recovery || 1),
        box: m.box,
        dmg: m.dmg * power * dmgMul,
        base: m.base * power * kbMul,
        scale: m.scale,
        angle: m.angle,
        chargeable: !!m.chargeable,
        maxCharge: m.maxCharge || 0.85,
      };
    }
    return out;
  }

  const ROSTER = [
    {
      key: "gojo",
      name: "GOJO",
      series: "JUJUTSU KAISEN",
      tag: "THE STRONGEST",
      blurb: "Long limbs, longer reach. Blue detonates around him and throws everyone out.",
      stats: { speed: 1.12, jump: 1.06, weight: 0.96, power: 1.22 },
      gauge: { speed: 0.86, jump: 0.68, weight: 0.6, power: 0.92 },
      palette: { skin: "#ffe3c8", hair: "#f4f9ff", top: "#1c2340", pants: "#11162a", boots: "#0d1120", accent: "#7fd0ff", outline: "#0b0c16", glow: "#6ee7ff" },
      style: { hair: "fluffy", blindfold: true, coat: true, collar: true },
      special: { type: "pulse", cooldown: 1.15, label: "BLUE", dmg: 13, base: 380, scale: 6, angle: 72, rMax: 205, color: "#7fd0ff" },
      moves: build({ speed: 1.12, power: 1.22 }, { sideKb: 1.02 }),
      quote: '"NAH, I\'D WIN."',
    },
    {
      key: "gon",
      name: "GON",
      series: "HUNTER x HUNTER",
      tag: "JAJANKEN",
      blurb: "Honest footsies and one enormous fist. Land the rock and it ends early.",
      stats: { speed: 1.06, jump: 1.1, weight: 0.9, power: 1.16 },
      gauge: { speed: 0.72, jump: 0.8, weight: 0.42, power: 0.86 },
      palette: { skin: "#ffd9b0", hair: "#1f3b2c", top: "#2f7d4f", pants: "#23403a", boots: "#1a2b26", accent: "#b6ff6b", outline: "#101a14", glow: "#8cff6b" },
      style: { hair: "spiky", shoulders: 0.9 },
      special: { type: "punch", cooldown: 0.95, label: "JAJANKEN", dmg: 19, base: 430, scale: 7, angle: 32 },
      moves: build({ speed: 1.06, power: 1.16 }, { sideDmg: 1.05 }),
      quote: '"I\'LL DO IT MY WAY."',
    },
    {
      key: "killua",
      name: "KILLUA",
      series: "HUNTER x HUNTER",
      tag: "GODSPEED",
      blurb: "Fastest feet on the roster. Godspeed crosses the stage in a flash of static.",
      stats: { speed: 1.3, jump: 1.18, weight: 0.82, power: 0.92 },
      gauge: { speed: 0.98, jump: 0.95, weight: 0.16, power: 0.5 },
      palette: { skin: "#ffd9b0", hair: "#eaf6ff", top: "#e8f4ff", pants: "#4b3f72", boots: "#2a2340", accent: "#7ff9ff", outline: "#101828", glow: "#9df9ff" },
      style: { hair: "fluffy", spark: true, scarf: false },
      special: { type: "dash", cooldown: 0.95, label: "GODSPEED", dmg: 12, base: 330, scale: 6, angle: 26, speed: 1200, color: "#9df9ff" },
      moves: build({ speed: 1.3, power: 0.92 }, { startup: 0.9 }),
      quote: '"YOU\'RE TOO SLOW."',
    },
    {
      key: "eren",
      name: "EREN",
      series: "ATTACK ON TITAN",
      tag: "TITAN SHIFTER",
      blurb: "Heavy, stubborn, and hard to launch. A titan slam shakes the whole island.",
      stats: { speed: 0.98, jump: 0.94, weight: 1.18, power: 1.2 },
      gauge: { speed: 0.5, jump: 0.4, weight: 0.9, power: 0.9 },
      palette: { skin: "#e8bd93", hair: "#5a3a22", top: "#b9a17a", pants: "#3a3f2e", boots: "#2a2418", accent: "#8ef0a0", outline: "#151410", glow: "#8ef0a0", cloak: "#3f6b45" },
      style: { hair: "tied", coat: true, shoulders: 1.15 },
      special: { type: "pound", cooldown: 1.4, label: "TITAN SLAM", dmg: 16, base: 390, scale: 7, angle: 72, rMax: 180, color: "#8ef0a0" },
      moves: build({ speed: 0.98, power: 1.2 }, { sideDmg: 1.06, sideKb: 1.05 }),
      quote: '"I\'LL KEEP MOVING FORWARD."',
    },
    {
      key: "luffy",
      name: "LUFFY",
      series: "ONE PIECE",
      tag: "STRAW HAT",
      blurb: "Stretches a fist across the stage. Rubber means he always bounces back.",
      stats: { speed: 1.1, jump: 1.06, weight: 1.02, power: 1.12 },
      gauge: { speed: 0.8, jump: 0.7, weight: 0.62, power: 0.8 },
      palette: { skin: "#f2c49b", hair: "#1c1c22", top: "#d7263d", pants: "#2b6cb0", boots: "#7a5230", accent: "#ffd166", outline: "#1a1214", glow: "#ffcf5c" },
      style: { hair: "short", strawhat: true, scarf: false },
      special: { type: "projectile", style: "fist", cooldown: 0.55, label: "GUM-GUM PISTOL", dmg: 10, base: 300, scale: 5, angle: 22, speed: 900, r: 15, life: 0.5, gravity: 0, color: "#ffcf5c" },
      moves: build({ speed: 1.1, power: 1.12 }, {}),
      quote: '"I\'M GONNA BE KING OF THE PIRATES."',
    },
    {
      key: "naruto",
      name: "NARUTO",
      series: "NARUTO",
      tag: "NINE TAILS",
      blurb: "Loud, fast and relentless. A rasengan in the face ends most arguments.",
      stats: { speed: 1.1, jump: 1.12, weight: 0.98, power: 1.1 },
      gauge: { speed: 0.8, jump: 0.86, weight: 0.55, power: 0.78 },
      palette: { skin: "#ffd9b0", hair: "#ffd94a", top: "#ff7a1a", pants: "#1f2430", boots: "#2b3444", accent: "#ffb703", outline: "#1a1208", glow: "#ffa53d", metal: "#9aa7b4" },
      style: { hair: "spiky", headband: true, shoulders: 0.95 },
      special: { type: "projectile", style: "orb", cooldown: 0.85, label: "RASENGAN", dmg: 15, base: 390, scale: 6, angle: 28, speed: 440, r: 18, life: 1.0, gravity: 0, color: "#7cc7ff" },
      moves: build({ speed: 1.1, power: 1.1 }, { sideDmg: 1.04 }),
      quote: '"BELIEVE IT!"',
    },
    {
      key: "goku",
      name: "GOKU",
      series: "DRAGON BALL",
      tag: "SUPER SAIYAN",
      blurb: "Big damage, big reach, big beam. The kamehameha cuts straight through a foe.",
      stats: { speed: 1.08, jump: 1.14, weight: 1.06, power: 1.26 },
      gauge: { speed: 0.78, jump: 0.92, weight: 0.7, power: 0.98 },
      palette: { skin: "#ffd9b0", hair: "#14161f", top: "#f28c1b", pants: "#e07b12", boots: "#2b4c8c", accent: "#ffe066", outline: "#171008", glow: "#ffd23f" },
      style: { hair: "goku", shoulders: 1.05 },
      special: { type: "projectile", style: "beam", cooldown: 1.0, label: "KAMEHAMEHA", dmg: 17, base: 330, scale: 5, angle: 18, speed: 980, r: 15, life: 0.55, gravity: 0, color: "#8fe9ff", pierce: true },
      moves: build({ speed: 1.08, power: 1.26 }, { sideKb: 1.06 }),
      quote: '"LET\'S FIGHT."',
    },
    {
      key: "ash",
      name: "ASH & PIKACHU",
      series: "POKEMON",
      tag: "THUNDER PARTNER",
      blurb: "Pikachu rides shotgun and fires off thunderbolts while Ash holds the line.",
      stats: { speed: 1.02, jump: 1.04, weight: 0.88, power: 0.98 },
      gauge: { speed: 0.58, jump: 0.66, weight: 0.35, power: 0.5 },
      palette: { skin: "#ffd9b0", hair: "#1c1c22", top: "#2b6cb0", pants: "#3a4a5f", boots: "#2a3444", accent: "#e63946", outline: "#14141c", glow: "#ffe066" },
      style: { hair: "short", cap: true, companion: "pikachu" },
      special: { type: "projectile", style: "bolt", cooldown: 0.7, label: "THUNDERBOLT", dmg: 9, base: 270, scale: 5, angle: 24, speed: 820, r: 13, life: 0.65, gravity: 0, color: "#ffe066" },
      moves: build({ speed: 1.02, power: 0.98 }, { startup: 0.94 }),
      quote: '"PIKA, PIKA!"',
    },
    {
      key: "ichigo",
      name: "ICHIGO",
      series: "BLEACH",
      tag: "SUBSTITUTE SOUL REAPER",
      blurb: "A huge blade and a wider arc. Getsuga Tensho flies as a crescent of pressure.",
      stats: { speed: 1.04, jump: 1.0, weight: 1.1, power: 1.18 },
      gauge: { speed: 0.64, jump: 0.56, weight: 0.8, power: 0.86 },
      palette: { skin: "#ffd9b0", hair: "#ff7a1a", top: "#1a1a24", pants: "#1a1a24", boots: "#0e0e16", accent: "#68e0ff", outline: "#0b0b14", glow: "#4cc9f0", blade: "#dfe9f5" },
      style: { hair: "ichigo", sword: true, shoulders: 1.05 },
      special: { type: "projectile", style: "crescent", cooldown: 0.9, label: "GETSUGA TENSHO", dmg: 14, base: 330, scale: 6, angle: 30, speed: 760, r: 22, life: 0.65, gravity: 0, color: "#68e0ff" },
      moves: build({ speed: 1.04, power: 1.18 }, { sideKb: 1.04 }),
      quote: '"BANKAI."',
    },
    {
      key: "ed",
      name: "EDWARD",
      series: "FULLMETAL ALCHEMIST",
      tag: "FULLMETAL",
      blurb: "Claps and the floor answers. Stone spikes erupt wherever he points.",
      stats: { speed: 1.0, jump: 1.02, weight: 1.04, power: 1.14 },
      gauge: { speed: 0.56, jump: 0.58, weight: 0.7, power: 0.82 },
      palette: { skin: "#ffd9b0", hair: "#e8c66a", top: "#b3122b", pants: "#1f2430", boots: "#2a3444", accent: "#7fe3ff", outline: "#150f10", glow: "#8fe8ff", metal: "#b9c4cf" },
      style: { hair: "braid", coat: true, automail: true },
      special: { type: "projectile", style: "spike", cooldown: 0.9, label: "ALCHEMY SPIKE", dmg: 14, base: 360, scale: 6, angle: 70, speed: 620, r: 18, life: 0.55, gravity: 0, color: "#c9a27a", ground: true },
      moves: build({ speed: 1.0, power: 1.14 }, {}),
      quote: '"A LESSON IN ALCHEMY."',
    },
    /* ---- the original four, kept for the home crowd ---- */
    {
      key: "blaze",
      name: "BLAZE",
      series: "SMASH FLASH",
      tag: "THE EMBER BRAWLER",
      blurb: "Heavy hands, hotter temper. Charged smashes and a fireball to close the gap.",
      stats: { speed: 1.04, jump: 1.0, weight: 1.05, power: 1.1 },
      gauge: { speed: 0.52, jump: 0.5, weight: 0.55, power: 0.42 },
      palette: { skin: "#ffd9b0", hair: "#ff4d2e", top: "#c1121f", pants: "#2b2d42", boots: "#1a1c2c", accent: "#ffb703", outline: "#20131a", glow: "#ff7a2f" },
      style: { hair: "spiky", shoulders: 1.1, flame: true },
      special: { type: "projectile", style: "fire", cooldown: 0.62, label: "FIREBALL", dmg: 8, base: 240, scale: 5, angle: 26, speed: 660, r: 15, life: 1.5, gravity: 95, color: "#ff9a3d" },
      moves: build({ speed: 1.04, power: 1.1 }, { sideDmg: 1.08, sideKb: 1.05 }),
      quote: '"ONE MORE ROUND."',
    },
    {
      key: "volt",
      name: "VOLT",
      series: "SMASH FLASH",
      tag: "THE STORM SPRINTER",
      blurb: "Fast, floaty and fragile. Dash straight through a foe with a crackling special.",
      stats: { speed: 1.26, jump: 1.16, weight: 0.84, power: 0.9 },
      gauge: { speed: 0.94, jump: 0.9, weight: 0.16, power: 0.3 },
      palette: { skin: "#ffd9b0", hair: "#25e6ff", top: "#1f6feb", pants: "#101a33", boots: "#0b1220", accent: "#f9f871", outline: "#101828", glow: "#38e1ff" },
      style: { hair: "spiky", shoulders: 0.85, scarf: true, visor: true, spark: true },
      special: { type: "dash", cooldown: 1.05, label: "VOLT DASH", dmg: 13, base: 340, scale: 6.5, angle: 26, speed: 1080, color: "#38e1ff" },
      moves: build({ speed: 1.26, power: 0.9 }, { startup: 0.9, recovery: 0.95 }),
      quote: '"BLINK AND LOSE."',
    },
    {
      key: "iron",
      name: "IRON",
      series: "SMASH FLASH",
      tag: "THE ANVIL",
      blurb: "Slow to start, impossible to launch. Drop a shockwave on anyone standing still.",
      stats: { speed: 0.84, jump: 0.87, weight: 1.36, power: 1.22 },
      gauge: { speed: 0.22, jump: 0.24, weight: 0.98, power: 0.86 },
      palette: { skin: "#d9a066", hair: "#3b2a1e", top: "#5a6b7b", pants: "#38424d", boots: "#232b33", accent: "#ff9f1c", outline: "#161b20", glow: "#ffb454" },
      style: { hair: "buzz", shoulders: 1.45, helmet: true, plate: true },
      special: { type: "pound", cooldown: 1.45, label: "IRON QUAKE", dmg: 15, base: 360, scale: 6.5, angle: 74, rMax: 165, color: "#ffb454" },
      moves: build({ speed: 0.84, power: 1.22 }, { sideDmg: 1.1, sideKb: 1.1 }),
      quote: '"STAY DOWN."',
    },
    {
      key: "frost",
      name: "FROST",
      series: "SMASH FLASH",
      tag: "THE PALE WIND",
      blurb: "Even tools across the board. Ice shards freeze a foe in place for a free smash.",
      stats: { speed: 1.0, jump: 1.02, weight: 1.0, power: 1.02 },
      gauge: { speed: 0.45, jump: 0.56, weight: 0.5, power: 0.36 },
      palette: { skin: "#ffe0c2", hair: "#cfefff", top: "#3a86b8", pants: "#25445c", boots: "#16283a", accent: "#e8f7ff", outline: "#101c26", glow: "#7fd8ff" },
      style: { hair: "long", scarf: true, hood: true, frost: true },
      special: { type: "projectile", style: "ice", cooldown: 0.85, label: "ICE SHARD", dmg: 6, base: 200, scale: 4.5, angle: 30, speed: 560, r: 13, life: 1.5, gravity: 25, freeze: 0.55, color: "#b8ecff" },
      moves: build({ speed: 1.0, power: 1.02 }, {}),
      quote: '"HOLD STILL."',
    },
  ];

  for (const c of ROSTER) {
    c.index = ROSTER.indexOf(c);
    c.koColor = c.palette.accent;
  }

  SF.ROSTER = ROSTER;
  SF.charByKey = (k) => ROSTER.find((c) => c.key === k);
})();
