# Nook TTS System

Infinite Brutality can now attach one spoken OpenAI TTS line to each Hanging Gardens nook packet.

All spoken lines should follow `docs/NOOK_NARRATOR_VIBE.md`: one sentence, compressed, dangerous, and memorable.

## Runtime Rule

- Story nooks are resolved into `storyNookPlacements` during district generation.
- When the player comes within trigger distance of an unheard placement, the game looks up that placement's `packetId` in `data/nook_tts_manifest.json`.
- If a clip exists, the game plays one shared narrator clip and marks that placement heard for the current level.
- The line is shown in the hint field while it plays.

## Data Files

- `data/nook_tts_manifest.json`: canonical spoken-line manifest and voice profile.
- `assets/audio/generated/nook_narrator/*.mp3`: generated clip outputs.
- `tools/generate_nook_tts.py`: OpenAI speech generator for missing clips.

## Generation

Dry run:

```sh
python3 tools/generate_nook_tts.py --dry-run
```

Generate missing clips:

```sh
python3 tools/generate_nook_tts.py
```

The generator reads `OPENAI_API_KEY` from the shell environment and uses the manifest's single narrator profile.
