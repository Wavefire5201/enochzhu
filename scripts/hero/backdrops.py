# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "transformers>=4.45",
#   "torch",
#   "torchvision",
#   "pillow",
#   "numpy",
#   "opencv-contrib-python-headless",
# ]
# ///
"""Turn a list of wallpaper urls into finished hero backdrops.

One entry per line in scripts/hero/input.txt:

    <url> | <id> | <label> [| focus=x,y] [| credit=Name]

For each entry this downloads the source photo, crops it to the hero frame
(1920x800), runs monocular depth estimation on the crop, post-processes the
depth for the parallax shader, writes both files into static/hero/, and splices
the pair entry into src/lib/hero/pairs.ts and src/app.html.

    uv run scripts/hero/backdrops.py                 # everything in input.txt
    uv run scripts/hero/backdrops.py --dry-run       # resolve urls/credits only
    uv run scripts/hero/backdrops.py --depth-only sakura snow-peak

torch/torchvision come from default pypi on purpose: that resolves to cuda
wheels on linux/windows and to the mps-capable macos wheel here. Device is
auto-selected cuda -> mps -> cpu.

--model da3* needs bytedance's own package rather than transformers, and its
declared dependencies pull in open3d/pycolmap/xformers/moviepy for exporters we
never call, so it cannot live in the inline metadata above. Run those from a
venv you build once:

    uv venv ~/.venvs/da3 && uv pip install --python ~/.venvs/da3/bin/python \
      torch torchvision pillow "numpy<2" einops omegaconf safetensors \
      huggingface-hub addict imageio opencv-contrib-python-headless
    uv pip install --python ~/.venvs/da3/bin/python --no-deps depth-anything-3
    ~/.venvs/da3/bin/python scripts/hero/backdrops.py --model da3 ...

transformers is imported lazily so that venv does not need it.

The depth png packs a 16-bit value across two 8-bit channels (high byte -> R,
low byte -> G, blue unused) because browsers flatten true 16-bit textures to 8
bits on upload. glyph-shaders.ts reconstructs it as (r*65280 + g*255)/65535.
near = bright.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import torch
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
HERO_DIR = REPO / "static" / "hero"
DEPTH_DIR = HERO_DIR / "depth"
OUT_DIR = REPO / "scripts" / "hero" / "out"
PAIRS_TS = REPO / "src" / "lib" / "hero" / "pairs.ts"
APP_HTML = REPO / "src" / "app.html"

FRAME_W, FRAME_H = 1920, 800
FRAME_ASPECT = FRAME_W / FRAME_H  # 2.4
JPEG_QUALITY = 82

MODELS = {
    "small": "depth-anything/Depth-Anything-V2-Small-hf",
    "base": "depth-anything/Depth-Anything-V2-Base-hf",
    "large": "depth-anything/Depth-Anything-V2-Large-hf",
    "depthpro": "apple/DepthPro-hf",
    "da3": "depth-anything/DA3-LARGE-1.1",
    "da3-giant": "depth-anything/DA3-GIANT-1.1",
    "da3-mono": "depth-anything/DA3MONO-LARGE",
}

# depth anything 3 ships its own package instead of a transformers architecture,
# so these load through a different backend. da3-mono is the variant advertised
# for monocular depth, but on shallow-focus photography it reads flat hazy
# background as the nearest surface; the any-view da3 checkpoints do not.
DA3_MODELS = {"da3", "da3-giant", "da3-mono"}

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
UTM = "utm_source=enochzhu&utm_medium=referral"


# ---------------------------------------------------------------- input file


@dataclass
class Entry:
    url: str
    id: str
    label: str
    focus: tuple[float, float] = (0.5, 0.5)
    credit_override: str | None = None
    line_no: int = 0

    # filled in during resolution
    source: str = "direct"
    image_url: str = ""
    credit_name: str | None = None
    credit_url: str | None = None


@dataclass
class Result:
    id: str
    source: str = "-"
    credit: str = "-"
    device: str = "-"
    seconds: float = 0.0
    note: str = ""
    ok: bool = True
    snippet: str = ""
    extras: list[str] = field(default_factory=list)


def parse_input(path: Path) -> list[Entry]:
    entries: list[Entry] = []
    for n, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 3:
            print(f"  ! line {n}: need at least <url> | <id> | <label>", flush=True)
            continue
        entry = Entry(url=parts[0], id=parts[1], label=parts[2], line_no=n)
        for extra in parts[3:]:
            key, _, value = extra.partition("=")
            key, value = key.strip().lower(), value.strip()
            if key == "focus":
                try:
                    fx, fy = (float(v) for v in value.split(","))
                    entry.focus = (fx, fy)
                except ValueError:
                    print(f"  ! line {n}: bad focus {value!r}, using 0.5,0.5")
            elif key == "credit":
                entry.credit_override = value
            elif extra:
                print(f"  ! line {n}: ignoring unknown field {extra!r}")
        entries.append(entry)
    return entries


# ------------------------------------------------------------ url resolution


def http() -> urllib.request.OpenerDirector:
    """Stdlib urllib, not requests, on purpose.

    unsplash sits behind a tls-fingerprinting waf that 403s urllib3's handshake
    outright; python's own ssl stack gets through on most builds, and `fetch`
    covers the ones it doesn't.
    """
    opener = urllib.request.build_opener()
    opener.addheaders = [
        ("User-Agent", UA),
        (
            "Accept",
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        ),
        ("Accept-Language", "en-US,en;q=0.9"),
    ]
    return opener


_warned_curl = False


def _curl(
    url: str, method: str, headers: dict[str, str] | None, timeout: int
) -> tuple[str, bytes] | None:
    """Same request through curl, whose tls handshake the waf does accept."""
    global _warned_curl
    if not shutil.which("curl"):
        return None
    if not _warned_curl:
        print("  . unsplash refused python's tls handshake, retrying through curl")
        _warned_curl = True
    body = Path(tempfile.mkstemp(prefix="backdrops-")[1])
    cmd = [
        "curl", "-sSL", "--compressed", "-A", UA, "-m", str(timeout),
        "-o", str(body), "-w", "%{url_effective}\n%{http_code}",
    ]  # fmt: skip
    if method == "HEAD":
        cmd.append("-I")
    for key, value in (headers or {}).items():
        cmd += ["-H", f"{key}: {value}"]
    cmd.append(url)
    try:
        run = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if run.returncode != 0:
            return None
        final, _, status = run.stdout.strip().rpartition("\n")
        if not status.startswith("2"):
            return None
        return final.strip(), b"" if method == "HEAD" else body.read_bytes()
    finally:
        body.unlink(missing_ok=True)


def fetch(
    opener: urllib.request.OpenerDirector,
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    timeout: int = 120,
) -> tuple[str, bytes]:
    """Follow redirects and return (final url, body). HEAD bodies are empty.

    Whether unsplash answers at all depends on the interpreter's openssl: the
    waf 401s a handshake from openssl 3.0 and waves through 3.5/3.6, and uv is
    free to pick either. So a 401/403 gets one retry through curl rather than
    pinning a python build that happens to be lucky today.
    """
    request = urllib.request.Request(url, method=method, headers=headers or {})
    try:
        with opener.open(request, timeout=timeout) as response:
            return response.url, response.read()
    except urllib.error.HTTPError as exc:
        if exc.code not in (401, 403):
            raise
        retried = _curl(url, method, headers, timeout)
        if retried is None:
            raise
        return retried


UNSPLASH_RE = re.compile(r"unsplash\.com/(?:[a-z-]+/)*photos/([^/?#]+)", re.I)
WALLHAVEN_RE = re.compile(r"wallhaven\.cc/w/([A-Za-z0-9]+)", re.I)


def unsplash_id(slug: str) -> str:
    """`ochre-blossoms-AZTTuralYco` and `AZTTuralYco` both yield the 11-char id."""
    token = slug.rsplit("-", 1)[-1] if "-" in slug else slug
    return token


def name_from_download(
    opener: urllib.request.OpenerDirector, download_url: str, pid: str
) -> str | None:
    """Photographer from the download redirect's filename.

    A HEAD follows unsplash.com/photos/<id>/download to the cdn url, which
    carries `dl=<photographer-slug>-<id>-unsplash.jpg`. This is the attribution
    source that still answers: the html pages sit behind unsplash's anubis bot
    wall and return 401 to anything without a solved challenge, so the json
    scrape below is a fallback, not the primary path. Verified against
    AZTTuralYco -> Jessica Kramer and UNeHrHb7eII -> Doncoombez.
    """
    final, _ = fetch(opener, download_url, method="HEAD", timeout=60)
    match = re.search(r"[?&]dl=([^&]+)", final)
    if not match:
        return None
    slug = urllib.parse.unquote(match.group(1))
    slug = re.sub(r"-" + re.escape(pid) + r"-unsplash\.\w+$", "", slug)
    return " ".join(word.capitalize() for word in slug.split("-") if word) or None


def second_json_name(html: str) -> str | None:
    """Photographer name from the page's embedded json.

    The first `"name"` in the payload belongs to the site/collection wrapper;
    the second is the photographer. Only reachable when unsplash is not serving
    its bot challenge.
    """
    names = re.findall(r'"name"\s*:\s*"((?:[^"\\]|\\.)*)"', html)
    if len(names) < 2:
        return None
    try:
        return json.loads(f'"{names[1]}"')
    except json.JSONDecodeError:
        return names[1]


def resolve(entry: Entry, opener: urllib.request.OpenerDirector) -> Entry:
    unsplash = UNSPLASH_RE.search(entry.url)
    wallhaven = WALLHAVEN_RE.search(entry.url)

    if unsplash:
        pid = unsplash_id(unsplash.group(1))
        entry.source = "unsplash"
        entry.image_url = f"https://unsplash.com/photos/{pid}/download?force=true&w=2400"
        entry.credit_url = f"https://unsplash.com/photos/{pid}?{UTM}"
        if entry.credit_override:
            entry.credit_name = entry.credit_override
        else:
            entry.credit_name = name_from_download(opener, entry.image_url, pid)
            if not entry.credit_name:
                _, page = fetch(opener, f"https://unsplash.com/photos/{pid}", timeout=30)
                entry.credit_name = second_json_name(page.decode("utf-8", "replace"))
            if not entry.credit_name:
                print(f"  ! {entry.id}: no photographer found, add credit=Name")
    elif wallhaven:
        wid = wallhaven.group(1)
        entry.source = "wallhaven"
        headers = {}
        if os.environ.get("WALLHAVEN_API_KEY"):
            headers["X-API-Key"] = os.environ["WALLHAVEN_API_KEY"]
        _, body = fetch(
            opener, f"https://wallhaven.cc/api/v1/w/{wid}", headers=headers, timeout=30
        )
        data = json.loads(body)["data"]
        entry.image_url = data["path"]
        entry.credit_url = f"https://wallhaven.cc/w/{wid}"
        entry.credit_name = entry.credit_override or (data.get("uploader") or {}).get(
            "username"
        )
    else:
        entry.source = "direct"
        entry.image_url = entry.url
        if entry.credit_override:
            entry.credit_name = entry.credit_override
            entry.credit_url = entry.url

    return entry


# ------------------------------------------------------------------ cropping


def crop_to_frame(image: Image.Image, focus: tuple[float, float]) -> Image.Image:
    """Largest 2.4 window containing the focus point, then Lanczos to 1920x800.

    The window is positioned the way CSS object-position does it: the focus
    fraction of the leftover space sits before the crop.
    """
    w, h = image.size
    if w / h > FRAME_ASPECT:  # too wide -> full height, trim sides
        cw, ch = round(h * FRAME_ASPECT), h
    else:  # too tall -> full width, trim top/bottom
        cw, ch = w, round(w / FRAME_ASPECT)
    cw, ch = min(cw, w), min(ch, h)
    left = int(round(max(0, min(w - cw, (w - cw) * focus[0]))))
    top = int(round(max(0, min(h - ch, (h - ch) * focus[1]))))
    box = image.crop((left, top, left + cw, top + ch))
    return box.resize((FRAME_W, FRAME_H), Image.LANCZOS)


# --------------------------------------------------------------------- depth


def pick_device(preference: str) -> torch.device:
    if preference != "auto":
        return torch.device(preference)
    if torch.cuda.is_available():
        return torch.device("cuda")
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def parse_guided(spec: str) -> tuple[int, float] | None:
    if spec.strip().lower() in {"off", "none", "no", "0", ""}:
        return None
    radius, eps = 2, 1e-4
    for part in spec.split(","):
        key, _, value = part.partition("=")
        key = key.strip().lower()
        if key in {"r", "radius"}:
            radius = int(float(value))
        elif key == "eps":
            eps = float(value)
        else:
            raise ValueError(f"unknown --guided field {part!r}")
    return radius, eps


def load_da3(repo: str, device: torch.device):
    """depth_anything_3.api.DepthAnything3, without its exporter dependencies.

    api.py imports the glb/ply/colmap/video writers at module scope, and those
    reach for moviepy, matplotlib, trimesh, plyfile, pycolmap and evo. We always
    pass export_dir=None, so the writers are stubbed out rather than installed —
    pycolmap in particular links a second libomp and aborts the process next to
    torch's.
    """
    import sys
    import types

    for mod, attr in (("export", "export"), ("pose_align", "align_poses_umeyama")):
        name = f"depth_anything_3.utils.{mod}"
        if name in sys.modules:
            continue
        stub = types.ModuleType(name)
        setattr(stub, attr, None)
        sys.modules[name] = stub

    from depth_anything_3.api import DepthAnything3

    return DepthAnything3.from_pretrained(repo).to(device=device)


class DepthModel:
    def __init__(self, name: str, device: torch.device, infer_size: int | None):
        self.name = name
        self.device = device
        self.is_depthpro = name == "depthpro"
        self.is_da3 = name in DA3_MODELS
        self.infer_size = infer_size
        repo = MODELS[name]
        print(f"loading {repo} on {device.type}", flush=True)

        if self.is_da3:
            try:
                self.model = load_da3(repo, device)
            except ImportError as exc:
                raise SystemExit(
                    f"--model {name} needs the depth-anything-3 package ({exc}). "
                    "See the install recipe at the top of this file."
                ) from exc
            return

        from transformers import AutoImageProcessor, AutoModelForDepthEstimation

        self.processor = AutoImageProcessor.from_pretrained(repo)
        self.model = AutoModelForDepthEstimation.from_pretrained(repo)
        self.model.eval().to(device)
        if infer_size and not self.is_depthpro:
            self.processor.size = {"height": infer_size, "width": infer_size}

    def raw(self, image: Image.Image) -> np.ndarray:
        """Inverse-depth at the image's own resolution. Larger = nearer."""
        width, height = image.size

        if self.is_da3:
            return self._raw_da3(image, width, height)

        inputs = self.processor(images=image, return_tensors="pt").to(self.device)
        with torch.no_grad():
            outputs = self.model(**inputs)

        if self.is_depthpro:
            # Depth Pro predicts metric depth (meters); near = small. Invert to an
            # inverse-depth map so near = bright, matching Depth Anything.
            post = self.processor.post_process_depth_estimation(
                outputs, target_sizes=[(height, width)]
            )
            depth = 1.0 / torch.clamp(post[0]["predicted_depth"], min=1e-3)
        else:
            depth = torch.nn.functional.interpolate(
                outputs.predicted_depth.unsqueeze(1).float(),
                size=(height, width),
                mode="bicubic",
                align_corners=False,
            ).squeeze()
        return depth.detach().float().cpu().numpy().astype(np.float32)

    def _raw_da3(self, image: Image.Image, width: int, height: int) -> np.ndarray:
        """DA3 predicts depth (near = small) on its own grid, plus a sky mask."""
        import cv2

        # process_res is the long edge; DA3 keeps the aspect ratio itself. its own
        # default is 504, which is far below the hero width — the map survives the
        # full 1540 fine, unlike a transformers processor that wants a square.
        prediction = self.model.inference(
            [image], process_res=self.infer_size or 1512, export_dir=None
        )
        depth = prediction.depth[0].astype(np.float32)
        disparity = 1.0 / np.clip(depth, 1e-3, None)

        sky = prediction.sky
        if sky is not None and sky[0].any():
            # sky comes back as its own class rather than a depth; park it at the
            # far end so the parallax cannot slide it against the horizon
            mask = sky[0].astype(bool)
            disparity[mask] = (
                float(np.percentile(disparity[~mask], 0.5))
                if (~mask).any()
                else float(disparity.min())
            )

        return cv2.resize(disparity, (width, height), interpolation=cv2.INTER_CUBIC)


