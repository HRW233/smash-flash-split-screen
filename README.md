# SMASH FLASH — Split Screen

A two-player platform fighter in the style of Super Smash Flash, built with vanilla JavaScript and
canvas — split screen on one keyboard, or online against a friend. The screen splits down the
middle: each player gets their own camera that frames the fight around their own fighter, zooms with
the distance between the two, and points an arrow at the opponent when they leave the view.
Everything is drawn into a small offscreen buffer and scaled up with nearest-neighbour sampling, so
the whole game has a chunky pixel-art look.

No build step, no dependencies, no image or audio files — every fighter, effect and sound is
generated at runtime.

## Play

Open `index.html`, or serve the folder:

```sh
python -m http.server 8000
# then open http://localhost:8000
```

Two people can share one keyboard, or play from two machines over the internet — see below.

### Player 1

| Key | Action |
|---|---|
| `A` / `D` | move |
| `W` | jump (again in the air for a second jump) |
| `S` | fast fall |
| `F` | attack — hold on the ground for a charged smash |
| `G` | special |
| `V` | dodge |

### Player 2

| Key | Action |
|---|---|
| `←` / `→` | move |
| `↑` | jump (again in the air for a second jump) |
| `↓` | fast fall |
| `K` | attack — hold on the ground for a charged smash |
| `L` | special |
| `;` | dodge |

`Enter` confirms, `Esc` pauses, `M` mutes.

Holding `W`/`↑` jumps full height; tapping gives a short hop.

Attacks are directional, and every direction is its own move. On the ground: forward is a
chargeable smash, up is an anti-air, down is a low sweep. In the air: neutral is a plain aerial,
toward the foe is a forward kick, away is a back kick that throws them behind you, up is a rising
uppercut and down is a spike that drives them toward the blast zone.

## Play online

Two people on different machines can fight over the internet. No account, no server of ours, no
port forwarding.

1. Press `O` on the title screen.
2. One player picks **HOST A MATCH** and gets a five-character room code.
3. The other picks **JOIN WITH A CODE** and types that code in.
4. Each player picks a fighter with `A` / `D`; the host presses `Enter` to start. `Esc` leaves.

Both players use the player 1 keys (`W` `A` `S` `D`, `F`, `G`, `V`) on their own keyboard.

One browser runs the match and the other sends its button presses and draws the state it receives
back, so both screens show the same fight. The connection is a direct WebRTC link between the two
browsers; PeerJS's public broker is used only to introduce them, and the match itself is not relayed
through anything. Very strict corporate or school networks can block direct peer connections.

## Rules

Four stocks each. Damage builds as a percentage, and knockback grows with it — high percentages
launch across the blast zone. Landing refills your air jump. Last fighter standing wins.

## Roster

Fourteen fighters, each with their own speed, weight, jump and special:

| Fighter | Special |
|---|---|
| GOJO | **BLUE** — shockwave ring around him |
| GON | **JAJANKEN** — charged haymaker |
| KILLUA | **GODSPEED** — electric dash strike |
| EREN | **TITAN SLAM** — leap and ground shockwave |
| LUFFY | **GUM-GUM PISTOL** — fist on a stretching arm |
| NARUTO | **RASENGAN** — heavy spinning orb |
| GOKU | **KAMEHAMEHA** — piercing beam |
| ASH & PIKACHU | **THUNDERBOLT** — fast bolt |
| ICHIGO | **GETSUGA TENSHO** — crescent projectile |
| EDWARD | **ALCHEMY SPIKE** — stone spikes from the floor |
| BLAZE | **FIREBALL** |
| VOLT | **VOLT DASH** |
| IRON | **IRON QUAKE** |
| FROST | **ICE SHARD** (freezes) |

Versus CPU is available from the title screen for solo play.

## Structure

```
index.html      page shell
style.css       fullscreen canvas
js/util.js      math helpers, keyboard input, WebAudio sound
js/roster.js    fighter stats, palettes and specials
js/stage.js     stage layout and scenery
js/effects.js   particles, projectiles, screen shake
js/fighter.js   physics, states, attacks and knockback
js/ai.js        CPU opponent
js/render.js    stage art, procedural fighters, HUD, menus
js/net.js       online play: room codes, WebRTC link, lobby
js/game.js      match flow, cameras, main loop
```

Fan project, made for fun and not affiliated with any of the series represented.
