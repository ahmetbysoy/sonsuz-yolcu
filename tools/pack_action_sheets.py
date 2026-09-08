#!/usr/bin/env python3
"""Aksiyon sheet paketleyici (jump/slide/stumble/cheer).
Ham yatay grid -> beyaz->şeffaf -> komponent filtresi (yakın kırıntılar KORUNUR:
toz/yıldız/konfeti karakter dibinde kalır, uzak grid kırıntıları düşer)
-> üniform hücreler (dibine hizalı + üst pad) -> yatay sheet + JSON.
Kullanım: python3 tools/pack_action_sheets.py [sadeceBir]
"""
import json, sys
from collections import deque
from PIL import Image

BASE = "client/assets/volt"     # ÇIKTI klasörü
RAW_BASE = "assets/client/volt" # ham gridler
DOCS = "docs"
JOBS = [
    # (raw, out_base, COLS, hedef_kare_sayısı, mod)
    # mod "keep"  : hücre içi dikey konum KORUNUR (zıplama kavisi gibi)
    # mod "bottom": karakterler hücre dibine hizalanır (yerdeki aksiyonlar)
    ("volt_jump_grid_raw.png",    "volt_jump_sheet",    6, 6, "keep"),
    ("volt_slide_grid_raw.png",   "volt_slide_sheet",   5, 5, "bottom"),
    ("volt_stumble_grid_raw.png", "volt_stumble_sheet", 5, 5, "bottom"),
    ("volt_cheer_grid_raw.png",   "volt_cheer_sheet",   6, 6, "bottom"),
]
WHITE_T = 236   # >= bu değer beyaz sayılır
PAD_RATIO = 0.25  # hücre üstü boşluk (karakter yüksekliğinin katı)

def white_to_alpha(im):
    """Arka plan temizliği: beyaz + açık GRİ (grid çizgileri/pus).
    Kural: düşük doygunluk (max-min<=20) VE parlaklık>=195 -> şeffaf.
    Bej toz (max-min~30+) ve sarı parlama korunur."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            mx, mn = max(r, g, b), min(r, g, b)
            if mx >= 195 and (mx - mn) <= 20:
                px[x, y] = (r, g, b, 0)
    return im

def components(alpha):
    """Şeffaf-olmayan 8-komşuluk komponentleri -> [(piksel_listesi, bbox)]"""
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

def keep_filter(comps):
    """En büyük komponent (gövde) + merkezine yeterince yakın olanlar (toz/yıldız)."""
    if not comps: return []
    comps = sorted(comps, key=lambda c: len(c[0]), reverse=True)
    (pts0, bb0) = comps[0]
    cx0, cy0 = (bb0[0] + bb0[2]) / 2, (bb0[1] + bb0[3]) / 2
    reach = max(bb0[2] - bb0[0], bb0[3] - bb0[1]) * 0.75
    kept = [comps[0]]
    for pts, bb in comps[1:]:
        cx, cy = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2
        if ((cx - cx0) ** 2 + (cy - cy0) ** 2) ** 0.5 <= reach:
            kept.append((pts, bb))
    return kept

def cell_crop(im, comps):
    xs = []; ys = []
    for pts, bb in comps:
        xs += [bb[0], bb[2]]; ys += [bb[1], bb[3]]
    return im.crop((min(xs), min(ys), max(xs) + 1, max(ys) + 1))

def pack(raw_name, out_base, cols, expect, mode="bottom"):
    im = Image.open(f"{RAW_BASE}/{raw_name}")
    W, H = im.size
    cw = W / cols
    frames = []
    if mode == "keep":
        # Hücre içi dikey konum KORUNUR (zıplama kavisi)
        cells = []
        for i in range(cols):
            c = white_to_alpha(im.crop((int(i * cw), 0, int((i + 1) * cw), H)))
            comps = keep_filter(components(c))
            if not comps:
                raise SystemExit(f"{raw_name} hucre {i}: icerik yok!")
            kept = set()
            for pts, _ in comps: kept.update(pts)
            px = c.load(); w, h = c.size
            for y in range(h):
                for x in range(w):
                    if (x, y) not in kept: px[x, y] = (0, 0, 0, 0)
            cells.append(c)
        fw = max(c.width for c in cells); fh = max(c.height for c in cells)
        sheet = Image.new("RGBA", (fw * cols, fh), (0, 0, 0, 0))
        for i, c in enumerate(cells):
            ox, oy = i * fw + (fw - c.width) // 2, (fh - c.height) // 2
            sheet.paste(c, (ox, oy))
            b = c.getbbox()
            frames.append({"index": i, "x": ox + b[0], "y": oy + b[1], "w": b[2] - b[0], "h": b[3] - b[1]})
    else:
        cells = []
        for i in range(cols):
            c = white_to_alpha(im.crop((int(i * cw), 0, int((i + 1) * cw), H)))
            comps = keep_filter(components(c))
            if not comps:
                raise SystemExit(f"{raw_name} hucre {i}: icerik yok!")
            cells.append(cell_crop(c, comps))
        if expect and len(cells) != expect:
            raise SystemExit(f"{raw_name}: {len(cells)} kare geldi, {expect} bekleniyordu")
        fw = max(c.width for c in cells)
        ch = max(c.height for c in cells)
        fh = int(ch * (1 + PAD_RATIO))
        sheet = Image.new("RGBA", (fw * cols, fh), (0, 0, 0, 0))
        for i, c in enumerate(cells):
            x = i * fw + (fw - c.width) // 2
            y = fh - c.height
            sheet.paste(c, (x, y))
            frames.append({"index": i, "x": x, "y": y, "w": c.width, "h": c.height})
    out_png = f"{BASE}/{out_base}.png"
    sheet.save(out_png)
    meta = {"image": f"{out_base}.png", "cols": cols, "rows": 1, "count": cols,
            "frameW": fw, "frameH": fh,
            "fps": None, "anchor": {"x": 0.5, "y": 1.0}, "mode": mode, "frames": frames}
    with open(f"{DOCS}/{out_base}.json", "w") as f:
        json.dump(meta, f, indent=1)
    print(f"  ✓ {out_base} [{mode}]: {cols} kare, hucre {fw}x{fh} -> {out_png}")

if __name__ == "__main__":
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for raw, out, cols, expect, mode in JOBS:
        if only and only not in raw: continue
        pack(raw, out, cols, expect, mode)
    print("paketsiz bırakılan yok — bitti")