def normalise(depth: np.ndarray, mode: str, lo_p: float, hi_p: float) -> np.ndarray:
    if mode == "minmax":
        lo, hi = float(depth.min()), float(depth.max())
    else:
        lo, hi = np.percentile(depth, [lo_p, hi_p])
    # a single stray near/far pixel must not compress the whole range, so the
    # default clips at the 0.5/99.5 percentiles instead of the true extremes
    return np.clip((depth - lo) / (hi - lo + 1e-9), 0.0, 1.0).astype(np.float32)


def postprocess(
    depth: np.ndarray,
    rgb: np.ndarray,
    *,
    norm: str,
    percentiles: tuple[float, float],
    guided: tuple[int, float] | None,
    soften: float,
    gamma: float,
) -> np.ndarray:
    import cv2

    d = normalise(depth, norm, *percentiles)

    if guided is not None:
        radius, eps = guided
        if hasattr(cv2, "ximgproc"):
            # snap the depth edges to the photo's edges. the model runs below
            # the hero width and is bicubic-upsampled, so silhouettes arrive as
            # a soft ramp straddling the real edge — that mismatch is what
            # reads as a halo when the shader offsets by depth.
            #
            # radius is a joint-upsampling window, not a smoothing strength:
            # keep it near the upsample factor (1920/infer-size, so 1-2px).
            # wherever the guide carries no structure correlated with the depth
            # — soft bokeh, a flat sky, a uniformly white blossom — the filter
            # degenerates to a plain box blur of that radius, so r=8 turns a
            # crisp silhouette into mush while r=2 costs nothing. eps barely
            # matters by comparison.
            guide = (rgb.astype(np.float32) / 255.0).copy()
            d = cv2.ximgproc.guidedFilter(guide=guide, src=d, radius=radius, eps=eps)
            d = np.clip(d, 0.0, 1.0).astype(np.float32)
        else:
            print("  ! cv2.ximgproc missing (need opencv-contrib), skipping --guided")

    if soften > 0:
        # deliberately AFTER the guided filter. the guided pass leaves hard
        # one-pixel steps at silhouettes; the shader offsets every pixel by
        # depth * parallax, so a hard step tears the photo along the edge. a
        # 2-3px ramp reads as a natural edge instead. the trade-off is that too
        # much blur puts the halo back — 1-2px is the useful window.
        d = cv2.GaussianBlur(d, (0, 0), sigmaX=soften, sigmaY=soften)

    if gamma != 1.0:
        d = np.power(np.clip(d, 0.0, 1.0), gamma, dtype=np.float32)

    return np.clip(d, 0.0, 1.0).astype(np.float32)


