#!/usr/bin/env python3
"""Deterministically collapse raster source art into strict black/white ink plates."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def extract_lines(source: Image.Image, threshold: int) -> Image.Image:
    gray = ImageOps.autocontrast(source.convert("L"), cutoff=1)
    gray = gray.filter(ImageFilter.MedianFilter(3))
    tight = gray.filter(ImageFilter.GaussianBlur(1.5))
    broad = gray.filter(ImageFilter.GaussianBlur(5.0))
    edge = ImageOps.autocontrast(ImageChops.difference(tight, broad), cutoff=2)
    mask = edge.point(lambda value: 255 if value >= threshold else 0, mode="1").convert("L")
    mask = mask.filter(ImageFilter.MaxFilter(3))
    return ImageOps.invert(mask).point(lambda value: 255 if value >= 128 else 0, mode="1")


def stats(image: Image.Image) -> dict:
    histogram = image.convert("L").histogram()
    total = image.width * image.height
    white = histogram[255] / total
    dark = histogram[0] / total
    mid = sum(histogram[1:255]) / total
    tile = image.convert("L").resize((max(1, image.width // 8), max(1, image.height // 8)), Image.Resampling.BOX)
    tile_histogram = tile.histogram()
    solid_tile_ratio = sum(tile_histogram[:52]) / sum(tile_histogram)
    occupied = ImageOps.invert(image.convert("L")).getbbox()
    occupied_area = (occupied[2] - occupied[0]) * (occupied[3] - occupied[1]) if occupied else 1
    bbox_ink_fill = histogram[0] / occupied_area
    return {"white_ratio": white, "dark_ratio": dark, "mid_ratio": mid, "solid_tile_ratio": solid_tile_ratio, "bbox_ink_fill": bbox_ink_fill}


def make_contact_sheet(rows: list[dict], output: Path) -> None:
    columns, cell_w, cell_h = 4, 320, 230
    sheet = Image.new("L", (columns * cell_w, ((len(rows) + columns - 1) // columns) * cell_h), 255)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, row in enumerate(rows):
        image = Image.open(row["output"]).convert("L")
        image.thumbnail((cell_w - 16, cell_h - 34), Image.Resampling.LANCZOS)
        x = (index % columns) * cell_w + (cell_w - image.width) // 2
        y = (index // columns) * cell_h + 20
        sheet.paste(image, (x, y))
        draw.text(((index % columns) * cell_w + 6, (index // columns) * cell_h + 5), Path(row["output"]).stem[:42], fill=0, font=font)
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--receipt", required=True)
    parser.add_argument("--contact-sheet", required=True)
    parser.add_argument("--selected", required=True)
    parser.add_argument("--supplement", required=True)
    parser.add_argument("--threshold", type=int, default=48)
    args = parser.parse_args()
    if not 1 <= args.threshold <= 254:
        raise SystemExit("threshold must be in 1..254")

    source = Path(args.source)
    output = Path(args.out)
    output.mkdir(parents=True, exist_ok=True)
    selected = Path(args.selected)
    selected.mkdir(parents=True, exist_ok=True)
    for stale in selected.iterdir():
        if stale.is_file():
            stale.unlink()
    pngs = sorted(source.glob("*.png"))
    if len(pngs) != 20:
        raise SystemExit(f"REJECT: expected 20 source PNGs, found {len(pngs)}")

    rows = []
    failures = []
    for src in pngs:
        caption = src.with_suffix(".txt")
        if not caption.exists():
            failures.append(f"{src.name}:missing_caption")
            continue
        with Image.open(src) as image:
            lineart = extract_lines(image, args.threshold)
        dest = output / src.name
        tmp = dest.with_suffix(dest.suffix + ".tmp")
        lineart.save(tmp, format="PNG", optimize=True)
        tmp.replace(dest)
        clean_caption = "drw_fleshpunk, clean black ink lineart, no shading, white background, " + caption.read_text(encoding="utf-8").strip()
        cap_dest = output / caption.name
        cap_tmp = cap_dest.with_suffix(cap_dest.suffix + ".tmp")
        cap_tmp.write_text(clean_caption + "\n", encoding="utf-8")
        cap_tmp.replace(cap_dest)
        measured = stats(lineart)
        if measured["mid_ratio"] != 0:
            failures.append(f"{src.name}:non_binary_pixels")
        if measured["dark_ratio"] < 0.002:
            failures.append(f"{src.name}:no_readable_ink")
        quality_failures = []
        if measured["solid_tile_ratio"] > 0.21:
            quality_failures.append("dense_solid_ink")
        if measured["bbox_ink_fill"] > 0.35:
            quality_failures.append("fused_or_blob_silhouette")
        accepted = not quality_failures
        if accepted:
            shutil.copy2(dest, selected / dest.name)
            shutil.copy2(cap_dest, selected / cap_dest.name)
        rows.append({"source": str(src), "source_sha256": sha256(src), "output": str(dest), "output_sha256": sha256(dest), "caption": str(cap_dest), "selected": accepted, "quality_failures": quality_failures, **measured})

    supplement_rows = []
    for src in sorted(Path(args.supplement).glob("*_line_v*.png")):
        caption = src.with_suffix(".txt")
        if not caption.exists():
            failures.append(f"{src.name}:missing_supplement_caption")
            continue
        with Image.open(src) as image:
            lineart = image.convert("L").point(lambda value: 255 if value >= 220 else 0, mode="1")
        dest = selected / src.name
        tmp = dest.with_suffix(dest.suffix + ".tmp")
        lineart.save(tmp, format="PNG", optimize=True)
        tmp.replace(dest)
        cap_dest = selected / caption.name
        cap_tmp = cap_dest.with_suffix(cap_dest.suffix + ".tmp")
        cap_tmp.write_text(caption.read_text(encoding="utf-8"), encoding="utf-8")
        cap_tmp.replace(cap_dest)
        supplement_rows.append({"source": str(src), "source_sha256": sha256(src), "output": str(dest), "output_sha256": sha256(dest), "caption": str(cap_dest), **stats(lineart)})

    contact = Path(args.contact_sheet)
    make_contact_sheet(rows, contact)
    selected_contact = contact.with_name(contact.stem + "-selected" + contact.suffix)
    make_contact_sheet([row for row in rows if row["selected"]] + supplement_rows, selected_contact)
    pixel_rows = []
    for image_path in sorted(selected.glob("*.png")):
        with Image.open(image_path) as image:
            binary = image.convert("1")
            pixel_rows.append(f"{image_path.name}:{binary.size}:{hashlib.sha256(binary.tobytes()).hexdigest()}")
    selected_pixel_aggregate = hashlib.sha256(("\n".join(pixel_rows) + "\n").encode()).hexdigest()
    receipt = {
        "schema": "FLESHPUNK LINEART PREPROCESS RECEIPT 1",
        "algorithm": {"name": "difference-of-gaussians-binary-ink", "threshold": args.threshold, "tight_radius": 1.5, "broad_radius": 5.0, "stroke_expansion": 3, "solid_tile_max": 0.21, "bbox_ink_fill_max": 0.35},
        "source": str(source), "output": str(output), "selected": str(selected), "images": rows, "supplements": supplement_rows,
        "contact_sheet": {"path": str(contact), "sha256": sha256(contact)},
        "selected_contact_sheet": {"path": str(selected_contact), "sha256": sha256(selected_contact)},
        "selected_pixel_aggregate_sha256": selected_pixel_aggregate,
        "status": "PROCEED" if not failures and len(rows) == 20 and sum(row["selected"] for row in rows) >= 8 and len(supplement_rows) >= 1 else "REJECT",
        "selected_count": sum(row["selected"] for row in rows),
        "rejected_count": sum(not row["selected"] for row in rows),
        "supplement_count": len(supplement_rows),
        "hard_failures": failures, "visual_acceptance": False, "final_acceptance": "USER_ONLY",
    }
    receipt_path = Path(args.receipt)
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = receipt_path.with_suffix(receipt_path.suffix + ".tmp")
    tmp.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    tmp.replace(receipt_path)
    print(json.dumps({"status": receipt["status"], "images": len(rows), "selected": receipt["selected_count"], "rejected": receipt["rejected_count"], "supplements": receipt["supplement_count"], "failures": failures, "contact_sheet": str(contact)}, separators=(",", ":")))
    if receipt["status"] != "PROCEED":
        raise SystemExit(2)


if __name__ == "__main__":
    main()
