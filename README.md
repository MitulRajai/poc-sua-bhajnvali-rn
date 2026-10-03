# Audio Playback + Recording POC (Capacitor → React Native)

Tests, in order:
1. Downloading an audio file from a URL you type in
2. Playback that survives screen-lock and backgrounding, with loop
3. Recording that works in the foreground and with the screen locked
   (phase 1)
4. A permission prompt for continuing to record in the background
   (phase 2 — the hook is wired here; the full native background-recording
   session is the next increment)

## Why this fixes the Capacitor issues
`react-native-track-player` runs playback via a **native background
service** (foreground service on Android, `AVAudioSession` with
`UIBackgroundModes: audio` on iOS) instead of a WebView `<audio>` tag,
which is what was dying on backgrounding under Capacitor. It also
implements Android's `MediaSessionCompat` pattern automatically, which is
the same mechanism VLC/Spotify rely on to be exempt from Doze/OEM battery
killing for *playback* — no extra permission needed there.

Recording doesn't get that same automatic exemption (there's no
"blessed" OS category for background mic use the way there is for
playback), which is why background recording needs the explicit
permission step below.

## Setup
Needs a **dev client build**, not plain Expo Go (native code from
track-player and the recorder library).

```bash
npm install
npx expo prebuild
npx expo run:android   # or: npx expo run:ios
```

**For exact step-by-step instructions** (Windows + Android Studio setup,
macOS + Xcode setup, emulator vs real device, and what you can/can't
validate on each), see **`BUILD_AND_TEST.md`**.

## What to test

### Playback
1. Paste a URL (or use the prefilled sample) and tap **Download**.
2. Tap **Play**, then **Loop: On** — confirm it auto-restarts on
   completion.
3. Lock the screen / background the app while playing — confirm audio
   and looping continue, and a lock-screen media control appears.

### Recording — phase 1
1. Tap **Start Recording**.
2. **Lock the screen** (don't background the app) — confirm the timer
   keeps advancing and recording doesn't stop. This should work with no
   extra permission, since locking the screen doesn't background the
   process.
3. Tap **Stop** — confirm the file is saved (path shown in the alert).

### Recording — phase 2 trigger (background)
1. Start recording, then **background the app** (home button / switch
   apps).
2. You should see the "Keep recording in the background?" prompt when
   you return to the app (or immediately, depending on OS timing).
3. Tapping **Allow** opens the Android battery-optimization exemption
   dialog directly. On Samsung/Xiaomi, also manually check:
   - Samsung: Settings → Battery → Background usage limits → make sure
     this app isn't in "Sleeping apps" / "Deep sleeping apps"
   - Xiaomi (MIUI): Settings → Apps → Manage apps → this app →
     **Autostart: On**, and Battery Saver → **No restrictions**
   - See dontkillmyapp.com for the full per-OEM list — worth having QA
     reference this when testing on real devices.
4. **Note**: the permission prompt here only opens the settings screens.
   The actual native foreground-service-based background recording isn't
   implemented yet in this POC — that's the next build step once phase 1
   is confirmed working on your test devices.

## Swapping in your real audio
Just paste a different URL into the input field and tap Download — no
code change needed anymore.

## Not in this POC yet (next phase)
- Native foreground service to keep recording alive once backgrounded
  (Android) / properly held `AVAudioSession` for background recording
  (iOS)
- Pushing the recording to a streaming server via **RTMP** ingest
  → transcoded to **HLS** for playback on the consumer side (confirmed
  as the target protocol pair)
- Video, once audio live-streaming is validated

## File map
- `App.tsx` — UI: URL input, download progress, playback controls,
  recording controls
- `src/services/AudioService.ts` — download-to-disk + track player logic
- `src/services/RecordingService.ts` — foreground/locked-screen
  recording + background-permission prompt hook
- `index.js` — registers the background playback service
- `app.json` — native background-audio + mic permissions (iOS + Android)