def pack16(d: np.ndarray) -> Image.Image:
    v = np.clip(d * 65535.0, 0, 65535).astype(np.uint32)
    rgb = np.dstack(
        [
            (v >> 8).astype(np.uint8),  # high byte -> R
            (v & 0xFF).astype(np.uint8),  # low byte  -> G (shader reads g * 255)
            np.zeros(v.shape, np.uint8),  # B unused
        ]
    )
    return Image.fromarray(rgb, "RGB")


def unpack16(png: Path) -> np.ndarray:
    """Grayscale view of a packed depth png, for previews."""
    arr = np.asarray(Image.open(png).convert("RGB")).astype(np.float32)
    return (arr[..., 0] * 256.0 + arr[..., 1]) / 65535.0


def side_by_side(old: np.ndarray, new: np.ndarray, out: Path) -> None:
    h = max(old.shape[0], new.shape[0])
    gap = 16
    canvas = np.zeros((h, old.shape[1] + gap + new.shape[1]), np.float32)
    canvas[: old.shape[0], : old.shape[1]] = old
    canvas[: new.shape[0], old.shape[1] + gap :] = new
    Image.fromarray((canvas * 255).astype(np.uint8), "L").save(out)


# --------------------------------------------------------- pairs.ts / app.html


def ts_entry(entry: Entry) -> str:
    lines = [
        "\t{",
        f'\t\tid: "{entry.id}",',
        f'\t\tlabel: "{entry.label}",',
        f'\t\tphoto: "/hero/{entry.id}.jpeg",',
        "\t\tposter: {",
        f'\t\t\tsmall: "/hero/{entry.id}-poster-800.webp",',
        f'\t\t\tlarge: "/hero/{entry.id}-poster-1600.webp",',
        "\t\t},",
        f'\t\tdepth: "/hero/depth/{entry.id}.png",',
        f"\t\taspect: {FRAME_W} / {FRAME_H},",
        f"\t\tfocus: [{entry.focus[0]:g}, {entry.focus[1]:g}],",
    ]
    if entry.credit_name and entry.credit_url:
        lines += [
            "\t\tcredit: {",
            # the site sets every credit lowercase; the scraped name keeps its case
            f'\t\t\tname: "{entry.credit_name.lower()}",',
            f'\t\t\turl: "{entry.credit_url}",',
            "\t\t},",
        ]
    lines.append("\t},")
    return "\n".join(lines)


