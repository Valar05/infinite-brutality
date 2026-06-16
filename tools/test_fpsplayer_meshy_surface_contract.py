#!/usr/bin/env python3
from __future__ import annotations

import colorsys
import json
import math
import re
import statistics
import struct
import unittest
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MAIN_JS = ROOT / 'src/main.js'

VISIBLE_ARM_NORMALS = {
    'front_forearm': (0.0, 0.25, 1.0),
    'top_knuckle': (0.0, 1.0, 0.15),
    'outer_side': (0.8, 0.25, 0.5),
    'oblique_facet': (-0.65, -0.18, 0.74),
    'deep_oblique_facet': (-0.8, -0.34, 0.48),
}


@dataclass(frozen=True)
class Light:
    kind: str
    color: tuple[float, float, float]
    intensity: float
    direction: tuple[float, float, float] | None = None
    ground_color: tuple[float, float, float] | None = None


@dataclass(frozen=True)
class Metrics:
    mean_rgb: tuple[float, float, float]
    saturation_mean: float
    luma_stddev: float
    red_blue_bias: float
    hot_red_ratio: float

    def as_json(self) -> dict:
        return {
            'mean_rgb': [round(value, 3) for value in self.mean_rgb],
            'saturation_mean': round(self.saturation_mean, 4),
            'luma_stddev': round(self.luma_stddev, 4),
            'red_blue_bias': round(self.red_blue_bias, 4),
            'hot_red_ratio': round(self.hot_red_ratio, 4),
        }


def hex_to_rgb01(value: str | int) -> tuple[float, float, float]:
    number = int(value, 16) if isinstance(value, str) else int(value)
    return tuple(((number >> shift) & 255) / 255 for shift in (16, 8, 0))


def parse_hex(value: str) -> int:
    return int(value, 16)


def normalize(vector: tuple[float, float, float]) -> tuple[float, float, float]:
    length = math.sqrt(sum(component * component for component in vector)) or 1.0
    return tuple(component / length for component in vector)


