#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "→ git pull..."
git pull

echo "→ Aggiornamento dipendenze Python..."
"$ROOT/backend/venv/bin/pip" install -r "$ROOT/backend/requirements.txt" -q

echo "→ Build frontend..."
cd "$ROOT/frontend"
npm install --silent
NODE_OPTIONS='--max-old-space-size=512' npm run build
cd "$ROOT"

echo "→ Riavvio pm2..."
pm2 restart all

echo "✓ Aggiornamento completato."