def _match_bracket(text: str, start: int) -> int:
    """Index of the bracket closing the one at `start`, skipping strings."""
    pairs = {"[": "]", "{": "}"}
    stack = [text[start]]
    i, in_str, quote, esc = start + 1, False, "", False
    while i < len(text):
        c = text[i]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == quote:
                in_str = False
        elif c in "\"'`":
            in_str, quote = True, c
        elif c in pairs:
            stack.append(c)
        elif c in "]}":
            if pairs[stack[-1]] != c:
                raise ValueError("unbalanced brackets in pairs.ts")
            stack.pop()
            if not stack:
                return i
        i += 1
    raise ValueError("unterminated array in pairs.ts")


def write_pairs_ts(entries: list[Entry]) -> list[str]:
    text = PAIRS_TS.read_text(encoding="utf-8")
    anchor = re.search(r"heroPairs\s*:\s*HeroPair\[\]\s*=\s*\[", text)
    if not anchor:
        raise ValueError("could not find heroPairs array in pairs.ts")
    open_idx = anchor.end() - 1
    close_idx = _match_bracket(text, open_idx)
    body = text[open_idx + 1 : close_idx]

    touched: list[str] = []
    for entry in entries:
        snippet = "\n" + ts_entry(entry) + "\n"
        existing = re.search(
            r"\n\t\{\n\t\tid: \"" + re.escape(entry.id) + r"\",\n", body
        )
        if existing:
            end = _match_bracket(body, body.index("{", existing.start()))
            if end + 1 < len(body) and body[end + 1] == ",":
                end += 1
            body = body[: existing.start()] + snippet.rstrip("\n") + body[end + 1 :]
            touched.append(f"{entry.id} (replaced)")
        else:
            body = body.rstrip("\n") + snippet
            touched.append(f"{entry.id} (added)")

    PAIRS_TS.write_text(text[: open_idx + 1] + body + text[close_idx:], encoding="utf-8")
    return touched


