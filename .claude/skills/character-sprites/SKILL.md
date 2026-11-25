---
name: character-sprites
description: Turn photos of a real pet, person or object into a consistent game character and a set of transparent sprites (poses, run cycles, portraits) with Gemini image models (Nano Banana). Use when asked to create, draw, redesign or animate a character for a game or app from reference photos, to add new poses or frames for an existing character, or to cut generated art into sprites. Do not hand-draw characters with canvas paths or SVG when this skill fits — that path looked bad in testing.
---

# Character sprites from photos

A tested pipeline: reference photos → three style options → the chosen style as a pose set on a green screen →
clean transparent WebP sprites → wired into the game with a per-pose scale table. Made for PolyGame's dog Ava
(see `js/ava.js`, `img/ava/`), but nothing in it is specific to her.

## 0. Key

Needs a Google AI Studio key (Gemini API). Never write it into the repo or a command line that gets logged:
save it to a file in the scratchpad (`umask 077; printf '%s' "$KEY" > $SCRATCH/gkey`) and pass
`GEMINI_API_KEY_FILE=$SCRATCH/gkey`. If no key is at hand, ask for one with the request_credential tool where
available (host `generativelanguage.googleapis.com`, header `x-goog-api-key`) instead of having it pasted in chat.
Calls cost money (cents per image), so batch thoughtfully, but do generate in parallel (`&` + `wait`, 4 at a time).

Models (check `GET https://generativelanguage.googleapis.com/v1beta/models` for the current list):
- `gemini-3-pro-image` (Nano Banana Pro) — best likeness and detail; use for the style options and pose sets.
- `gemini-3.1-flash-image` (Nano Banana 2) — faster and cheaper; fine for extra frames once the look is fixed.
Allowed `--aspect` values: 1:1, 1:4, 1:8, 2:3, 3:2, 3:4, 4:1, 4:3, 4:5, 5:4, 8:1, 9:16, 16:9, 21:9.

## 1. Style options (show three, let the person choose)

Pass every reference photo with `--ref`, the clearest one first. Write a `BASE` prompt that lists every
distinguishing feature you can see in the photos (markings, colours, ear shape and asymmetry, tail, collar, tag text),
the pose, and "plain pure white background, no text". Then add one style line per option, for example:

- polished 3D cartoon render like a premium mobile game or animated film, soft lighting, stylised fur, slightly bigger head and eyes
- warm hand-painted children's storybook illustration, gouache texture, soft colours
- cute kawaii vector sticker, bold outlines, cel shading, chibi proportions

```bash
python3 .claude/skills/character-sprites/scripts/gen_image.py --out $OUT/s1.png --ref photo1.webp --ref photo2.webp ... --prompt "$BASE Style: ..."
python3 .claude/skills/character-sprites/scripts/contact_sheet.py $OUT/styles.jpg $OUT/s1.png $OUT/s2.png $OUT/s3.png --cols 3
```
Send the sheet to the person (SendUserFile) and say in one line per option what it gets right about the real subject.

## 2. Pose set on a green screen

Use the chosen image as the FIRST `--ref` (it fixes the style), then one or two photos for likeness. Common prompt:

> The first image is our game character NAME. Draw exactly this same character: identical render style, proportions,
> colours and markings (list them again). The other photos show the real subject for reference. Background: perfectly
> flat solid chroma-key green #00FF00 filling the whole image, no shadow, no ground, no text, no other objects.
> Whole body visible, not cropped, centered with some margin. Pose: ...

Poses that worked for a dog: sitting facing viewer; standing side view facing right; sniffing nose-to-ground;
low hunting crouch; jumping on hind legs; scared (ears flat, tail tucked); sleeping curled in a ball; happy sitting
with tongue out. For a background that is already white, ask the model to "keep this exact image unchanged and only
replace the white background with flat chroma-key green".

**Animation cycles**: ask for "a running animation sprite sheet: exactly 4 frames" with `--aspect 16:9` — the model
returns a consistent 2×2 grid. Cut it into quadrants and key every frame with the SAME `--box` so the dog does not
jump between frames. Frames generated one by one drift in scale; avoid that.

Make a contact sheet of the whole set and look at it before cutting: regenerate any pose whose markings or style drift.

## 3. Cut sprites

```bash
python3 .claude/skills/character-sprites/scripts/chroma_key.py pose.png img/NAME/pose.webp --max 520
python3 .claude/skills/character-sprites/scripts/chroma_key.py frame0.png img/NAME/run0.webp --box 0,6,688,380   # shared crop for cycles
```
The keyer estimates the background from the border, un-mixes semi-transparent fur from the green (no halo) and clamps
spill. Check edges on a dark and a light background with contact_sheet.py `--bg 40,44,60`. 520 px on the long side
at WebP q84 is ~20–50 KB a sprite and stays sharp at about 170 CSS px on a 3× phone screen.

## 4. Wire into the game

Load sprites lazily (`new Image()`, draw only when `complete`), keep a table of each sprite's body length in source
pixels and where the feet are (fraction of height), and scale by `size / body` so every pose shows the character at
the same size. Calibrate the table by drawing all poses side by side at one `size` on a ground line and adjusting
until heads and bodies match. Bring the stills to life with code: breathing scale, a bob for runs, a tremble for scared,
a hop for jump, a ground shadow that shrinks as the character lifts off. PolyGame's `js/ava.js` is the reference.

## Notes

- Generated images come back as JPEG data even when saved as .png; that is fine as input to the keyer.
- If the result text says the model refused or returned no image, rephrase the pose; do not retry the same prompt more than twice.
- Keep the raw green-screen renders in the scratchpad, not in the repo; commit only the cut WebP sprites.
