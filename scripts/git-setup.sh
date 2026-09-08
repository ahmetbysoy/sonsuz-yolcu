#!/usr/bin/env bash
# Git kimliği her oturumda kaybolabilir (sandbox) — hızlıca geri kurar.
# Kullanım: bash scripts/git-setup.sh "Ad Soyad" "eposta@ornek.com"
set -e
cd "$(dirname "$0")/.."
NAME="${1:-Sonsuz Yolcu Dev}"
MAIL="${2:-dev@sonsuz-yolcu.local}"
git config user.name  "$NAME"
git config user.email "$MAIL"
echo "✓ git kimliği ayarlandı: $NAME <$MAIL>"
echo "GitHub'a push için:"
echo "  git remote add origin https://github.com/<KULLANICI>/sonsuz-yolcu.git"
echo "  git push -u origin main"
