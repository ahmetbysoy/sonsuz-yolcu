#!/usr/bin/env python3
"""Çevre + idle asset işleme:
1) volt_idle_grid_raw.png (4x3=12) → client idle kareleri (idle0..11.png) + sheet + json
2) road_tile_raw.png → 3-şerit crop + dikey seamless wrap noktası → road_tile.png
3) props_grid_raw.png (3x2) → 6 ayrı prop PNG
4) far_hills_raw.png → genişliği normalize et → far_hills.png
"""
import json
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = "/home/user/sonsuz-yolcu/assets/client"
CV = "/home/user/sonsuz-yolcu/client/assets"

def white_to_alpha(img, thresh=242):
    white = (img[..., 0] > thresh) & (img[..., 1] > thresh) & (img[..., 2] > thresh)
    lab, _ = ndimage.label(white)
    border = set(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    border.discard(0)
    return np.where(np.isin(lab, list(border)), 0, 255).astype(np.uint8)

def largest_component(alpha):
    solid = alpha > 10
    lab, n = ndimage.label(solid, structure=np.ones((3, 3)))
    if n > 1:
        sizes = ndimage.sum(solid, lab, range(1, n + 1))
        keep = int(np.argmax(sizes)) + 1
        alpha[lab != keep] = 0
    return alpha

def crop_alpha(arr, pad=4):
    ys, xs = np.where(arr[..., 3] > 10)
    y0, y1 = max(0, ys.min()-pad), min(arr.shape[0], ys.max()+pad+1)
    x0, x1 = max(0, xs.min()-pad), min(arr.shape[1], xs.max()+pad+1)
    return arr[y0:y1, x0:x1]

print("== 1) IDLE sheet ==")
rgb = np.array(Image.open(f"{SRC}/volt/volt_idle_grid_raw.png").convert("RGB"))
H, W = rgb.shape[:2]
COLS, ROWS = 4, 3
re_ = [round(r*H/ROWS) for r in range(ROWS+1)]
ce_ = [round(c*W/COLS) for c in range(COLS+1)]
frames = []
import os
os.makedirs(f"{CV}/volt/idle", exist_ok=True)
for r in range(ROWS):
    for c in range(COLS):
        cell = rgb[re_[r]:re_[r+1], ce_[c]:ce_[c+1]]
        alpha = largest_component(white_to_alpha(cell))
        arr = np.dstack([cell, alpha])
        arr = crop_alpha(arr)
        idx = r*COLS + c
        Image.fromarray(arr, "RGBA").save(f"{CV}/volt/idle/idle{idx}.png")
        frames.append(arr.shape)
        print(f"  idle{idx}: {arr.shape[1]}x{arr.shape[0]}")
fw = max(f[1] for f in frames) + 16
fh = max(f[0] for f in frames) + 16
sheet = Image.new("RGBA", (fw*COLS, fh*ROWS), (0,0,0,0))
meta = {"image": "volt_idle_sheet.png", "cols": COLS, "rows": ROWS, "count": len(frames),
        "frameW": fw, "frameH": fh, "anchor": {"x": 0.5, "y": 1.0}, "fps": 7, "frames": []}
# koordinatlarla yeniden paketle
idx = 0
for r in range(ROWS):
    for c in range(COLS):
        cell = rgb[re_[r]:re_[r+1], ce_[c]:ce_[c+1]]
        alpha = largest_component(white_to_alpha(cell))
        arr = crop_alpha(np.dstack([cell, alpha]))
        ox = c*fw + (fw - arr.shape[1])//2
        oy = (r+1)*fh - 8 - arr.shape[0]
        sheet.paste(Image.fromarray(arr, "RGBA"), (ox, oy))
        meta["frames"].append({"index": idx, "x": ox, "y": oy, "w": arr.shape[1], "h": arr.shape[0]})
        idx += 1
sheet.save(f"{CV}/volt/volt_idle_sheet.png")
meta["image"] = "volt_idle_sheet.png"
json.dump(meta, open("/home/user/sonsuz-yolcu/docs/volt_idle_sheet.json", "w"), indent=1)
sheet.save("/home/user/sonsuz-yolcu/docs/volt_idle_sheet.png")
print(f"  ✓ volt_idle_sheet.png ({sheet.size[0]}x{sheet.size[1]})")

print("== 2) ROAD tile ==")
rgb = np.array(Image.open(f"{SRC}/biome/road_tile_raw.png").convert("RGB"))
H, W = rgb.shape[:2]
# 4 çizgiden dıştakileri kes → 2 iç çizgi (3 şerit). Çizgiler doku x'in ~%25/%75'i dışında.
x0, x1 = int(W*0.285), int(W*0.715)
road = rgb[:, x0:x1]
# dikey seamless wrap noktası: 8px aramalı en benzer üst/alt satır çifti
best, best_dy = 1e18, 0
small = road[::4, ::4].astype(np.int16)
for dy in range(0, small.shape[0]//3):
    d = np.abs(small[0] - small[-1-dy]).sum() + np.abs(small[dy] - small[-1]).sum()
    if d < best: best, best_dy = d, dy
cut = (small.shape[0] - best_dy) * 4
road2 = np.vstack([road[cut:], road[:cut]])
Image.fromarray(road2).save(f"{CV}/biome/road_tile.png")
print(f"  ✓ road_tile.png ({road2.shape[1]}x{road2.shape[0]}, wrap kayması: {cut}px)")

print("== 3) PROPS ==")
rgb = np.array(Image.open(f"{SRC}/biome/props_grid_raw.png").convert("RGB"))
H, W = rgb.shape[:2]
COLS, ROWS = 3, 2
re_ = [round(r*H/ROWS) for r in range(ROWS+1)]
ce_ = [round(c*W/COLS) for c in range(COLS+1)]
names = ["bush", "pebbles", "tree", "mushrooms", "grass", "lantern"]
os.makedirs(f"{CV}/biome/props", exist_ok=True)
for r in range(ROWS):
    for c in range(COLS):
        cell = rgb[re_[r]:re_[r+1], ce_[c]:ce_[c+1]]
        # ince grid çizgileri (hafif gri) varsa: beyaz eşik onları da alır; komponent filtresi
        alpha = largest_component(white_to_alpha(cell, 236))
        arr = crop_alpha(np.dstack([cell, alpha]))
        n = names[r*COLS + c]
        Image.fromarray(arr, "RGBA").save(f"{CV}/biome/props/{n}.png")
        print(f"  ✓ {n}.png ({arr.shape[1]}x{arr.shape[0]})")

print("== 4) HILLS ==")
im = Image.open(f"{SRC}/biome/far_hills_raw.png").convert("RGB")
im.thumbnail((2048, 400))
im.save(f"{CV}/biome/far_hills.png")
print(f"  ✓ far_hills.png ({im.size[0]}x{im.size[1]})")
print("\nBİTTİ")