def dot(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    return sum(left * right for left, right in zip(a, b))


def luma_rgb01(color: tuple[float, float, float]) -> float:
    return color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722


def section_between(source: str, start: str, end: str) -> str:
    start_index = source.index(start)
    end_index = source.index(end, start_index)
    return source[start_index:end_index]


def parse_arms_lights(source: str) -> list[Light]:
    section = section_between(source, 'const armsScene = new THREE.Scene();', 'const clock = new THREE.Clock();')
    lights: list[Light] = []

    for match in re.finditer(r'HemisphereLight\((0x[0-9a-f]+),\s*(0x[0-9a-f]+),\s*([0-9.]+)\)', section, re.I):
        lights.append(
            Light(
                kind='hemisphere',
                color=hex_to_rgb01(match.group(1)),
                ground_color=hex_to_rgb01(match.group(2)),
                intensity=float(match.group(3)),
            )
        )

    for match in re.finditer(r'AmbientLight\((0x[0-9a-f]+),\s*([0-9.]+)\)', section, re.I):
        lights.append(Light(kind='ambient', color=hex_to_rgb01(match.group(1)), intensity=float(match.group(2))))

    for match in re.finditer(
        r'const\s+(\w+)\s*=\s*new THREE\.DirectionalLight\((0x[0-9a-f]+),\s*([0-9.]+)\);[\s\S]*?\1\.position\.set\(([-0-9.]+),\s*([-0-9.]+),\s*([-0-9.]+)\)',
        section,
        re.I,
    ):
        lights.append(
            Light(
                kind='directional',
                color=hex_to_rgb01(match.group(2)),
                intensity=float(match.group(3)),
                direction=normalize((float(match.group(4)), float(match.group(5)), float(match.group(6)))),
            )
        )

    return lights


def parse_overlay(source: str) -> tuple[dict[str, str], dict[str, float | int]]:
    section = section_between(source, 'const FPSPLAYER_MESHY_VISUAL_OVERLAY = {', '};\nconst world')
    textures = dict(re.findall(r"(baseColor|normal|roughness|metallic|emission): '([^']+)'", section))
    options_match = re.search(r'materialOptions:\s*\{([^}]+)\}', section)
    if not options_match:
        raise AssertionError('missing FPSPLAYER_MESHY_VISUAL_OVERLAY.materialOptions')
    options: dict[str, float | int] = {}
    for key, value in re.findall(r'(color|roughness|metalness|normalScale|emissive|emissiveIntensity|envMapIntensity):\s*(0x[0-9a-f]+|[0-9.]+)', options_match.group(1), re.I):
        options[key] = parse_hex(value) if value.startswith('0x') else float(value)
    return textures, options



def parse_overlay_config(source: str) -> dict:
    section = section_between(source, 'const FPSPLAYER_MESHY_VISUAL_OVERLAY = {', '};\nconst world')
    model_match = re.search(r"model:\s*'([^']+)'", section)
    required_match = re.search(r"requiredTextures:\s*\[([^\]]+)\]", section)
    hide_match = re.search(r"hideBaseNodes:\s*\[([^\]]+)\]", section)
    require_rebind_match = re.search(r"requireRebind:\s*(true|false)", section)
    transform_match = re.search(r"textureTransform:\s*\{\s*offset:\s*\[([^\]]+)\],\s*repeat:\s*\[([^\]]+)\]\s*\}", section)
    texture_transform = None
    if transform_match:
        texture_transform = {
            'offset': [float(value.strip()) for value in transform_match.group(1).split(',')],
            'repeat': [float(value.strip()) for value in transform_match.group(2).split(',')],
        }
    return {
        'section': section,
        'model': model_match.group(1) if model_match else '',
        'requiredTextures': re.findall(r"'([^']+)'", required_match.group(1)) if required_match else [],
        'hideBaseNodes': re.findall(r"'([^']+)'", hide_match.group(1)) if hide_match else [],
        'requireRebind': None if not require_rebind_match else require_rebind_match.group(1) == 'true',
        'textureTransform': texture_transform,
    }


def read_glb_chunks(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    if data[:4] != b'glTF':
        raise AssertionError(f'{path} is not a GLB file')
    offset = 12
    gltf = None
    binary = b''
    while offset + 8 <= len(data):
        chunk_length, chunk_type = struct.unpack_from('<II', data, offset)
        offset += 8
        chunk = data[offset:offset + chunk_length]
        offset += chunk_length
        if chunk_type == 0x4E4F534A:
            gltf = json.loads(chunk.decode('utf-8').rstrip(' \x00'))
        elif chunk_type == 0x004E4942:
            binary = chunk
    if gltf is None:
        raise AssertionError(f'{path} has no JSON chunk')
    return gltf, binary


def parse_glb_json(path: Path) -> dict:
    return read_glb_chunks(path)[0]


def read_glb_accessor(gltf: dict, binary: bytes, accessor_index: int) -> list[tuple[float, ...]]:
    component_format = {5126: 'f', 5125: 'I', 5123: 'H', 5122: 'h', 5121: 'B', 5120: 'b'}
    component_size = {5126: 4, 5125: 4, 5123: 2, 5122: 2, 5121: 1, 5120: 1}
    type_count = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
    accessor = gltf['accessors'][accessor_index]
    view = gltf['bufferViews'][accessor['bufferView']]
    components = type_count[accessor['type']]
    component_type = accessor['componentType']
    fmt = '<' + component_format[component_type] * components
    stride = view.get('byteStride', component_size[component_type] * components)
    start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    return [struct.unpack_from(fmt, binary, start + index * stride) for index in range(accessor['count'])]


def image_pixels(path: Path, max_samples: int = 160_000) -> list[tuple[int, int, int]]:
    image = Image.open(path).convert('RGB')
    if hasattr(image, 'get_flattened_data'):
        pixels = list(image.get_flattened_data())
    else:
        pixels = list(image.getdata())
    step = max(1, len(pixels) // max_samples)
    kept: list[tuple[int, int, int]] = []
    for r, g, b in pixels[::step]:
        luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
        if 8 < luma < 248:
            kept.append((r, g, b))
    return kept


def light_color_for_normal(lights: list[Light], normal: tuple[float, float, float]) -> tuple[float, float, float]:
    normal = normalize(normal)
    total = [0.0, 0.0, 0.0]
    for light in lights:
        if light.kind == 'hemisphere':
            t = max(0.0, min(1.0, normal[1] * 0.5 + 0.5))
            assert light.ground_color is not None
            color = tuple((1 - t) * light.ground_color[i] + t * light.color[i] for i in range(3))
            amount = light.intensity
        elif light.kind == 'ambient':
            color = light.color
            amount = light.intensity
        elif light.kind == 'directional':
            assert light.direction is not None
            color = light.color
            amount = max(0.0, dot(normal, light.direction)) * light.intensity
        else:
            raise AssertionError(f'unknown light kind {light.kind}')
        for i in range(3):
            total[i] += color[i] * amount
    return tuple(total)


def material_metrics(pixels: list[tuple[float, float, float]]) -> Metrics:
    if not pixels:
        raise AssertionError('no pixels to analyze')
    mean_rgb = tuple(statistics.mean(pixel[index] for pixel in pixels) for index in range(3))
    hsv = [colorsys.rgb_to_hsv(r / 255, g / 255, b / 255) for r, g, b in pixels]
    lumas = [0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in pixels]
    hot_red = sum(1 for r, g, b in pixels if r > g + 18 and r > b + 28 and r > 95) / len(pixels)
    return Metrics(
        mean_rgb=mean_rgb,
        saturation_mean=statistics.mean(item[1] for item in hsv),
        luma_stddev=statistics.pstdev(lumas),
        red_blue_bias=statistics.mean(r - b for r, _g, b in pixels),
        hot_red_ratio=hot_red,
    )


def apply_cpu_lighting(
    albedo_pixels: list[tuple[int, int, int]],
    light_color: tuple[float, float, float],
    options: dict[str, float | int],
) -> list[tuple[float, float, float]]:
    emissive = hex_to_rgb01(int(options.get('emissive', 0)))
    emissive_intensity = float(options.get('emissiveIntensity', 0))
    env_map_intensity = float(options.get('envMapIntensity', 0))
    # PMREM/environment response is approximated as neutral image-based material fill.
    # This keeps the test focused on pre-render surface color drift, not GPU shading details.
    environment_fill = 0.18 * env_map_intensity
    lit = []
    for r, g, b in albedo_pixels:
        channels = (r / 255, g / 255, b / 255)
        out = []
        for index, value in enumerate(channels):
            shaded = value * (light_color[index] + environment_fill) + emissive[index] * emissive_intensity
            out.append(min(255.0, shaded * 255.0))
        lit.append(tuple(out))
    return lit


class FPSPlayerMeshySurfaceContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.source = MAIN_JS.read_text()
        cls.textures, cls.options = parse_overlay(cls.source)
        cls.overlay_config = parse_overlay_config(cls.source)
        cls.lights = parse_arms_lights(cls.source)
        cls.base_color_path = ROOT / cls.textures['baseColor']
        cls.albedo_pixels = image_pixels(cls.base_color_path)
        cls.source_metrics = material_metrics(cls.albedo_pixels)

    def test_overlay_uses_the_meshy_texture_set_and_material_options(self) -> None:
        expected = {'baseColor', 'normal', 'roughness', 'metallic', 'emission'}
        self.assertEqual(expected, set(self.textures), 'FPSPlayer overlay must keep the full Meshy PBR texture set wired')
        for key, relative_path in self.textures.items():
            self.assertTrue((ROOT / relative_path).exists(), f'missing {key} texture: {relative_path}')

        self.assertEqual(0xFFFFFF, self.options.get('color'), 'overlay color should not tint the Meshy albedo')
        self.assertEqual('assets/models/fpsplayer_meshy/FPSPlayer_rigged_20260615.glb', self.overlay_config['model'], 'visible FPSPlayer arms must use the downloaded rigged Meshy GLB, not the old white GLB or static FBX overlay')
        self.assertEqual(['baseColor', 'normal', 'roughness'], self.overlay_config['requiredTextures'], 'base color, normal, and roughness maps must be required, not optional silent-null maps')
        self.assertEqual('Meshy_AI__0615135730_texture (1).png', self.textures['baseColor'], 'runtime must use the user-provided project-root albedo file')
        self.assertEqual('Meshy_AI__0615135730_texture_normal.png', self.textures['normal'], 'runtime must use the user-provided project-root normal file')
        self.assertEqual('Meshy_AI__0615135730_texture_roughness (1).png', self.textures['roughness'], 'runtime must use the user-provided project-root roughness file')
        self.assertEqual({'offset': [0.025, 0.475], 'repeat': [0.85, 0.65]}, self.overlay_config['textureTransform'], 'rig UVs must be remapped to the flesh-painted region of the atlas')
        self.assertLessEqual(float(self.options.get('metalness', 1)), 0.04, 'FPSPlayer skin/cloth should not be made broadly metallic')
        self.assertGreaterEqual(float(self.options.get('roughness', 0)), 0.7, 'Meshy FPSPlayer material should stay rough, not glossy')
        self.assertGreaterEqual(float(self.options.get('normalScale', 0)), 0.25, 'normal map needs enough strength to read in first person')
        self.assertLessEqual(float(self.options.get('envMapIntensity', 0)), 0.8, 'player flesh should not read as glossy rubber from excessive environment response')
        self.assertEqual(float(self.options.get('emissiveIntensity', 1)), 0.0, 'player flesh should not use an emissive clay floor')
        self.assertRegex(self.source, r'flatShading:\s*Boolean\(options\.flatShading \?\? false\)', 'Meshy FPSPlayer overlay must default to smooth normals so flat facets do not stomp diffuse detail')
        overlay_section = section_between(self.source, 'const FPSPLAYER_MESHY_VISUAL_OVERLAY = {', '};\nconst world')
        self.assertNotRegex(overlay_section, r'flatShading:\s*true', 'FPSPlayer Meshy overlay must not opt back into flat shading')

        self.assertRegex(self.source, r'required visual overlay texture missing', 'required texture load failures must not silently produce clay fallback materials')

        load_arms_section = section_between(self.source, 'function loadArms()', 'function updateArms')
        self.assertIn('loader.load(FPSPLAYER_MESHY_VISUAL_OVERLAY.model', load_arms_section, 'loadArms must load the downloaded rigged Meshy GLB through the GLTF loader')
        self.assertNotIn("loader.load('assets/models/FPSPlayer.glb'", load_arms_section, 'loadArms must not return to the old textureless white GLB')
        self.assertNotIn('loadFbxScene(FPSPLAYER_MESHY_VISUAL_OVERLAY.model)', load_arms_section, 'loadArms must not use the static Meshy FBX overlay for the FPS player rig')
        self.assertIn('applyVisualOverlayMaterials(armsModel, overlayTextures', load_arms_section, 'external Meshy maps must be applied to the skinned GLB itself')
        self.assertRegex(
            load_arms_section,
            r'let\s+meshyOverlayReady\s*=\s*false',
            'loadArms must track whether the required Meshy overlay actually attached',
        )
        self.assertRegex(
            load_arms_section,
            r'meshyOverlayReady\s*=\s*true',
            'loadArms must set readiness only after the Meshy overlay attaches/rebinds',
        )
        self.assertRegex(
            load_arms_section,
            r'if\s*\(!meshyOverlayReady\)\s*return;',
            'loadArms must not add or report the old untextured GLB arms when the required Meshy overlay fails',
        )
        self.assertNotRegex(
            load_arms_section,
            r'catch \(err\) \{[\s\S]*?\}\s*armsScene\.add\(armsModel\)',
            'required Meshy overlay failures must not fall through to armsScene.add(armsModel)',
        )
        self.assertLess(
            load_arms_section.index('if (!meshyOverlayReady) return;'),
            load_arms_section.index('armsScene.add(armsModel)'),
            'the success scene add must be after the Meshy overlay readiness gate',
        )

    def test_downloaded_rigged_glb_is_the_visible_surface_target(self) -> None:
        glb = parse_glb_json(ROOT / self.overlay_config['model'])
        self.assertEqual(2, len(glb.get('meshes', [])), 'downloaded FPSPlayer 3 GLB should expose the two rigged body mesh primitives')
        self.assertEqual(2, len(glb.get('skins', [])), 'downloaded FPSPlayer 3 GLB should be the rigged mesh, not a static overlay')
        self.assertGreaterEqual(len(glb.get('animations', [])), 30, 'downloaded rig must keep the fist/weapon animation set')
        self.assertFalse(glb.get('images'), 'downloaded rig carries no embedded images; external Meshy maps must provide the PBR surface')
        self.assertFalse(glb.get('textures'), 'downloaded rig carries no embedded textures; runtime must apply external albedo/normal/roughness')
        node_names = {node.get('name') for node in glb.get('nodes', [])}
        for expected in ['Camera', 'Root', 'UpperLeg', 'LowerLeg', 'Foot', 'Toe', 'Arms', 'Arms.001']:
            self.assertIn(expected, node_names, f'downloaded rig missing expected node {expected}')
        required_attrs = {'POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0'}
        for mesh in glb.get('meshes', []):
            for primitive in mesh.get('primitives', []):
                self.assertTrue(required_attrs.issubset(set(primitive.get('attributes', {}))), f'rig mesh {mesh.get("name")} lacks skinned textured attributes')

    def test_legacy_white_glb_is_not_the_runtime_load_target(self) -> None:
        legacy = parse_glb_json(ROOT / 'assets/models/FPSPlayer.glb')
        self.assertFalse(legacy.get('images'), 'legacy FPSPlayer.glb has no image payload')
        self.assertFalse(legacy.get('textures'), 'legacy FPSPlayer.glb has no texture payload')
        load_arms_section = section_between(self.source, 'function loadArms()', 'function updateArms')
        self.assertNotIn('assets/models/FPSPlayer.glb', load_arms_section, 'the old untextured GLB must not be loaded for visible FPS arms')

    def test_rig_uvs_sample_flesh_painted_root_albedo_after_transform(self) -> None:
        gltf, binary = read_glb_chunks(ROOT / self.overlay_config['model'])
        transform = self.overlay_config['textureTransform']
        self.assertIsNotNone(transform, 'FPSPlayer atlas needs an explicit UV transform into the flesh-painted region')
        image = Image.open(self.base_color_path).convert('RGB')
        width, height = image.size
        colors = []
        for mesh in gltf.get('meshes', []):
            for primitive in mesh.get('primitives', []):
                accessor = primitive.get('attributes', {}).get('TEXCOORD_0')
                if accessor is None:
                    continue
                for u, v in read_glb_accessor(gltf, binary, accessor):
                    uu = (u * transform['repeat'][0] + transform['offset'][0]) % 1.0
                    vv = (v * transform['repeat'][1] + transform['offset'][1]) % 1.0
                    colors.append(image.getpixel((int(uu * (width - 1)), int((1 - vv) * (height - 1)))))
        self.assertGreater(len(colors), 1000, 'expected enough transformed rig UV samples to judge visible arm material')
        lumas = [0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in colors]
        skin_like = [
            (r, g, b) for r, g, b in colors
            if r > g > b and 70 < (0.2126 * r + 0.7152 * g + 0.0722 * b) < 215 and (r - b) > 18
        ]
        near_black = [value for value in lumas if value < 45]
        mean_rgb = tuple(statistics.mean(color[index] for color in colors) for index in range(3))
        self.assertGreaterEqual(statistics.mean(lumas), 118.0, f'transformed root albedo is still too dim/rubber-like: mean_rgb={mean_rgb}')
        self.assertLessEqual(len(near_black) / len(lumas), 0.08, 'transformed root albedo must not sample the dark clothing strip for most arm pixels')
        self.assertGreaterEqual(len(skin_like) / len(colors), 0.78, f'transformed root albedo must read as painted flesh, got mean_rgb={mean_rgb}')

    def test_meshy_overlay_geometry_normals_are_smoothed_before_material_assignment(self) -> None:
        apply_section = section_between(self.source, 'function applyVisualOverlayMaterials', 'function rebindVisualOverlayToRig')
        geometry_prepare_fn = re.search(r'function\s+(?:smooth|soften|prepare)\w*Overlay\w*Geometry\s*\(', self.source)
        self.assertIsNotNone(
            geometry_prepare_fn,
            'Meshy overlay needs an explicit geometry-normal preparation step; material flatShading=false is not enough for a faceted GLB',
        )
        geometry_prepare_call = re.search(r'(?:smooth|soften|prepare)\w*Overlay\w*Geometry\(node\)', apply_section)
        self.assertIsNotNone(
            geometry_prepare_call,
            'applyVisualOverlayMaterials must smooth/prepare each Meshy overlay mesh before assigning the PBR material',
        )
        recompute_normals = re.search(r'computeVertexNormals\(\)', apply_section)
        self.assertIsNotNone(
            recompute_normals,
            'Meshy overlay geometry must recompute vertex normals so diffuse texture survives across broad facets',
        )
        load_arms_section = section_between(self.source, 'function loadArms()', 'function updateArms')
        self.assertNotRegex(
            load_arms_section,
            r'mat\.flatShading\s*=\s*true',
            'FPSPlayer arms must not set source materials to flatShading=true before applying the Meshy overlay',
        )


    def test_first_person_light_rig_preserves_meshy_surface_color_after_lighting(self) -> None:
        self.assertGreaterEqual(len(self.lights), 4, 'arms light rig should expose hemisphere, ambient, key, and fill lights')
        per_normal = {}
        for name, normal in VISIBLE_ARM_NORMALS.items():
            light_color = light_color_for_normal(self.lights, normal)
            light_red_blue_ratio = light_color[0] / max(0.001, light_color[2])
            lit_metrics = material_metrics(apply_cpu_lighting(self.albedo_pixels, light_color, self.options))
            per_normal[name] = {
                'light_color': [round(value, 4) for value in light_color],
                'light_red_blue_ratio': round(light_red_blue_ratio, 4),
                'lit_metrics': lit_metrics.as_json(),
            }

            self.assertLessEqual(
                light_red_blue_ratio,
                1.16,
                f'{name} lighting is too warm before rendering: {json.dumps(per_normal[name], sort_keys=True)}',
            )
            self.assertLessEqual(
                lit_metrics.red_blue_bias,
                self.source_metrics.red_blue_bias + 18.0,
                f'{name} lit Meshy atlas drifts too red before rendering: {json.dumps(per_normal[name], sort_keys=True)}',
            )
            self.assertGreaterEqual(
                lit_metrics.luma_stddev,
                self.source_metrics.luma_stddev * 0.48,
                f'{name} lit Meshy atlas loses too much material value breakup: {json.dumps(per_normal[name], sort_keys=True)}',
            )
            self.assertLessEqual(
                lit_metrics.hot_red_ratio,
                max(0.34, self.source_metrics.hot_red_ratio + 0.08),
                f'{name} lit Meshy atlas gains hot red/orange contamination: {json.dumps(per_normal[name], sort_keys=True)}',
            )
            mean_luma = sum(lit_metrics.mean_rgb) / 3
            self.assertGreaterEqual(
                mean_luma,
                82.0,
                f'{name} lit Meshy atlas is under-luminous before rendering; Meshy diffuse should remain visible on side/oblique facets: {json.dumps(per_normal[name], sort_keys=True)}',
            )
            self.assertLessEqual(
                mean_luma,
                228.0,
                f'{name} lit Meshy atlas is over-lit before rendering; albedo, roughness, and normals will wash out into clay: {json.dumps(per_normal[name], sort_keys=True)}',
            )

        print(json.dumps({
            'ok': True,
            'contract': 'fpsplayer-meshy-surface-before-render',
            'source_metrics': self.source_metrics.as_json(),
            'surfaces': per_normal,
        }, sort_keys=True))


if __name__ == '__main__':
    unittest.main(verbosity=2)
