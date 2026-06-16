import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('..', import.meta.url);
const main = fs.readFileSync(new URL('src/main.js', root), 'utf8');
const materials = fs.readFileSync(new URL('src/materials.js', root), 'utf8');
const styles = fs.readFileSync(new URL('src/styles.css', root), 'utf8');

assert.equal(fs.existsSync(new URL('tools/test_pbr_flat_lighting_contract.mjs', root)), false, 'delete the old lighting-rule contract');

assert.match(materials, /topReadabilityLift: 0\.34/, 'foreground terrain needs a restrained top-surface readability lift');
assert.match(materials, /topReadabilityColor: 0xe3d4b6/, 'terrain readability lift should use a warm stone value, not black');
assert.match(materials, /normalScale: 0\.12/, 'foreground rock normal intensity should be restrained enough not to crush broad shapes');
assert.match(materials, /islandRockDark: makeRockMat\(0xe3ddd1/, 'foreground island material must not start from a black albedo');

assert.match(materials, /const meshyRockMaps = loadPbrTextureSet\(\{[\s\S]*openai-meshy-rock-albedo-20260615-readable\.png[\s\S]*openai-meshy-rock-height-20260615-readable\.png/, 'island terrain must use the readable OpenAI Meshy-derived authored rock PBR set');
assert.match(materials, /material\.bumpMap = maps\.height \|\| null;/, 'the authored height map should be wired as a static texture input');
assert.doesNotMatch(materials, /const driftfieldRockMaps = loadPbrTextureSet/, 'island rock must not fall back to the neutral Driftfield rock set for this art pass');

assert.match(main, /const environmentPmrem = new THREE\.PMREMGenerator\(renderer\);/, 'scene needs image-based environment lighting, not just stage lights');
assert.match(main, /scene\.environment = environmentMap;[\s\S]*armsScene\.environment = environmentMap;/, 'Meshy-style detail visibility needs environment lighting in world and arms scenes');
assert.doesNotMatch(main, /HemisphereLight\(0x[0-9a-f]+,\s*0x020202/, 'hemisphere ground cannot be near-pure black when material detail must remain visible');
assert.match(main, /new THREE\.AmbientLight\(0x66513c, 0\.48\)/, 'world needs a visible warm ambient floor for readable non-key surfaces');
assert.match(main, /envMapIntensity: 0\.72[\s\S]*envMapIntensity: 1\.0/, 'Meshy player and orc PBR overlays should visibly respond to environment lighting without making player flesh rubbery');

assert.match(main, /const DEBUG_UI = new URLSearchParams\(window\.location\.search\)\.get\('debugui'\) === '1';/, 'debug text must be opt-in for composition');
assert.match(main, /if \(readoutEl\) readoutEl\.hidden = !DEBUG_UI;/, 'debug readout must be hidden in default play');
assert.match(main, /if \(DEBUG_UI\) readoutEl\.textContent =/, 'runtime readout updates must be gated by debugui');

assert.match(main, /FPSPLAYER_MESHY_VISUAL_OVERLAY[\s\S]*model: 'assets\/models\/fpsplayer_meshy\/FPSPlayer_rigged_20260615\.glb'/, 'player visible surface must use the downloaded rigged Meshy GLB');
assert.match(main, /FPSPLAYER_MESHY_VISUAL_OVERLAY[\s\S]*textureTransform: \{ offset: \[0\.025, 0\.475\], repeat: \[0\.85, 0\.65\] \}/, 'player rig UVs must be remapped to the flesh-painted region of the root atlas');
assert.match(main, /FPSPLAYER_MESHY_VISUAL_OVERLAY[\s\S]*normal: 'Meshy_AI__0615135730_texture_normal\.png'/, 'player asset normal map must remain part of presentation');
assert.match(main, /ORC_BERSERKER_PBR[\s\S]*Meshy_AI_Orc_Berserker_0609121503_texture_roughness\.png/, 'orc roughness map must remain part of presentation');
assert.match(main, /flatShading: Boolean\(options\.flatShading \?\? false\),/, 'Meshy PBR asset presentation should default to smooth normals so diffuse detail survives');

assert.match(styles, /#status \{ max-width: min\(420px, 38vw\); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; \}/, 'status text must not sprawl across the composition');
assert.match(styles, /#hint \{[\s\S]*width: min\(560px, 64vw\);[\s\S]*opacity: 0\.36;/, 'tutorial hint should be present but visually subordinate');
assert.match(styles, /#readout \{[\s\S]*max-width: 36vw;[\s\S]*background: rgba\(2,3,3,0\.42\);/, 'debug readout styling should be smaller when explicitly enabled');

console.log(JSON.stringify({ ok: true, contract: 'art-direction-readability' }));
