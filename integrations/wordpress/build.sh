#!/usr/bin/env bash
# Fabrique dist/repere-ia.zip (dossier racine « repere-ia/ », format attendu par WordPress).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist
rm -f dist/repere-ia.zip
if command -v php >/dev/null 2>&1; then
  php -l repere-ia/repere-ia.php >/dev/null
  php -l repere-ia/uninstall.php >/dev/null
fi
zip -qr -X dist/repere-ia.zip repere-ia -x '*.DS_Store'
echo "dist/repere-ia.zip prêt"
