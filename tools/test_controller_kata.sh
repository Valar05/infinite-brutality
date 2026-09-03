#!/data/data/com.termux/files/usr/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
OUT_DIR="$REPO_DIR/.tmp/controller-kata-tests"
mkdir -p "$OUT_DIR"
rm -f "$OUT_DIR"/*.status "$OUT_DIR"/*.log
cd "$REPO_DIR"
run_lane() {
  name=$1
  shift
  (
    set +e
    "$@" >"$OUT_DIR/$name.log" 2>&1
    echo "$?" >"$OUT_DIR/$name.status"
  ) &
}
run_lane arena node tools/test_controller_kata_arena_contract.mjs
run_lane runtime node tools/test_controller_kata_runtime_contract.mjs
wait || true
run_lane main-syntax sh -c 'node --input-type=module --check < src/main.js'
run_lane physics node tools/test_physics_world_contract.mjs
wait || true
run_lane climb node tools/test_player_climb_contract.mjs
run_lane support node tools/test_support_sweep_contract.mjs
wait || true
failed=0
for name in arena runtime main-syntax physics climb support; do
  status=$(cat "$OUT_DIR/$name.status")
  if [ "$status" -eq 0 ]; then printf 'PASS %s\n' "$name"; else printf 'FAIL %s\n' "$name"; failed=1; fi
  sed -n '1,8p' "$OUT_DIR/$name.log"
done
git diff --check || failed=1
exit "$failed"
