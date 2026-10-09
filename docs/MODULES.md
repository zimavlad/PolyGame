# Writing an arcade game or an "ad" mini-game for PolyGame

PolyGame is a static web game (no build step). `js/core.js` is the engine and exposes `window.PG`.
Every arcade game lives in `js/games/<id>.js`, every ad mini-game in `js/minis/<id>.js`.
A module is a plain script wrapped in an IIFE that calls `PG.arcade.register(...)` or `PG.ads.register(...)`.
`index.html` already loads all planned module files; do not edit `index.html`, `js/core.js` or `js/levels.js`.

Reference implementations: `js/games/spike.js`, `js/games/stack.js` (arcade) and `js/minis/popit.js` (mini-game).

All text the player sees is **Ukrainian**. Draw everything with the canvas: no images, no external assets, no DOM.

## Running a module on its own

Open `index.html` with a query string (works from `file://`):

- `index.html?nolog&arcade=<id>&level=<n>` — plays the arcade game at level n, restarts it after each round.
- `index.html?nolog&ad=<id>` — shows the mini-game in its ad frame, again after it closes.

`nolog` keeps test runs out of the telemetry. `window.__poly` exposes `AR` (arcade host state: `AR.sub` is
`intro | play | paused | ending | result`, `AR.inst` is your instance, `AR.won`, `AR.level`, `AR.goal`) and `AD`
(ad host: `AD.inst`, `AD.done`). Playwright is installed globally: run tests with `NODE_PATH=$(npm root -g) node test.js`.

## The PG API

Everything draws on one canvas already scaled for the device pixel ratio: use CSS pixels.

