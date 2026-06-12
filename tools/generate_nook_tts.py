#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

OPENAI_SPEECH_URL = 'https://api.openai.com/v1/audio/speech'
ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / 'data' / 'nook_tts_manifest.json'


def load_manifest() -> dict:
    return json.loads(MANIFEST_PATH.read_text(encoding='utf-8'))


def save_manifest(manifest: dict) -> None:
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')


def request_clip(api_key: str, payload: dict, timeout: int) -> bytes:
    req = urllib.request.Request(
        OPENAI_SPEECH_URL,
        data=json.dumps(payload).encode('utf-8'),
        method='POST',
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode('utf-8', errors='replace')
        raise RuntimeError(f'OpenAI TTS request failed: HTTP {error.code}: {detail}') from error


def main() -> int:
    parser = argparse.ArgumentParser(description='Generate Infinite Brutality nook TTS clips from data/nook_tts_manifest.json')
    parser.add_argument('--force', action='store_true')
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--timeout', type=int, default=120)
    args = parser.parse_args()

    manifest = load_manifest()
    profile_map = {p['id']: p for p in manifest.get('speaker_profiles', []) if isinstance(p, dict) and p.get('id')}
    clips = [c for c in manifest.get('clips', []) if isinstance(c, dict) and c.get('speaker_id') in profile_map]
    pending = []
    for clip in clips:
        path = ROOT / clip['file']
        if args.force or not path.exists():
            pending.append((clip, path, profile_map[clip['speaker_id']]))
    if args.limit > 0:
        pending = pending[:args.limit]
    if args.dry_run:
        print(f'NOOK_TTS_DRY_RUN pending={len(pending)} total={len(clips)}')
        for clip, path, profile in pending[:40]:
            print(f"- {clip['packet_id']} voice={profile.get('voice')} file={path.relative_to(ROOT)} text={clip['text']}")
        return 0

    api_key = os.environ.get('OPENAI_API_KEY', '').strip()
    if not api_key:
        raise SystemExit('OPENAI_API_KEY is not set. Use --dry-run to inspect pending clips.')

    total = len(pending)
    for index, (clip, path, profile) in enumerate(pending, start=1):
        payload = {
            'model': str(profile.get('model', 'gpt-4o-mini-tts')),
            'voice': str(profile.get('voice', 'sage')),
            'input': str(clip.get('text', '')),
            'response_format': 'mp3',
            'speed': profile.get('speed', 0.94),
        }
        instructions = str(profile.get('instructions', '')).strip()
        if instructions:
            payload['instructions'] = instructions
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(request_clip(api_key, payload, args.timeout))
        print(f"NOOK_TTS_GENERATED {index}/{total} {clip['packet_id']} -> {path.relative_to(ROOT)}")

    save_manifest(manifest)
    print(f'NOOK_TTS_DONE generated={total} manifest={MANIFEST_PATH.relative_to(ROOT)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
