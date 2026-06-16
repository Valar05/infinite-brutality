#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageStat
import json

ROOT = Path(__file__).resolve().parents[1]
ASSETS = {
    'albedo': ROOT / 'assets/textures/openai-meshy-rock-albedo-20260615-readable.png',
    'height': ROOT / 'assets/textures/openai-meshy-rock-height-20260615-readable.png',
    'normal': ROOT / 'assets/textures/openai-meshy-rock-normal-20260615-readable.png',
    'roughness': ROOT / 'assets/textures/openai-meshy-rock-roughness-20260615-readable.png',
    'metalness': ROOT / 'assets/textures/openai-meshy-rock-metalness-20260615-readable.png',
    'source': ROOT / 'assets/source/generated_textures/openai-meshy-rock-source-20260615.png',
}

def stats(path):
    image = Image.open(path)
    rgb = image.convert('RGB')
    stat = ImageStat.Stat(rgb)
    return image, stat.mean, stat.stddev

for name, path in ASSETS.items():
    assert path.exists(), f'missing {name} texture: {path}'

albedo, mean, std = stats(ASSETS['albedo'])
assert albedo.size == (1024, 1024), f'albedo must be power-of-two 1024 square, got {albedo.size}'
assert mean[0] > mean[2] + 10 and mean[1] > mean[2] + 4, f'albedo should inherit warm Meshy brown/olive bias, got mean {mean}'
assert 68 <= mean[0] <= 92 and 58 <= mean[1] <= 84 and 50 <= mean[2] <= 76, f'albedo should have a Meshy-style readable midtone floor, got mean {mean}'
assert max(std) > 11, f'albedo needs readable material variation without crushed grime, got std {std}'

height, hmean, hstd = stats(ASSETS['height'])
assert height.size == (1024, 1024), f'height must align to albedo, got {height.size}'
assert hstd[0] > 32, f'height map needs useful contrast for normals/bump, got std {hstd[0]}'

normal, nmean, nstd = stats(ASSETS['normal'])
assert normal.size == (1024, 1024), f'normal must align to albedo, got {normal.size}'
assert 118 <= nmean[0] <= 136 and 118 <= nmean[1] <= 136 and nmean[2] >= 220, f'normal map should be tangent-space biased, got mean {nmean}'
assert nstd[0] > 8 and nstd[1] > 8, f'normal map should encode surface relief, got std {nstd}'

rough, rmean, rstd = stats(ASSETS['roughness'])
assert rough.size == (1024, 1024), f'roughness must align to albedo, got {rough.size}'
assert 180 <= rmean[0] <= 232, f'rock roughness should be high but not flat, got mean {rmean[0]}'
assert rstd[0] > 5, f'roughness needs subtle material breakup without oily noise, got std {rstd[0]}'

metal, mmean, _ = stats(ASSETS['metalness'])
assert metal.size == (1024, 1024), f'metalness must align to albedo, got {metal.size}'
assert mmean[0] <= 6, f'rock metalness should be nearly black, got mean {mmean[0]}'

materials = (ROOT / 'src/materials.js').read_text()
assert 'openai-meshy-rock-albedo-20260615-readable.png' in materials, 'material loader must use readable OpenAI Meshy-derived albedo'
assert 'openai-meshy-rock-height-20260615-readable.png' in materials, 'material loader must use readable authored height map'
assert 'material.bumpMap = maps.height || null;' in materials, 'height map must be wired as static bump texture'
assert 'const driftfieldRockMaps = loadPbrTextureSet' not in materials, 'island terrain should not use the old neutral Driftfield rock map block'

manifest = json.loads((ROOT / 'assets/asset_manifest.json').read_text())
paths = {entry.get('path') for entry in manifest.get('assets', [])}
for rel in [str(path.relative_to(ROOT)) for path in ASSETS.values()]:
    assert rel in paths, f'manifest missing generated texture provenance for {rel}'

print({'ok': True, 'contract': 'meshy-rock-texture-assets', 'albedo_mean': [round(v, 2) for v in mean], 'normal_mean': [round(v, 2) for v in nmean]})
