#!/data/data/com.termux/files/usr/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
URL_BASE="http://127.0.0.1:8798/infinite-brutality/index.html"

cd "$REPO_DIR"

BUILD_TOKEN=$(sed -n "s/^const BUILD = '\([^']*\)';/\1/p" src/main.js | head -1)
HTML_TOKEN=$(sed -n "s/.*src=\"\\.\\/src\\/main.js?v=\([^\"]*\)\".*/\1/p" index.html | head -1)

if [ -z "$BUILD_TOKEN" ]; then
  echo "doctor: could not read BUILD token from src/main.js" >&2
  exit 1
fi

if [ "$BUILD_TOKEN" != "$HTML_TOKEN" ]; then
  echo "doctor: cache-bust mismatch: main.js BUILD=$BUILD_TOKEN index.html=$HTML_TOKEN" >&2
  exit 1
fi

echo "doctor: build token $BUILD_TOKEN"

node --input-type=module --check < src/main.js
node --check src/district-assembly-emitter.js
node --check src/district-intent-planner.js
node --check src/carved-voxel-fortress-slice.js
node tools/test_district_assembly_contract.mjs
node tools/test_district_walkability_contract.mjs
node tools/test_district_intent_planner_contract.mjs
node tools/test_carved_voxel_fortress_contract.mjs
node tools/test_island_grammar_contract.mjs
node tools/test_terrain_visual_collision_truth_contract.mjs
node tools/test_physics_world_contract.mjs
node tools/test_player_climb_contract.mjs
node tools/test_support_sweep_contract.mjs
git diff --check

if sh tools/status_local_server.sh >/dev/null 2>&1; then
  echo "doctor: server running"
else
  echo "doctor: server not healthy; start with sh tools/start_local_server.sh" >&2
  exit 1
fi

echo "doctor: foundry url $URL_BASE?reset=1&v=$BUILD_TOKEN&district=imperial_foundry"
