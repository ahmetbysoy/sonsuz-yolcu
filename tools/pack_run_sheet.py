#!/usr/bin/env python3
"""volt_run_grid_raw.png (4x3=12 kare) → volt_run_sheet.png + volt_run_sheet.json
- her hücreyi beyaz-zemin şeffaflaştırıp içerik bbox'ı ile kırpar
- tüm kareleri TEK boyuta paketler (taban-orta çapa: ayaklar aynı çizgide)
- JSON: kare koordinatları + çapa + önerilen fps
"""
import json
import numpy as np
from PIL import Image
from scipy import ndimage

RAW = "/home/user/sonsuz-yolcu/assets/client/volt/volt_run_grid_raw.png"
OUT_SHEET = "/home/user/sonsuz-yolcu/client/assets/volt/volt_run_sheet.png"
OUT_JSON = "/home/user/sonsuz-yolcu/docs/volt_run_sheet.json"
COLS, ROWS = 4, 3
PAD = 10  # paketlenmiş hücre içi güvenlik boşluğu

def white_to_alpha(img, thresh=242):
    white = (img[..., 0] > thresh) & (img[..., 1] > thresh) & (img[..., 2] > thresh)
    lab, _ = ndimage.label(white)
    border = set(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    border.discard(0)
    return np.where(np.isin(lab, list(border)), 0, 255).astype(np.uint8)

rgb = np.array(Image.open(RAW).convert("RGB"))
H, W = rgb.shape[:2]
# tam bölünmeyen gridlerde kenar kaymasını önle (yüzde tabanlı sınırlar)
row_edges = [round(r * H / ROWS) for r in range(ROWS + 1)]
col_edges = [round(c * W / COLS) for c in range(COLS + 1)]
print(f"grid: {W}x{H}, satır sınırları: {row_edges}")

frames = []
for r in range(ROWS):
    for c in range(COLS):
        cell = rgb[row_edges[r]:row_edges[r+1], col_edges[c]:col_edges[c+1]]
        alpha = white_to_alpha(cell)
        # komşu hücreden taşan ince kırıntıları at (en büyük komponent kalsın)
        solid = alpha > 10
        lab, n = ndimage.label(solid, structure=np.ones((3, 3)))
        if n > 1:
            sizes = ndimage.sum(solid, lab, range(1, n + 1))
            keep = int(np.argmax(sizes)) + 1
            alpha[lab != keep] = 0
        ys, xs = np.where(alpha > 10)
        if len(ys) == 0:
            print(f"  ⚠ boş hücre r{r}c{c}"); continue
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        crop = np.dstack([cell[y0:y1+1, x0:x1+1], alpha[y0:y1+1, x0:x1+1]])
        frames.append(crop)
        print(f"  kare {r*COLS+c}: içerik {crop.shape[1]}x{crop.shape[0]}")

# tek boyutlu hücre
fw = max(f.shape[1] for f in frames) + PAD*2
fh = max(f.shape[0] for f in frames) + PAD*2
print(f"paket hücresi: {fw}x{fh}")

sheet = Image.new("RGBA", (fw*COLS, fh*ROWS), (0, 0, 0, 0))
meta = {"image": "volt_run_sheet.png", "cols": COLS, "rows": ROWS,
        "count": len(frames), "frameW": fw, "frameH": fh,
        "anchor": {"x": 0.5, "y": 1.0},   # taban-orta (ayak çizgisi)
        "fps": 14, "frames": []}

for i, f in enumerate(frames):
    r, c = divmod(i, COLS)
    # taban-orta yerleşim: alt kenar + PAD boşluk, yatay orta
    ox = c*fw + (fw - f.shape[1]) // 2
    oy = (r+1)*fh - PAD - f.shape[0]
    sheet.paste(Image.fromarray(f, "RGBA"), (ox, oy))
    meta["frames"].append({"index": i, "x": ox, "y": oy,
                           "w": f.shape[1], "h": f.shape[0]})

sheet.save(OUT_SHEET)
with open(OUT_JSON, "w") as fp:
    json.dump(meta, fp, indent=1)
print(f"✓ {OUT_SHEET} ({sheet.size[0]}x{sheet.size[1]}, {len(frames)} kare)")
print(f"✓ {OUT_JSON}")
print(f"SABİTLER → cols={COLS} rows={ROWS} count={len(frames)} frameW={fw} frameH={fh}")