| Name | What it is |
| --- | --- |
| `PG.now` | current time in seconds (getter; read it each time) |
| `PG.ctx` | the 2D context (the same object your `draw(ctx, A)` receives) |
| `PG.arena` | the arcade arena rect `{x, y, w, h}` (portrait, about 370×500 on a phone) |
| `PG.PAL` | `['#F2615E', '#F5B12E', '#22B59B', '#7765EE']` coral, amber, teal, violet |
| `PG.INK`, `PG.SOFT`, `PG.DIM`, `PG.CARD`, `PG.FIELD`, `PG.SPIKE`, `PG.GOOD`, `PG.BAD` | ink `#27303F`, soft grey text, light grey, white, page background, spike grey, green, red |
| `PG.FD`, `PG.FB` | font stacks: display (Unbounded, chunky) and body (Nunito, rounded) |
| `PG.clamp, lerp, rand(a,b), randi(n), pick(arr), shuffle(arr)` | maths helpers |
| `PG.easeOutBack, easeOutCubic, easeInOut, rgba(hex, a)` | easing and colour helpers |
| `PG.circle(x,y,r)`, `PG.rrect(x,y,w,h,r)` | build a path (then `ctx.fill()` / `ctx.stroke()`) |
| `PG.txt(str, x, y, size, color, {font, weight, align, max})` | centred text by default; `max` squeezes to a width |
| `PG.dot(x, y, r, color)` | a glossy dot (the game's visual signature) |
| `PG.wrapText(str, maxW, font)` | returns lines |
| `PG.sfx.*` | sounds: `pick place bad back pop chain(i) note(i) loop flap wall candy coin hit whoosh tick die stack(i) cut win over` |
| `PG.buzz(PG.HAP.tick / light / soft / double / success / thud)` | soft haptics (already throttled) |
| `PG.burst(x, y, color, n, speed)` | particle burst |
| `PG.floatText(x, y, text, color, size)` | rising pop-up text |
| `PG.shake(amount)` | screen shake (respects reduced motion) |
| `PG.reward({energy, score, x, y})` | pays the player; with x/y it also pops "+1 ⚡". Returns energy actually gained |
| `PG.log(type, data)` | telemetry event (use sparingly; the host already logs start/end) |

## Arcade game contract

```js
PG.arcade.register({
  id: 'knife',                    // file name, lowercase
  title: 'Knife Hit',
  family: 'Ketchapp',             // or 'Класика'
  accent: '#7765EE',              // key colour, ideally from PG.PAL
  howto: ['Тапни, щоб кинути ніж', 'Не влуч у ніж, що вже стирчить'], // 1–2 short lines
  goal: level => ({ count: 6 + level, unit: 'ножів' }),               // what wins a round at this level
  icon(ctx, x, y, r) { /* optional tiny icon inside a circle of radius r */ },
  create(level, api) { /* api.level, api.fill (0..1 puzzle board fill) */ return inst; }
});
```

The instance:

```js
inst = {
  progress: 0,          // count toward goal(level).count; the host ends the round as WON when progress reaches it
  over: null,           // set { won: false, cause: 'spike' } when the player fails; never set won:true yourself
  stats: {},            // optional numbers for telemetry
  idle(dt, A) {},       // optional: animates during the intro card and pause
  start() {},           // optional: called on the first tap (that tap is ALSO passed to tap())
  tap(x, y) {},         // pointer down anywhere in the arena (or Space/Enter, with the arena centre)
  move(x, y) {}, up(x, y) {},   // optional
  update(dt, A) {},     // every frame while playing, and ~0.9 s after the round ends (animate the death/win)
  win() {},             // optional: called once when the goal is reached (stop spawning hazards, celebrate)
  draw(ctx, A) {}       // paint the whole arena: background first, then the game. The host clips to A.
};
```

Rules the host relies on:

- **Level 1 must be easy**: a first-time casual player should win it in one or two tries, in 20–45 seconds.
  Each level adds a little (speed, gaps, hazards, goal). Inside a round, ramp gently toward the goal.
  Keep the goal count modest (roughly 6–12 at level 1, growing ~2 per level, capped).
- `dt` is capped at 1/30 s. Do not use `Date.now()` for gameplay; use `PG.now` or accumulate `dt`.
- `A` can change between frames (rotation, resize): keep positions relative to `A` (fractions of `A.w/A.h`).
- The host draws: the intro card (top part of the arena) with title/level/goal/howto, a pause card, a thin progress bar
  along the bottom 20 px of the arena and the result panel. Do not draw your own intro or result screens.
- Pay rewards with `PG.reward(...)`: small score for routine actions (5–10), `energy: 1` for a rare pickup or a perfect
  move. The host adds +100 score and +1 energy on a win.
- Sounds and haptics on every meaningful action (tap, success, fail). Use `PG.burst` / `PG.floatText` for juice.
- Look: flat Ketchapp-like minimalism, the shared palette, soft pastel backgrounds, big readable shapes. Show the current
  progress number large in the background like Stack/Spike Rush do.
- Never throw: the host catches errors and ends the round as a loss, but a thrown error is a bug.

## Ad mini-game contract

These parody "playable ads": a short mini-game (10–30 s) inside a fake ad frame with a cheesy headline.
The frame, the 15-second close button, the reward and the "Ще раз" button belong to the host.

```js
PG.ads.register({
  id: 'pin',
  title: 'Pull the Pin',
  hook: '99% не витягнуть правильну шпильку!',   // the cheesy ad headline, short (fits two lines)
  create(api) { /* api.area = the play rect */ return inst; }
});
inst = {
  over: null,              // set { won: true } or { won: false } when the mini-game ends
  hint: 'Тапни по шпильці', // optional one-line instruction shown under the game
  update(dt, A) {},
  draw(ctx, A) {},         // paint inside the play rect A (the host clips to it and fills a light background)
  down(x, y, A) {}, move(x, y, A) {}, up(x, y, A) {}   // pointer input inside A
};
```

Make it winnable on the first or second try by most people (that is the joke of these ads: "99% fail", then it is easy),
with a visible timer or move counter when there is a limit, and a clear win moment.
