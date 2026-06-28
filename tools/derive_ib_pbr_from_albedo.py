#!/usr/bin/env python3
"""Derive technical PBR channels from OpenAI-generated albedo sources."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "assets/materials/ib_pbr_material_manifest.json"
SOURCE_DIR = ROOT / "assets/source/generated_textures/ib_pbr_openai"


def normalize_source(source: Image.Image, size: int = 1024) -> Image.Image:
    image = source.convert("RGB")
    w, h = image.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    image = image.crop((left, top, left + side, top + side))
    image = image.resize((size, size), Image.Resampling.LANCZOS)
    return ImageOps.autocontrast(image, cutoff=1)


def grayscale_height(albedo: Image.Image) -> Image.Image:
    gray = ImageOps.grayscale(albedo)
    gray = ImageOps.autocontrast(gray, cutoff=2)
    low = gray.filter(ImageFilter.GaussianBlur(5.5))
    detail = Image.blend(low, gray, 0.58)
    return ImageOps.autocontrast(detail, cutoff=1)


def normal_from_height(height: Image.Image, strength: float = 3.8) -> Image.Image:
    size = height.size[0]
    src = height.load()
    normal = Image.new("RGB", height.size)
    px = normal.load()
    for y in range(size):
        ym = (y - 1) % size
        yp = (y + 1) % size
        for x in range(size):
            xm = (x - 1) % size
            xp = (x + 1) % size
            dx = (src[xp, y] - src[xm, y]) / 255.0
            dy = (src[x, yp] - src[x, ym]) / 255.0
            nx = -dx * strength
            ny = -dy * strength
            nz = 1.0
            inv = 1.0 / math.sqrt(nx * nx + ny * ny + nz * nz)
            px[x, y] = (
                int((nx * inv * 0.5 + 0.5) * 255),
                int((ny * inv * 0.5 + 0.5) * 255),
                int((nz * inv * 0.5 + 0.5) * 255),
            )
    return normal


def grayscale_channel(height: Image.Image, base: int, contrast: float, invert: bool = False) -> Image.Image:
    out = Image.new("L", height.size)
    src = height.load()
    dst = out.load()
    w, h = height.size
    for y in range(h):
        for x in range(w):
            v = src[x, y] / 255.0
            if invert:
                v = 1.0 - v
            dst[x, y] = max(0, min(255, int(base + (v - 0.5) * 255 * contrast)))
    return out.filter(ImageFilter.GaussianBlur(0.3))


def metalness_value(material: dict) -> int:
    family = material.get("family")
    mid = material["id"]
    if family == "metal":
        return 210 if "bronze" not in mid else 185
    if family == "hazard":
        return 80
    return 0


def derive(material_id: str, source_path: Path) -> None:
    manifest = json.loads(MANIFEST_PATH.read_text())
    material = next((m for m in manifest["materials"] if m["id"] == material_id), None)
    if not material:
        raise SystemExit(f"unknown material id: {material_id}")

    source = normalize_source(Image.open(source_path))
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    source_copy = SOURCE_DIR / f"{material_id}_openai_albedo_source.png"
    source.save(source_copy, "PNG", optimize=True)

    height = grayscale_height(source)
    normal = normal_from_height(height)
    roughness = grayscale_channel(height, 205 if material.get("family") != "metal" else 150, 0.24, invert=True)
    metalness = Image.new("L", source.size, metalness_value(material))
    ao = grayscale_channel(height, 188, 0.5, invert=False)
    emissive = Image.new("RGB", source.size, (0, 0, 0))
    if "emissive" in material.get("channels", {}):
        # Keep emissive sparse. The albedo remains the physical source.
        emissive = ImageOps.colorize(grayscale_channel(height, 0, 1.6, invert=False), black=(0, 0, 0), white=(180, 230, 210))

    outputs = {
        "albedo": source,
        "height": height,
        "normal": normal,
        "roughness": roughness,
        "metalness": metalness,
        "ao": ao,
        "emissive": emissive,
    }
    for channel, asset_path in material.get("channels", {}).items():
        if not asset_path.startswith("assets/textures/ib_pbr/"):
            continue
        out_path = ROOT / asset_path
        out_path.parent.mkdir(parents=True, exist_ok=True)
        outputs[channel].save(out_path, "PNG", optimize=True)

    material["status"] = "openai_generated"
    material["runtimeApproved"] = True
    material["sourceReferences"] = [str(source_copy.relative_to(ROOT))]
    material["generatedBy"] = "OpenAI image generation plus tools/derive_ib_pbr_from_albedo.py"
    material["generatedTextureSize"] = list(source.size)
    material.pop("rejectionReason", None)
    material["processing"] = "OpenAI-generated painterly albedo source copied into project assets; technical normal, roughness, metalness, height, ao, and emissive channels derived locally."
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"derived PBR channels for {material_id} from {source_path}")


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: derive_ib_pbr_from_albedo.py MATERIAL_ID SOURCE_PNG")
    derive(sys.argv[1], Path(sys.argv[2]).resolve())


if __name__ == "__main__":
    main()
