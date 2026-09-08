# ⚠️ VOLT Klasörleri — Hangisi Canlı?

| Klasör | Rolü |
|---|---|
| **`client/assets/volt/`** | ✅ **OYUNDA KULLANILAN TEK KLASOR.** `game.js` sadece buradan yükler. |
| `assets/client/volt/` | AI üretim KAYNAKLARI (orijinal sayfalar + `archive/` eski pozlar). Oyuna girmez, sadece referans. |

**Kural:** Bir sprite'ı değiştirirken `client/assets/volt/` altındakini değiştir.
`assets/client/volt/`'a dokunmak oyunu etkilemez (sadece kaynak arşivi).

## Canlı sprite listesi (client/assets/volt/)
- `volt_main.png` — menü/varsayılan poz
- `rig_body.png`, `rig_crest.png`, `armN.png`, `legN.png` — kukla rig parçaları (nötr uzuvlar)
- `volt_back_jump.png`, `volt_back_slide.png` — zıplama/kayma (arkadan)
- `face_cheer.png`, `face_dizzy.png`, `face_blink.png`, `face_surprised.png` — mimikler
  *(NOT: 2026-09 tarihinde 4 dosyanın 2 çifti içerik olarak çaprazdı — swap ile düzeltildi.
  face_dizzy=spiral gözler, face_blink=göz kırpma, face_cheer=konfetili kahkaha, face_surprised=şaşkın)*
