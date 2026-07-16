# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "transformers>=4.45",
#   "torch",
#   "torchvision",
#   "pillow",
#   "numpy",
# ]
#
# [tool.uv.sources]
# torch = [{ index = "pytorch-cpu" }]
# torchvision = [{ index = "pytorch-cpu" }]
#
# [[tool.uv.index]]
# name = "pytorch-cpu"
# url = "https://download.pytorch.org/whl/cpu"
# explicit = true
# ///
"""Generate monocular depth maps for the glyph hero.

Usage:
  uv run generate-depth.py [--model small|base|large|depthpro]
                           [--infer-size N] [--aspect W:H] <image>... <outdir>

Output: an 8-bit RGB PNG per input with the depth value packed across two
channels (high byte -> R, low byte -> G). Browsers flatten true 16-bit textures
to 8 bits on upload; packing keeps ~16-bit precision through a normal image load,
and the hero shader reconstructs it (see glyph-shaders.ts). near = bright.

--infer-size raises Depth Anything V2's inference resolution (multiple of 14,
e.g. 1036 or 1540) for sharper silhouettes at the cost of CPU time; ignored for
depthpro, which is natively high-res. --aspect center-crops before inference;
focus-cropped heroes should instead be pre-cropped to match the displayed frame.
"""

import argparse
import sys
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForDepthEstimation

MODELS = {
    "small": "depth-anything/Depth-Anything-V2-Small-hf",
    "base": "depth-anything/Depth-Anything-V2-Base-hf",
    "large": "depth-anything/Depth-Anything-V2-Large-hf",
    "depthpro": "apple/DepthPro-hf",
}


def crop_to_aspect(image: Image.Image, aspect: tuple[int, int] | None) -> Image.Image:
    if not aspect:
        return image
    w, h = image.size
    target = aspect[0] / aspect[1]
    if w / h > target:  # too wide -> trim sides
        nw = round(h * target)
        left = (w - nw) // 2
        return image.crop((left, 0, left + nw, h))
    nh = round(w / target)  # too tall -> trim top/bottom
    top = (h - nh) // 2
    return image.crop((0, top, w, top + nh))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", choices=MODELS, default="large")
    parser.add_argument(
        "--infer-size",
        type=int,
        default=None,
        help="Depth Anything V2 inference resolution (multiple of 14). Higher is "
        "crisper and slower. Ignored for depthpro.",
    )
    parser.add_argument(
        "--aspect",
        default=None,
        help="center-crop to W:H before inference, e.g. 1920:800",
    )
    parser.add_argument("images", nargs="+")
    parser.add_argument("outdir")
    args = parser.parse_args()

    aspect = None
    if args.aspect:
        aw, ah = args.aspect.split(":")
        aspect = (int(aw), int(ah))

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    repo = MODELS[args.model]
    is_depthpro = args.model == "depthpro"
    print(f"loading {repo} (cpu)", flush=True)
    processor = AutoImageProcessor.from_pretrained(repo)
    model = AutoModelForDepthEstimation.from_pretrained(repo)
    model.eval()

    if args.infer_size and not is_depthpro:
        processor.size = {"height": args.infer_size, "width": args.infer_size}

    for path_str in args.images:
        path = Path(path_str)
        t0 = time.time()
        image = crop_to_aspect(Image.open(path).convert("RGB"), aspect)
        width, height = image.size

        inputs = processor(images=image, return_tensors="pt")
        with torch.no_grad():
            outputs = model(**inputs)

        if is_depthpro:
            # Depth Pro predicts metric depth (meters); near = small. Invert to an
            # inverse-depth map so near = bright, matching Depth Anything.
            post = processor.post_process_depth_estimation(
                outputs, target_sizes=[(height, width)]
            )
            depth = 1.0 / torch.clamp(post[0]["predicted_depth"], min=1e-3)
        else:
            # Depth Anything predicts relative inverse depth: larger = nearer.
            depth = torch.nn.functional.interpolate(
                outputs.predicted_depth.unsqueeze(1),
                size=(height, width),
                mode="bicubic",
                align_corners=False,
            ).squeeze()

        d = depth.detach().numpy().astype(np.float64)
        d = (d - d.min()) / (d.max() - d.min() + 1e-9)  # 0..1, near = 1 = bright
        v = np.clip(d * 65535.0, 0, 65535).astype(np.uint32)
        rgb = np.dstack(
            [
                (v >> 8).astype(np.uint8),  # high byte -> R
                (v & 0xF0).astype(np.uint8),  # low nibble dropped: 12-bit, G
                np.zeros(v.shape, np.uint8),  # B unused
            ]
        )

        out = outdir / f"{path.stem}.png"
        Image.fromarray(rgb, "RGB").save(out)
        print(
            f"{path.name} -> {out} ({width}x{height}, {time.time() - t0:.1f}s)",
            flush=True,
        )


if __name__ == "__main__":
    sys.exit(main())
