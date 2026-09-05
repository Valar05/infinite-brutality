#!/data/data/com.termux/files/usr/bin/sh
set -eu
cd "$(dirname "$0")/boxcraft-judgment-mcp"
npm test
npm run smoke
