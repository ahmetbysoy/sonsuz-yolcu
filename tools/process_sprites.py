#!/usr/bin/env python3
"""Sonsuz Yolcu - sprite işleme:
- Beyaz zeminleri şeffaflaştır (kenar-bağlı bileşen flood fill)
- Poz/engel sayfalarını tek tek sprite'lara böl
- Kıvılcım (lacivert zemin) -> parlaklık bazlı alpha
"""
import numpy as np
from PIL import Image
from scipy import ndimage
import os

CLIENT = "/home/user/sonsuz-yolcu/assets/client"

def load(p):
    return np.array(Image.open(p).convert("RGB"))

def save_rgba(arr, alpha, path):
    rgba = np.dstack([arr, alpha.astype(np.uint8)])
    Image.fromarray(rgba, "RGBA").save(path)
    print(f"  ✓ {os.path.basename(path)} ({rgba.shape[1]}x{rgba.shape[0]})")

def white_to_alpha(rgb, thresh=242):
    """Kenarlara bağlanan beyaz bölgeleri şeffaf yap; içerideki beyazlar (göz parlaması) korunur."""
    white = (rgb[..., 0] > thresh) & (rgb[..., 1] > thresh) & (rgb[..., 2] > thresh)
    lab, n = ndimage.label(white)
    border = set(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    border.discard(0)
    bg = np.isin(lab, list(border))
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    # yumuşak kenar: alpha'yı 1px erosion ile hafifçe featherla
    return alpha

def autocrop(alpha, pad=8):
    ys, xs = np.where(alpha > 10)
    if len(ys) == 0:
        return None
    y0, y1 = max(0, ys.min()-pad), min(alpha.shape[0], ys.max()+pad)
    x0, x1 = max(0, xs.min()-pad), min(alpha.shape[1], xs.max()+pad)
    return (x0, y0, x1, y1)

def find_clusters(rgb, min_area=0.005, dilate_iter=20):
    """İçerik kümelerini bul (bölmek için). Beyaz olmayan pikselleri birleştirip bbox döner."""
    nonwhite = ~((rgb[..., 0] > 240) & (rgb[..., 1] > 240) & (rgb[..., 2] > 240))
    nonwhite = ndimage.binary_dilation(nonwhite, iterations=dilate_iter)
    lab, n = ndimage.label(nonwhite)
    areas = ndimage.sum(nonwhite, lab, range(1, n+1))
    boxes = []
    H, W = rgb.shape[:2]
    for i, a in enumerate(areas, start=1):
        if a < min_area * H * W:
            continue
        ys, xs = np.where(lab == i)
        boxes.append((xs.min(), ys.min(), xs.max(), ys.max()))
    # iç içe/çakışan kutuları birleştir
    merged = True
    while merged:
        merged = False
        out = []
        while boxes:
            b = boxes.pop()
            for j, o in enumerate(out):
                if not (b[2] < o[0]-30 or b[0] > o[2]+30 or b[3] < o[1]-30 or b[1] > o[3]+30):
                    out[j] = (min(b[0], o[0]), min(b[1], o[1]), max(b[2], o[2]), max(b[3], o[3]))
                    merged = True
                    break
            else:
                out.append(b)
        boxes = out
    boxes.sort(key=lambda b: (b[1] // 200, b[0]))
    return boxes

print("== 1) VOLT ana görsel ==")
rgb = load(f"{CLIENT}/volt/volt_main.png")
alpha = white_to_alpha(rgb)
box = autocrop(alpha)
rgb_c = rgb[box[1]:box[3], box[0]:box[2]]
alpha_c = alpha[box[1]:box[3], box[0]:box[2]]
save_rgba(rgb_c, alpha_c, f"{CLIENT}/volt/volt_main.png")

print("== 2) VOLT pozları -> 4 sprite ==")
rgb = load(f"{CLIENT}/volt/volt_poses.png")
boxes = find_clusters(rgb)
print(f"  bulunan küme: {len(boxes)}")
names = ["volt_run", "volt_jump", "volt_slide", "volt_cheer"]
for i, b in enumerate(boxes[:4]):
    x0, y0, x1, y1 = b
    x0, y0 = max(0, x0-8), max(0, y0-8)
    x1, y1 = min(rgb.shape[1], x1+8), min(rgb.shape[0], y1+8)
    crop = rgb[y0:y1, x0:x1]
    alpha = white_to_alpha(crop)
    tb = autocrop(alpha, pad=4)
    crop = crop[tb[1]:tb[3], tb[0]:tb[2]]
    alpha = alpha[tb[1]:tb[3], tb[0]:tb[2]]
    name = names[i] if i < len(names) else f"volt_extra_{i}"
    save_rgba(crop, alpha, f"{CLIENT}/volt/{name}.png")

print("== 3) Engeller -> 4 sprite ==")
rgb = load(f"{CLIENT}/obstacles/obstacle_set.png")
boxes = find_clusters(rgb, min_area=0.01, dilate_iter=25)
print(f"  bulunan küme: {len(boxes)}")
names = ["obs_boulder", "obs_fence", "obs_branch", "obs_crystal"]
for i, b in enumerate(boxes[:4]):
    x0, y0, x1, y1 = b
    x0, y0 = max(0, x0-8), max(0, y0-8)
    x1, y1 = min(rgb.shape[1], x1+8), min(rgb.shape[0], y1+8)
    crop = rgb[y0:y1, x0:x1]
    alpha = white_to_alpha(crop)
    tb = autocrop(alpha, pad=4)
    crop = crop[tb[1]:tb[3], tb[0]:tb[2]]
    alpha = alpha[tb[1]:tb[3], tb[0]:tb[2]]
    name = names[i] if i < len(names) else f"obs_extra_{i}"
    save_rgba(crop, alpha, f"{CLIENT}/obstacles/{name}.png")

print("== 4) Kıvılcım (lacivert zemin -> glow alpha) ==")
rgb = load(f"{CLIENT}/pickups/spark.png").astype(np.int16)
border_pix = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
bg = np.median(border_pix, axis=0)
dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
alpha = np.clip((dist - 6) / 90.0, 0, 1) * 255
alpha = alpha.astype(np.uint8)
tb = autocrop(alpha, pad=4)
rgb_u = rgb.astype(np.uint8)[tb[1]:tb[3], tb[0]:tb[2]]
alpha = alpha[tb[1]:tb[3], tb[0]:tb[2]]
save_rgba(rgb_u, alpha, f"{CLIENT}/pickups/spark.png")

print("\nTamamlandı!")