def write_app_html(ids: list[str]) -> list[str]:
    text = APP_HTML.read_text(encoding="utf-8")
    anchor = re.search(r"const pairs\s*=\s*\[", text)
    if not anchor:
        raise ValueError("could not find the pairs array in app.html")
    open_idx = anchor.end() - 1
    close_idx = _match_bracket(text, open_idx)
    body = text[open_idx + 1 : close_idx]
    added = []
    for pid in ids:
        if re.search(r'"' + re.escape(pid) + r'"', body):
            continue
        body = body.rstrip().rstrip(",") + f',\n\t\t\t\t"{pid}",\n\t\t\t'
        added.append(pid)
    if added:
        APP_HTML.write_text(
            text[: open_idx + 1] + body + text[close_idx:], encoding="utf-8"
        )
    return added


def run_prettier(paths: list[Path]) -> None:
    if not shutil.which("npx"):
        print("  ! npx not found, skipping prettier — format the files yourself")
        return
    subprocess.run(
        ["npx", "prettier", "--write", *[str(p.relative_to(REPO)) for p in paths]],
        cwd=REPO,
        check=False,
    )


# ---------------------------------------------------------------------- main


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="backdrops.py",
        description="download wallpapers, crop to the hero frame, build depth maps",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument(
        "--input",
        type=Path,
        default=REPO / "scripts" / "hero" / "input.txt",
        help="list of backdrops (default scripts/hero/input.txt)",
    )
    p.add_argument(
        "--depth-only",
        nargs="+",
        metavar="ID[=OUT]",
        help="rebuild depth for ids whose static/hero/<id>.jpeg already exists; "
        "skips download, crop and the pairs.ts write. `blossom=blossom-da3` reads "
        "blossom.jpeg and writes depth/blossom-da3.png, so one photo can carry "
        "several maps as separate pairs.ts entries to compare",
    )
    p.add_argument("--model", choices=MODELS, default="large")
    p.add_argument(
        "--infer-size",
        type=int,
        default=None,
        help="inference resolution, multiple of 14 (default 1540 on gpu, 1036 on "
        "cpu). square input side for depth anything v2, long edge for da3, "
        "ignored by depth pro",
    )
    p.add_argument("--device", choices=["auto", "cuda", "mps", "cpu"], default="auto")

    p.add_argument(
        "--norm",
        choices=["percentile", "minmax"],
        default="percentile",
        help="0..1 normalisation (default percentile, so one stray pixel cannot "
        "compress the range)",
    )
    p.add_argument(
        "--percentiles",
        default="0.5,99.5",
        help="low,high percentile for --norm percentile (default 0.5,99.5)",
    )
    p.add_argument(
        "--guided",
        default="r=2,eps=1e-4",
        help="guided filter against the photo so depth edges snap to real edges. "
        "radius is the joint-upsampling window and must stay small — past ~3 it "
        "collapses to a box blur. 'off' to disable (default r=2,eps=1e-4)",
    )
    p.add_argument(
        "--soften",
        type=float,
        default=1.5,
        help="gaussian sigma in px applied after the guided filter, turning hard "
        "silhouette steps into a short ramp the parallax can slide (default 1.5)",
    )
    p.add_argument(
        "--gamma",
        type=float,
        default=1.0,
        help="curve on the normalised depth; >1 flattens the far field (default 1.0)",
    )

    p.add_argument("--force", action="store_true", help="re-download existing photos")
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="resolve urls and credits and print the plan, download nothing",
    )
    p.add_argument(
        "--compare",
        action="store_true",
        help="keep the previous depth png as <id>-depth-old.png and write a "
        "side-by-side <id>-depth-compare.png",
    )
    p.add_argument(
        "--no-write",
        dest="write",
        action="store_false",
        help="print the pairs.ts snippet but do not edit pairs.ts / app.html",
    )
    p.add_argument("--no-prettier", dest="prettier", action="store_false")
    p.add_argument(
        "--out",
        type=Path,
        default=OUT_DIR,
        help="preview/scratch directory (default scripts/hero/out)",
    )
    return p


