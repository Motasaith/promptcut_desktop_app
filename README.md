# PromptCut Studio (desktop)

The Stickman AI video studio and a screen recorder in one desktop app for Windows, macOS and
Linux. Free and open source under AGPL-3.0-or-later.

Built by Abdul Rauf Azhar, <https://github.com/Motasaith>. Source: <https://github.com/Motasaith/StickMan>.
If it helps you, a star on the repository is appreciated.

## What's inside

- **The full Stickman studio**: timeline editor, stick figures, slides, 3D, the AI video maker,
  batch mode, AI Director, voice studio (including local and cloned voices), captions, the
  YouTube pack, and every export format (MP4, GIF, MP3, cover image). Everything the web version does.
- **A screen recorder** (based on [OpenScreen](https://github.com/siddharthvaddem/openscreen)):
  record a screen or a window with microphone, system audio and webcam. Then edit the recording:
  change or restyle the cursor, add zoom in and zoom out regions (manual or auto-suggested from
  clicks), crop, blur, annotations, backgrounds, captions, and export to MP4 or GIF.
- **Recorder to studio in one click**: after exporting a recording, "Edit in Stickman Studio" opens
  it as a new studio project, ready for AI narration, captions, b-roll and the rest. "Record
  screen" and "Open a recording" sit at the top of the studio's projects page.

## Your files stay on your computer

- Projects, media, voices and settings are stored on this machine (`~/.stickman-studio`, the same
  folder the web version uses, so both see the same projects). Recordings are kept in the app's
  own data folder.
- Rendering, ffmpeg conversions, local voices and transcription all run on this machine.
- The studio's server listens on 127.0.0.1 only, never on your network.
- Nothing is sent anywhere except to the AI, voice and stock services you configure, with your own keys.

## Develop

Keep the StickMan folder next to this one (`../StickMan`), with its dependencies installed.

```
npm install
npm run dev              # opens the app; the studio runs from ../StickMan
```

Before building an installer, build the studio once: `cd ../StickMan && npm run build`.

```
npm run bundle:studio    # copies the studio and its production dependencies into studio-bundle/
npx tsc && npx vite build && npx electron-builder --win    # Windows installer in release/
```

`npm run build:win` also compiles OpenScreen's optional native Windows capture helper, which needs
CMake and Visual Studio's C++ tools. Without it the recorder uses Electron's built-in capture.

For automated checks, `PROMPTCUT_DEBUG_PORT=9444 npm run dev` opens DevTools on that local port and
`node scripts/cdp-eval.mjs 9444 <url part> <file.js>` runs a script inside a window.

## License

AGPL-3.0-or-later (see `LICENSE`, `NOTICE`, `ATTRIBUTION.md`). If you change and distribute this
app, or run it for others over a network, your version must stay under the same license and offer
its source. OpenScreen's MIT notice is in `THIRD_PARTY_NOTICES.md`. OpenScreen's original project
is archived; a community-maintained fork is at <https://github.com/EtienneLescot/openscreen>.
