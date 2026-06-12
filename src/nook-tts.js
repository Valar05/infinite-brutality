export function createNookTtsApi(deps) {
  const {
    state,
    roomState,
    player,
    hintEl,
    buildVersion,
    AudioCtor,
    constants,
  } = deps;
  const {
    NOOK_TTS_TRIGGER_DISTANCE,
    NOOK_TTS_VERTICAL_DISTANCE,
    NOOK_TTS_COOLDOWN,
    NOOK_TTS_HINT_TIME,
  } = constants;

function stopNookTtsPlayback() {
  const audio = state.audio;
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
  } catch (err) {
    console.warn(err);
  }
  state.audio = null;
  state.currentPlacementId = '';
  state.currentText = '';
}

function ensureNookTtsLevelState() {
  if (state.heardLevelIndex === roomState.levelIndex) return;
  state.heardLevelIndex = roomState.levelIndex;
  state.heardPlacementIds.clear();
  state.cooldown = 0;
  state.hintTimer = 0;
  stopNookTtsPlayback();
}

function loadNookTtsManifest() {
  if (state.manifestPromise) return state.manifestPromise;
  state.manifestPromise = fetch('./data/nook_tts_manifest.json?v=' + buildVersion)
    .then((response) => {
      if (!response.ok) throw new Error('failed to load nook tts manifest (' + response.status + ')');
      return response.json();
    })
    .then((manifest) => {
      state.manifest = manifest;
      state.byPacketId = new Map((manifest.clips || []).map((clip) => [clip.packet_id, clip]));
      return manifest;
    })
    .catch((err) => {
      console.warn(err);
      state.manifest = null;
      state.byPacketId = new Map();
      return null;
    });
  return state.manifestPromise;
}

function allStoryNookPlacements() {
  return roomState.districtPlan?.districts?.flatMap((district) => district.storyNookPlacements || []) || [];
}

function playNookTtsPlacement(placement, clip) {
  if (!clip?.file || !placement?.id) return;
  ensureNookTtsLevelState();
  stopNookTtsPlayback();
  const audio = new AudioCtor(clip.file + '?v=' + buildVersion);
  audio.preload = 'auto';
  audio.volume = 1.0;
  state.audio = audio;
  state.currentPlacementId = placement.id;
  state.heardPlacementIds.add(placement.id);
  state.cooldown = NOOK_TTS_COOLDOWN;
  state.hintTimer = NOOK_TTS_HINT_TIME;
  state.currentText = clip.text;
  hintEl.textContent = clip.text;
  hintEl.style.opacity = '1';
  const clearIfCurrent = () => {
    if (state.audio !== audio) return;
    state.audio = null;
    state.currentPlacementId = '';
  };
  audio.onended = clearIfCurrent;
  audio.onerror = () => {
    state.heardPlacementIds.delete(placement.id);
    clearIfCurrent();
  };
  audio.play().catch((err) => {
    console.warn(err);
    state.heardPlacementIds.delete(placement.id);
    clearIfCurrent();
  });
}

function updateNookTts(dt) {
  ensureNookTtsLevelState();
  if (state.cooldown > 0) state.cooldown = Math.max(0, state.cooldown - dt);
  if (state.hintTimer > 0) {
    state.hintTimer = Math.max(0, state.hintTimer - dt);
    if (state.hintTimer <= 0 && hintEl.textContent === state.currentText) hintEl.style.opacity = '0';
  }
  const activeAudio = state.audio;
  if (activeAudio && !activeAudio.paused && !activeAudio.ended) return;
  if (!state.byPacketId.size || state.cooldown > 0) return;
  const placements = allStoryNookPlacements();
  let bestPlacement = null;
  let bestDistSq = Infinity;
  for (const placement of placements) {
    if (!placement?.packetId || state.heardPlacementIds.has(placement.id)) continue;
    const clip = state.byPacketId.get(placement.packetId);
    if (!clip) continue;
    const [x, y, z] = placement.worldPos || [];
    const dy = Math.abs(player.position.y - y);
    if (dy > NOOK_TTS_VERTICAL_DISTANCE) continue;
    const dx = player.position.x - x;
    const dz = player.position.z - z;
    const distSq = dx * dx + dz * dz;
    if (distSq > NOOK_TTS_TRIGGER_DISTANCE * NOOK_TTS_TRIGGER_DISTANCE) continue;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestPlacement = placement;
    }
  }
  if (!bestPlacement) return;
  const clip = state.byPacketId.get(bestPlacement.packetId);
  if (!clip) return;
  playNookTtsPlacement(bestPlacement, clip);
}

  return {
    stopNookTtsPlayback,
    ensureNookTtsLevelState,
    loadNookTtsManifest,
    allStoryNookPlacements,
    playNookTtsPlacement,
    updateNookTts,
  };
}
