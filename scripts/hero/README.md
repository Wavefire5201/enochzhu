# hero backdrops

two scripts turn a list of wallpaper urls into finished hero backdrops:
`backdrops.py` makes the photo and its depth map, `capture-posters.mjs`
screenshots the tuned glyph shader into the poster stills.

## setup

```sh
# once, anywhere
curl -LsSf https://astral.sh/uv/install.sh | sh   # or: brew install uv
npx playwright install chromium
```

`backdrops.py` pulls torch/torchvision from default pypi, so it lands on cuda
wheels on linux/windows with an nvidia card and on the mps build on macos. no
cuda toolkit install needed — the wheel ships its own. the script prints the
device it picked (cuda → mps → cpu) at startup; force it with `--device`.

on a desktop gpu the large model at `--infer-size 1540` runs in a few seconds
per image. on cpu it is minutes, so the default drops to 1036 there.

## depth anything 3

da3 is not a transformers architecture — bytedance ships it as its own package,
whose declared dependencies pull in open3d, pycolmap, xformers and moviepy for
glb/ply/colmap/video exporters this script never calls (pycolmap also links a
second libomp and aborts next to torch's). so it does not go in `backdrops.py`'s
inline metadata; build the venv once and call the script with that interpreter
instead of `uv run`:

```sh
uv venv ~/.venvs/da3
uv pip install --python ~/.venvs/da3/bin/python \
  torch torchvision pillow "numpy<2" einops omegaconf safetensors \
  huggingface-hub addict imageio opencv-contrib-python-headless
uv pip install --python ~/.venvs/da3/bin/python --no-deps depth-anything-3

~/.venvs/da3/bin/python scripts/hero/backdrops.py --model da3 \
  --infer-size 1512 --depth-only blossom=blossom-da3
```

the script stubs out the exporter modules so the skipped packages are never
imported, and `transformers` is imported lazily so this venv does not need it.

which checkpoint: `da3` (`DA3-LARGE-1.1`) is the one to use. `da3-mono` is the
variant advertised for monocular depth, but on shallow-focus photography it
reads a flat hazy background as the nearest surface in the frame, which the
percentile normalisation then stretches the whole map around. `--infer-size` is
the long edge for da3, not a square side.

## the three commands

```sh
uv run scripts/hero/backdrops.py                    # photos + depth from input.txt
node scripts/hero/capture-posters.mjs --missing     # poster webps for new pairs
npm run build
```

`backdrops.py` writes `static/hero/<id>.jpeg` and `static/hero/depth/<id>.png`,
splices the entry into `src/lib/hero/pairs.ts`, adds the id to the rotation list
in `src/app.html`, and runs prettier over both. `--dry-run` resolves urls and
credits and prints the plan without downloading anything.

`capture-posters.mjs` builds the site, serves it with `vite preview`, and for
each pair at 1600×667 and 800×333 switches the backdrop, waits for the canvas to
fade in, hides everything in the hero but the canvas, and encodes the screenshot
to `static/hero/<id>-poster-<w>.webp` with `cwebp -q 80`. `--all` for every pair,
`--missing` for the ones without a poster, or ids on the command line.
`--no-build` reuses an existing `build/`.

## input.txt

one backdrop per line:

```
<url> | <id> | <label> [| focus=x,y] [| credit=Name]
```

- `<url>` — an unsplash photo page (`…/photos/<slug>-<id>` or `…/photos/<id>`),
  a wallhaven page (`https://wallhaven.cc/w/<id>`), or a direct image url.
  unsplash credit comes from the download redirect's filename, wallhaven's from
  its api; a direct url has no credit unless you give one.
- `<id>` — filename stem and the key in `pairs.ts`.
- `<label>` — what the backdrop switcher shows. lowercase.
- `focus=x,y` — normalised focal point kept when the source is cropped to the
  1920×800 hero frame, same idea as css object-position. default `0.5,0.5`.
- `credit=Name` — override the scraped photographer.

`#` comments and blank lines are skipped. a run is idempotent: a photo that
already exists as `static/hero/<id>.jpeg` is not re-downloaded, only its depth
is rebuilt. `--force` starts over. one bad line never stops the run.

## depth flags

the raw model output is not directly usable by the parallax shader — it offsets
every pixel by `depth × parallax`, so what matters is where the depth edges sit
and how sharp they are. the defaults below are the tuned pipeline; each stage
can be turned off to see what it was doing.

| flag               | default            | what it is for                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--model`          | `large`            | depth anything v2 `small`/`base`/`large`, `depthpro`, or the da3 checkpoints `da3`/`da3-giant`/`da3-mono` (separate install, below)                                                                                                                                                                                                                                                                                                                                                                                                              |
| `--infer-size`     | 1540 gpu, 1036 cpu | inference resolution, multiple of 14. bigger = crisper silhouettes, slower                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `--norm`           | `percentile`       | maps to 0..1 across the 0.5/99.5 percentiles instead of raw min/max, so one stray near or far pixel cannot compress the whole range. `minmax` for the old behaviour                                                                                                                                                                                                                                                                                                                                                                              |
| `--percentiles`    | `0.5,99.5`         | the clip points for the above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `--guided`         | `r=2,eps=1e-4`     | guided filter against the photo itself, so depth edges land on photo edges instead of the soft ramp bicubic upsampling leaves — that mismatch is the halo. radius is a joint-upsampling window, not a smoothing strength: keep it near the upsample factor. wherever the guide has no structure correlated with the depth (bokeh, flat sky, a uniformly white blossom) the filter degenerates to a box blur of that radius, so `r=8` turns a crisp silhouette to mush and `r=2` costs nothing. eps barely matters next to that. `off` to disable |
| `--soften`         | `1.5`              | gaussian sigma in px, applied **after** the guided filter. the guided pass leaves hard one-pixel steps, and a hard step tears the photo when the shader slides it; a 2–3px ramp reads as a natural edge. too much blur puts the halo back — 1–2 is the useful window                                                                                                                                                                                                                                                                             |
| `--gamma`          | `1.0`              | curve on the normalised depth. `>1` flattens the far field                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `--compare`        | off                | keeps the previous depth png as `out/<id>-depth-old.png` and writes a side-by-side `out/<id>-depth-compare.png`                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `--depth-only ID…` | —                  | rebuild depth for ids already present as jpeg; skips download, crop and the `pairs.ts` write. `blossom=blossom-da3` reads `blossom.jpeg` and writes `depth/blossom-da3.png`, so one photo can carry several maps as separate `pairs.ts` entries to flip between                                                                                                                                                                                                                                                                                  |

every run also drops a viewable 8-bit grayscale `scripts/hero/out/<id>-depth-preview.png`
for eyeballing. the shipped png is not viewable: it packs a 16-bit value as
high byte → red, low byte → green (browsers flatten true 16-bit textures to 8
bits on upload), and `glyph-shaders.ts` reconstructs it. near = bright.