def main() -> int:
    args = build_parser().parse_args()

    try:
        guided = parse_guided(args.guided)
    except ValueError as exc:
        print(f"error: {exc}")
        return 2
    lo_p, hi_p = (float(v) for v in args.percentiles.split(","))

    args.out.mkdir(parents=True, exist_ok=True)
    HERO_DIR.mkdir(parents=True, exist_ok=True)
    DEPTH_DIR.mkdir(parents=True, exist_ok=True)

    opener = http()
    depth_only = bool(args.depth_only)

    # ---- gather work
    if depth_only:
        entries = []
        for spec in args.depth_only:
            pid, _, out = spec.partition("=")
            entries.append(Entry(url="", id=pid, label=out or pid))
        missing = [e.id for e in entries if not (HERO_DIR / f"{e.id}.jpeg").exists()]
        if missing:
            print(f"error: no static/hero/<id>.jpeg for: {', '.join(missing)}")
            return 2
    else:
        if not args.input.exists():
            print(f"error: {args.input} not found")
            return 2
        entries = parse_input(args.input)
        if not entries:
            print(f"nothing to do — {args.input} has no active lines")
            return 0

    device = pick_device(args.device)
    infer_size = args.infer_size or (1036 if device.type == "cpu" else 1540)

    if args.dry_run:
        print("dry run — resolving only, nothing is downloaded or written\n")
        for entry in entries:
            try:
                resolve(entry, opener)
            except Exception as exc:  # noqa: BLE001 — one bad line must not stop the run
                print(f"  {entry.id}: FAILED to resolve — {exc}")
                continue
            jpeg = HERO_DIR / f"{entry.id}.jpeg"
            action = (
                "reuse existing crop"
                if jpeg.exists() and not args.force
                else "download + crop"
            )
            print(f"  {entry.id} [{entry.source}]")
            print(f"    image   {entry.image_url}")
            print(f"    credit  {entry.credit_name or '(none)'} — {entry.credit_url or '-'}")
            print(f"    focus   {entry.focus[0]:g},{entry.focus[1]:g}")
            print(f"    plan    {action}; depth {args.model} @{infer_size} on {device.type}")
            print(f"    writes  static/hero/{entry.id}.jpeg, static/hero/depth/{entry.id}.png")
        return 0

    model = DepthModel(args.model, device, infer_size)

    results: list[Result] = []
    written: list[Entry] = []

    for entry in entries:
        result = Result(id=entry.id, device=device.type)
        t0 = time.time()
        try:
            jpeg = HERO_DIR / f"{entry.id}.jpeg"

            if depth_only:
                result.source = "local"
                cropped = Image.open(jpeg).convert("RGB")
            else:
                resolve(entry, opener)
                result.source = entry.source
                result.credit = entry.credit_name or "-"
                if jpeg.exists() and not args.force:
                    result.note = "reused crop"
                    cropped = Image.open(jpeg).convert("RGB")
                else:
                    _, body = fetch(opener, entry.image_url)
                    raw = args.out / f"{entry.id}-source"
                    raw.write_bytes(body)
                    source = Image.open(raw).convert("RGB")
                    cropped = crop_to_frame(source, entry.focus)
                    cropped.save(jpeg, "JPEG", quality=JPEG_QUALITY, optimize=True)
                    raw.unlink(missing_ok=True)

            if cropped.size != (FRAME_W, FRAME_H):
                cropped = cropped.resize((FRAME_W, FRAME_H), Image.LANCZOS)

            out_id = entry.label if depth_only else entry.id
            depth_png = DEPTH_DIR / f"{out_id}.png"
            old_gray = None
            if args.compare and depth_png.exists():
                old_copy = args.out / f"{out_id}-depth-old.png"
                shutil.copy2(depth_png, old_copy)
                old_gray = unpack16(old_copy)
                result.extras.append(str(old_copy))

            raw_depth = model.raw(cropped)
            d = postprocess(
                raw_depth,
                np.asarray(cropped),
                norm=args.norm,
                percentiles=(lo_p, hi_p),
                guided=guided,
                soften=args.soften,
                gamma=args.gamma,
            )
            pack16(d).save(depth_png)

            preview = args.out / f"{out_id}-depth-preview.png"
            Image.fromarray((d * 255).astype(np.uint8), "L").save(preview)
            result.extras.append(str(preview))

            if old_gray is not None:
                compare = args.out / f"{out_id}-depth-compare.png"
                side_by_side(old_gray, d, compare)
                result.extras.append(str(compare))

            if not depth_only:
                result.snippet = ts_entry(entry)
                written.append(entry)

        except Exception as exc:  # noqa: BLE001 — never lose the rest of the run
            result.ok = False
            result.note = f"{type(exc).__name__}: {exc}"
        result.seconds = time.time() - t0
        results.append(result)
        state = "ok" if result.ok else "FAILED"
        print(f"  {entry.id}: {state} ({result.seconds:.1f}s) {result.note}", flush=True)

    # ---- pairs.ts / app.html
    if written:
        print("\npairs.ts entries:\n")
        for entry in written:
            print(ts_entry(entry))
        if args.write:
            touched = write_pairs_ts(written)
            added = write_app_html([e.id for e in written])
            print(f"\npairs.ts: {', '.join(touched)}")
            print(f"app.html: {', '.join(added) if added else 'no new ids'}")
            if args.prettier:
                run_prettier([PAIRS_TS, APP_HTML])

    # ---- summary
    width = max([len(r.id) for r in results] + [2])
    print()
    print("id".ljust(width + 2), "source".ljust(10), "credit".ljust(20), "device".ljust(7), "secs")
    for r in results:
        print(
            r.id.ljust(width + 2),
            r.source.ljust(10),
            (r.credit if r.ok else "-")[:20].ljust(20),
            r.device.ljust(7),
            f"{r.seconds:6.1f}",
            "" if r.ok else f"  {r.note}",
        )
    for r in results:
        for path in r.extras:
            print(f"  {r.id}: {path}")

    failures = [r for r in results if not r.ok]
    if failures:
        print(f"\n{len(failures)} of {len(results)} failed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
