#!/usr/bin/env python3
"""Run one deterministic trace -> recreation -> mutation -> judgment cycle."""
import argparse
import json
import subprocess
import sys
from pathlib import Path


def atomic_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog", required=True)
    ap.add_argument("--target", default="fp_pressure_valve_gate")
    ap.add_argument("--trace", required=True)
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--lora", required=True)
    ap.add_argument("--comfy-output", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--api", default="http://127.0.0.1:8188")
    ap.add_argument("--seed", default="314159")
    ap.add_argument("--node", default="node")
    ap.add_argument("--boxcraft-cli", required=True)
    ap.add_argument("--prepare-only", action="store_true")
    args = ap.parse_args()

    catalog = json.loads(Path(args.catalog).read_text(encoding="utf-8"))
    asset = next((item for item in catalog["assets"] if item["id"] == args.target), None)
    if asset is None or asset.get("wave") != "P0":
        raise SystemExit("UNKNOWN: review target must be a catalog P0 asset")
    required = {"pipe", "valve", "tendon", "connective_tissue"}
    systems = {item["system"] for item in asset["components"]}
    if systems != required:
        raise SystemExit("REJECT: P0 component system inventory changed")
    functions = "; ".join(item["function"] for item in asset["components"])
    base = (
        "drw_fleshpunk, strict black ink lineart on pure white, no shading, no gray, no hatching, "
        f"functional {asset['id'].replace('_', ' ')}, assembled view plus true exploded view plus orthographic view, "
        f"hosted on {asset['host_surface']}, silhouette {asset['silhouette']}, components: {functions}"
    )
    prompts = [
        {"id": f"{asset['id']}_recreation", "seed": int(args.seed), "prompt": base + ", faithful recreation, separated parts readable"},
        {"id": f"{asset['id']}_mutation", "seed": int(args.seed) + 1, "prompt": base + ", one-factor mutation: thicken only the external brutalist load frame, preserve component graph and service route"},
    ]
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    prompts_path = out / "prompts.json"
    atomic_json(prompts_path, prompts)
    if args.prepare_only:
        print(json.dumps({"status": "OBSERVE", "prepared": str(prompts_path), "target": asset["id"], "reason": "generation deliberately skipped"}))
        return

    here = Path(__file__).resolve().parent
    subprocess.run([sys.executable, str(here / "comfy_generate.py"), "--api", args.api, "--checkpoint", args.checkpoint, "--lora", args.lora, "--prompts", str(prompts_path), "--comfy-output", args.comfy_output, "--out", str(out)], check=True)
    recreation = out / f"{asset['id']}_recreation.png"
    mutation = out / f"{asset['id']}_mutation.png"
    regnet = out / "regnet-judgment.json"
    subprocess.run([sys.executable, str(here / "regnet_judge.py"), "--trace", args.trace, "--recreation", str(recreation), "--mutation", str(mutation), "--out", str(regnet)], check=False)
    decision = out / "mutation-decision.json"
    judged = subprocess.run([args.node, args.boxcraft_cli, asset["id"], str(args.seed), str(regnet), str(decision)])
    if not decision.exists():
        raise SystemExit("REJECT: Boxcraft did not emit a mutation decision")
    payload = json.loads(decision.read_text())
    print(json.dumps({"status": payload["status"], "mutationDecision": payload["mutationDecision"], "finalAcceptance": payload["finalAcceptance"], "receipt": str(decision)}))
    if judged.returncode not in (0, 2):
        raise SystemExit(judged.returncode)


if __name__ == "__main__":
    main()
