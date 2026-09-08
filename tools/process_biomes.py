#!/usr/bin/env python3
"""Biome asset işleyici: cave (Kristal Mağara) + city (Bulut Şehri).
Her biome: road tile (çizgi-piksel ölçümü -> yatay crop -> dikey wrap -> 400px),
hills (genişlik normalize), props (3x2 grid böl -> bg-alfa -> yakın komponent koruma),
bg (meadow_bg ile aynı hedef boyuta cover-resize).
Kullanım: python3 tools/process_biomes.py [cave|city]
"""
import json, sys
from collections import deque
from PIL import Image

RAW = "assets/client/biome"
OUT = "client/assets/biome"
TARGET_ROAD_W = 400
TARGET_BG = Image.open(f"{OUT}/meadow_bg.png").size   # meadow ile aynı
TARGET_HILLS_W = 943                                   # meadow far_hills genişliği

BIOMES = {
    "cave": {
        "road": "cave_road_tile_raw.png",
        "hills": "cave_far_hills_raw.png",
        "props": "cave_props_grid_raw.png",
        "bg": "cave_bg_raw.png",
        # çizgi rengi: cyan -> (g,b yüksek, r düşük)
        "line_score": lambda r, g, b: min(g, b) - r,
    },
    "city": {
        "road": "city_road_tile_raw.png",
        "hills": "city_far_hills_raw.png",
        "props": "city_props_grid_raw.png",
        "bg": "city_bg_raw.png",
        # çizgi rengi: sarı -> r+g yüksek, b düşük (meadow yöntemi)
        "line_score": lambda r, g, b: (r + g) // 2 - b,
    },
}

