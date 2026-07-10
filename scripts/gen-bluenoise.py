# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "pillow"]
# ///
"""Generate a 64x64 blue-noise tile via void-and-cluster (Ulichney).

One-shot: writes static/hero/bluenoise64.png (8-bit grayscale, tiling).
"""

import numpy as np
from PIL import Image

N = 64
SIGMA = 1.9
RNG = np.random.default_rng(42)

# Wrapped gaussian energy splat centered at (0, 0).
coords = np.arange(N)
d = np.minimum(coords, N - coords).astype(np.float64)
dx, dy = np.meshgrid(d, d, indexing="ij")
G = np.exp(-(dx**2 + dy**2) / (2.0 * SIGMA**2))


def energy_of(pattern: np.ndarray) -> np.ndarray:
    e = np.zeros((N, N))
    for x, y in zip(*np.nonzero(pattern)):
        e += np.roll(np.roll(G, x, axis=0), y, axis=1)
    return e


def tightest_cluster(pattern: np.ndarray, e: np.ndarray) -> tuple[int, int]:
    masked = np.where(pattern == 1, e, -np.inf)
    return np.unravel_index(np.argmax(masked), masked.shape)  # type: ignore[return-value]


def largest_void(pattern: np.ndarray, e: np.ndarray) -> tuple[int, int]:
    masked = np.where(pattern == 0, e, np.inf)
    return np.unravel_index(np.argmin(masked), masked.shape)  # type: ignore[return-value]


def splat(e: np.ndarray, x: int, y: int, sign: float) -> None:
    e += sign * np.roll(np.roll(G, x, axis=0), y, axis=1)


# Initial pattern: ~10% ones, then relax until stable.
pattern = np.zeros((N, N), dtype=np.int8)
ones = RNG.choice(N * N, size=N * N // 10, replace=False)
pattern.flat[ones] = 1
e = energy_of(pattern)

for _ in range(N * N):
    cx, cy = tightest_cluster(pattern, e)
    pattern[cx, cy] = 0
    splat(e, cx, cy, -1.0)
    vx, vy = largest_void(pattern, e)
    if (vx, vy) == (cx, cy):
        pattern[cx, cy] = 1
        splat(e, cx, cy, 1.0)
        break
    pattern[vx, vy] = 1
    splat(e, vx, vy, 1.0)

rank = np.zeros((N, N), dtype=np.int32)
m = int(pattern.sum())

# Phase 1: rank the initial ones by removing tightest clusters.
p1 = pattern.copy()
e1 = e.copy()
for r in range(m - 1, -1, -1):
    x, y = tightest_cluster(p1, e1)
    p1[x, y] = 0
    splat(e1, x, y, -1.0)
    rank[x, y] = r

# Phase 2: fill remaining ranks by inserting into largest voids.
p2 = pattern.copy()
e2 = e.copy()
for r in range(m, N * N):
    x, y = largest_void(p2, e2)
    p2[x, y] = 1
    splat(e2, x, y, 1.0)
    rank[x, y] = r

out = np.round(rank * 255.0 / (N * N - 1)).astype(np.uint8)
Image.fromarray(out, mode="L").save("static/hero/bluenoise64.png")
print(f"wrote static/hero/bluenoise64.png (ranks 0..{N * N - 1})")
