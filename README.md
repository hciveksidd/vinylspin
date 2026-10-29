# SpinningVinyl

Browser studio for music promo visuals: spinning vinyl and CD videos, audio visualizers,
Spotify Canvas loops, GIFs and glitch covers, plus an EPK builder and small producer utilities
(BPM → ms, tap tempo, Camelot keys, release checklist).

Everything runs client-side — no backend, no account. Audio is analysed with the Web Audio API,
frames are drawn on a `<canvas>`, and exports are produced in the browser.

## Exports

| Format | How it's made | Notes |
| --- | --- | --- |
| Video | `MediaRecorder` on the live canvas + track audio | Rewinds and plays the track while recording (real time). H.264 MP4 where supported, otherwise WebM. |
| Spotify Loop | Offscreen render driven by loop phase | Silent, 3–8 s, length snapped to whole disc turns so it loops seamlessly. |
| GIF | Offscreen render + [`gifenc`](https://github.com/mattdesl/gifenc) | 480 px, 20 fps, one shared palette, seamless loop. |
| PNG | `canvas.toBlob` | Current frame at full resolution. |

Canvas sizes: 1:1 1080×1080, 9:16 1080×1920, 16:9 1920×1080, 4:5 1080×1350.

## Development

Requires [Bun](https://bun.sh) (or npm).

```bash
bun install
```

```bash
bun run dev      # http://localhost:3000
```

```bash
bun run lint     # tsc --noEmit
```

```bash
bun run test     # vitest
```

```bash
bun run build
```

## Layout

- `src/components/` — UI (`VinylStudio` is the main editor, `ExportModal` drives exports)
- `src/utils/canvasRenderer.ts` — all scene drawing
- `src/utils/audioEngine.ts` — Web Audio playback, analyser and procedural demo tracks
- `src/utils/videoExporter.ts` — video, seamless loop and GIF export
- `src/utils/loopRenderer.ts` — deterministic frame rendering for loops