def find_lines(im):
    """Yol tile'ında 2 şerit çizgisinin x-merkezlerini piksel skoruyla bul."""
    im = im.convert("RGB")
    w, h = im.size
    px = im.load()
    scores = []
    for x in range(w):
        s = 0
        for y in range(0, h, 4):
            r, g, b = px[x, y]
            v = BIOME_LINE_SCORE(r, g, b)
            if v > 60: s += v
        scores.append(s)
    thr = max(scores) * 0.45
    runs, cur = [], None
    for x, s in enumerate(scores):
        if s > thr:
            cur = [x, x] if cur is None else [cur[0], x]
        else:
            if cur: runs.append(cur); cur = None
    if cur: runs.append(cur)
    centers = [(a + b) // 2 for a, b in runs if b - a < w // 4]
    return centers

def wrap_cut(im):
    """Dikey seamless için en iyi kesme satırını bul, tile'ı oradan döndür."""
    im = im.convert("RGB")
    w, h = im.size
    px = im.load()
    best, best_diff = 0, 1e18
    for cut in range(0, h, 2):
        diff = 0
        for x in range(0, w, 6):
            r1, g1, b1 = px[x, cut]
            r2, g2, b2 = px[x, (cut - 1) % h]
            diff += abs(r1 - r2) + abs(g1 - g2) + abs(b1 - b2)
        if diff < best_diff: best_diff, best = diff, cut
    top = im.crop((0, best, w, h))
    bot = im.crop((0, 0, w, best))
    out = Image.new("RGB", (w, h))
    out.paste(top, (0, 0)); out.paste(bot, (0, h - best))
    return out, best, best_diff

def process_road(biome, cfg):
    im = Image.open(f"{RAW}/{cfg['road']}")
    global BIOME_LINE_SCORE
    BIOME_LINE_SCORE = cfg["line_score"]
    raw_centers = find_lines(im)
    # yakın run'ları birleştir (kalın çizgi 2 run verebilir)
    merged = []
    for c in raw_centers:
        if merged and c - merged[-1] < 30: continue
        merged.append(c)
    # en eşit aralıklı ardışık 3'lüyü seç (fazla hat = kenar parlaması olabilir)
    best = None
    for i in range(len(merged) - 2):
        g1, g2 = merged[i+1] - merged[i], merged[i+2] - merged[i+1]
        score = abs(g1 - g2)
        if best is None or score < best[0]: best = (score, i)
    centers = merged[best[1]:best[1] + 3]
    print(f"  [{biome}] ham: {raw_centers} -> birleşik: {merged} -> seçilen: {centers}")
    assert len(centers) == 3, f"3 çizgi bulunamadı: {merged}"
    kenar, orta, sag = centers
    aralik = orta - kenar
    x0 = kenar + 2
    x1 = x0 + 3 * aralik
    im2 = im.crop((x0, 0, min(x1, im.width), im.height))
    if x1 > im.width:   # kaynakta sağ pay yoksa yolun İÇİNİ aynayla doldur (siyah bant YOK)
        need = x1 - im.width
        pad = Image.new("RGB", (x1 - x0, im.height))
        pad.paste(im2, (0, 0))
        # ayna kaynağı: görüntünün en sağdaki 'need' pikseli (yol dokusu), aynalanır
        src_w = min(need, im.width - x0)
        mirror = im.crop((im.width - src_w, 0, im.width, im.height)).transpose(Image.FLIP_LEFT_RIGHT)
        pad.paste(mirror.crop((0, 0, need, im.height)), (im2.width - (src_w - need) if src_w < need else im2.width - 0, 0) if False else (im.width - x0, 0))
        # eğer tek ayna yetmediyse tekrar aynala
        while im.width - x0 + (need if src_w >= need else src_w) < (x1 - x0):
            extra = pad.crop((pad.width - src_w, 0, pad.width, im.height)).transpose(Image.FLIP_LEFT_RIGHT)
            pad.paste(extra, (pad.width, 0) if pad.width + src_w <= (x1 - x0) else (x1 - x0 - src_w, 0))
            break
        im2 = pad
        print(f"  [{biome}] sağ pay içeriden aynayla dolduruldu (+{need}px)")
    im3, cut, diff = wrap_cut(im2)
    nh = int(im3.height * TARGET_ROAD_W / im3.width)
    im3 = im3.resize((TARGET_ROAD_W, nh), Image.LANCZOS)
    import os
    os.makedirs(f"{OUT}/{biome}", exist_ok=True)
    im3.save(f"{OUT}/{biome}/road_tile.png")
    rel = [round((c - x0) / (x1 - x0), 3) for c in centers]
    print(f"  [{biome}] road: crop x[{x0},{x1}] wrap cut {cut} (diff {diff}) -> {im3.size}, çizgi rel {rel}")
    return rel

def bg_alpha(im):
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            mx, mn = max(r, g, b), min(r, g, b)
            if mx >= 195 and (mx - mn) <= 20:
                px[x, y] = (0, 0, 0, 0)
    return im

def components(alpha):
    w, h = alpha.size
    seen = [[False] * w for _ in range(h)]
    comps = []
    for yy in range(h):
        for xx in range(w):
            if seen[yy][xx] or alpha.getpixel((xx, yy))[3] == 0:
                continue
            q = deque([(xx, yy)]); seen[yy][xx] = True
            pts = []
            while q:
                cx, cy = q.popleft(); pts.append((cx, cy))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and alpha.getpixel((nx, ny))[3] > 0:
                            seen[ny][nx] = True; q.append((nx, ny))
            xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
            comps.append((pts, (min(xs), min(ys), max(xs), max(ys))))
    return comps

def keep_near(comps):
    comps = sorted(comps, key=lambda c: len(c[0]), reverse=True)
    if not comps: return []
    _, bb0 = comps[0]
    cx0, cy0 = (bb0[0] + bb0[2]) / 2, (bb0[1] + bb0[3]) / 2
    reach = max(bb0[2] - bb0[0], bb0[3] - bb0[1]) * 0.9
    kept = [comps[0]]
    for pts, bb in comps[1:]:
        cx, cy = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2
        if ((cx - cx0) ** 2 + (cy - cy0) ** 2) ** 0.5 <= reach:
            kept.append((pts, bb))
    return kept

def process_props(biome, cfg):
    im = Image.open(f"{RAW}/{cfg['props']}")
    cols, rows = 3, 2
    cw, chh = im.width / cols, im.height / rows
    import os
    os.makedirs(f"{OUT}/{biome}/props", exist_ok=True)
    sizes = []
    for i in range(cols * rows):
        col, row = i % cols, i // cols
        cell = bg_alpha(im.crop((int(col * cw), int(row * chh), int((col + 1) * cw), int((row + 1) * chh))))
        comps = keep_near(components(cell))
        assert comps, f"{biome} prop {i} boş!"
        kept = set()
        for pts, _ in comps: kept.update(pts)
        px = cell.load()
        for y in range(cell.height):
            for x in range(cell.width):
                if (x, y) not in kept: px[x, y] = (0, 0, 0, 0)
        b = cell.getbbox()
        cell = cell.crop(b)
        cell.save(f"{OUT}/{biome}/props/{i}.png")
        sizes.append(cell.size)
    print(f"  [{biome}] props: {sizes}")

def process_hills_bg(biome, cfg):
    import os
    os.makedirs(f"{OUT}/{biome}", exist_ok=True)
    h = Image.open(f"{RAW}/{cfg['hills']}")
    nh = int(h.height * TARGET_HILLS_W / h.width)
    h = h.resize((TARGET_HILLS_W, nh), Image.LANCZOS)
    h.save(f"{OUT}/{biome}/hills.png")
    bg = Image.open(f"{RAW}/{cfg['bg']}")
    s = max(TARGET_BG[0] / bg.width, TARGET_BG[1] / bg.height)
    bg = bg.resize((int(bg.width * s), int(bg.height * s)), Image.LANCZOS)
    x = (bg.width - TARGET_BG[0]) // 2; y = (bg.height - TARGET_BG[1]) // 2
    bg = bg.crop((x, y, x + TARGET_BG[0], y + TARGET_BG[1]))
    bg.save(f"{OUT}/{biome}/bg.png")
    print(f"  [{biome}] hills {h.size}, bg {bg.size}")

if __name__ == "__main__":
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for biome, cfg in BIOMES.items():
        if only and biome != only: continue
        process_hills_bg(biome, cfg)
        process_road(biome, cfg)
        process_props(biome, cfg)
    print("biome işleme bitti")
