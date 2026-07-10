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
"""Generate monocular depth maps with Depth Anything V2.

Usage: uv run generate-depth.py [--model small|base|large] <image>... <outdir>

Output: 16-bit grayscale PNG per input, near = bright, far = dark,
resized to the source image dimensions. Convention matches the hero
shader: depth texture sampled as displacement toward the camera.
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
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", choices=MODELS, default="large")
    parser.add_argument("images", nargs="+")
    parser.add_argument("outdir")
    args = parser.parse_args()

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    print(f"loading {MODELS[args.model]} (cpu)", flush=True)
    processor = AutoImageProcessor.from_pretrained(MODELS[args.model])
    model = AutoModelForDepthEstimation.from_pretrained(MODELS[args.model])
    model.eval()

    for path_str in args.images:
        path = Path(path_str)
        t0 = time.time()
        image = Image.open(path).convert("RGB")

        inputs = processor(images=image, return_tensors="pt")
        with torch.no_grad():
            outputs = model(**inputs)

        # Depth Anything predicts relative inverse depth: larger = nearer.
        depth = outputs.predicted_depth  # (1, H', W')
        depth = torch.nn.functional.interpolate(
            depth.unsqueeze(1),
            size=image.size[::-1],
            mode="bicubic",
            align_corners=False,
        ).squeeze()

        d = depth.numpy()
        d = (d - d.min()) / (d.max() - d.min())  # 0..1, near = 1 = bright
        d16 = (d * 65535.0).astype(np.uint16)

        out = outdir / f"{path.stem}.png"
        Image.fromarray(d16).save(out)
        print(f"{path.name} -> {out} ({time.time() - t0:.1f}s)", flush=True)


if __name__ == "__main__":
    sys.exit(main())
