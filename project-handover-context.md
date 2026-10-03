# Project Handover Context: Capacitor → React Native Migration (Sua Bhajnavali App)

## Background / original app
- Existing production app: **Angular hybrid app built with Capacitor**
  (package: `com.mgrtechsolutions.suabhajnavali`), Android + iOS.
- Supports **4 languages**; non-English content is transliterated (kept
  phonetically in the Latin/English script rather than translated).
- Each "version"/bhajan has an associated **audio file**, downloaded on
  app start and played back via Capacitor + a native audio plugin.
- Real project is at: `C:\Users\rajai\source\sua-bhajnavali-app-rn` on
  the user's Windows machine. (A POC folder, `audio-poc`, was built and
  tested standalone — not yet merged into or started inside the real
  app. See "Pending before real migration starts" below.)

## Problem driving the migration
Under Capacitor, audio playback runs through a WebView `<audio>` tag.
This breaks in two ways:
1. **Playback does not survive the app being backgrounded/closed** —
   once a track finishes while the app is backgrounded, it can't
   restart.
2. **Looping a track reliably** (replay automatically on completion)
   is unreliable for the same underlying reason.

## Requirements (confirmed so far)
1. **Loop playback** — user can toggle a loop option on a single
   bhajan's audio; it should auto-replay on completion.
   **Status: validated in POC.**
2. **Live audio recording** (video planned for a later phase, not now).
   **Status: Phase 1 (foreground + locked-screen) validated in POC.**
3. **Live streaming**: record audio and **push it live** so other
   consumers (listeners) can play it in real time, not just a
   recorded/stored file. **Status: protocol decided (RTMP → HLS), not
   implemented.**
4. Must support **both iOS and Android from a single codebase** →
   React Native (Expo) chosen.
5. **NEW — continuous "playlist" playback of downloaded bhajans**:
   if, say, 5 of 10 bhajans are downloaded, the user should be able to
   play through all 5 **continuously, automatically, with no further
   user action** between tracks (not just looping one track).
   **Status: not implemented. Likely does not need a separate POC** —
   `react-native-track-player` (already chosen for the single-track
   playback/loop POC) natively supports queueing multiple tracks and
   auto-advancing through them (`TrackPlayer.add([...tracks])` +
   `RepeatMode.Off` or `RepeatMode.Queue`), which is the same
   mechanism already proven to survive backgrounding/locking in Phase
   1. Worth a quick manual smoke-test with 2-3 local files when
   building the real feature, but doesn't appear to need an isolated
   throwaway POC the way background recording did.
6. **NEW — stream/play audio directly from a URL without downloading
   first**, as a second option alongside "download then play": user
   should be able to choose either "Download & Play" or "Play Online
   (stream)" for a given bhajan.
   **Status: not implemented. Likely does not need a separate POC** —
   `react-native-track-player` already accepts a remote URL directly as
   a track's `url` field and streams it, with no requirement that the
   file be downloaded to disk first. This means local-file playback and
   remote-stream playback are both already supported by the same
   player setup validated in the POC — the only new work is a UI
   choice (download vs. stream) and passing a remote vs. local URI into
   the existing `loadTrack`-style function.
7. **NEW — push notifications**: mentioned as a future possibility,
   but **no concrete requirement yet**. Explicitly **lowest priority**
   at this stage — noted here only so it isn't forgotten, not something
   to start designing for yet.

## Key technical decisions made
- **Playback**: `react-native-track-player`, not `expo-av`. Runs via a
  real native background service / `AVAudioSession`, not a WebView tag
  — fixes the Capacitor playback problem directly. Auto-implements
  Android's `MediaSessionCompat` pattern, the same mechanism VLC/
  Spotify rely on for automatic Doze/OEM-battery-kill exemption during
  playback — confirmed no extra permission needed for playback
  background survival.
- **Looping**: `TrackPlayer.setRepeatMode(RepeatMode.Track)` for a
  single track. (For the new continuous-playlist requirement above,
  the same API family extends naturally — multiple queued tracks
  instead of one.)
- **Recording**: `react-native-audio-recorder-player`, file-based, for
  the current phase. Will **not** be sufficient once true live RTMP
  push streaming is built — that needs a native RTMP publisher (e.g.
  HaishinKit on iOS, `rtmp-rtsp-stream-client-java` on Android, or a
  wrapper like `react-native-nodemediaclient`).
- **Live streaming protocol**: confirmed — **RTMP push from the client
  → media server transcodes to HLS for playback** on the consumer
  side. Not yet implemented — only decided as the target.
- **Background recording/streaming is structurally harder than
  background playback**: no "blessed" OS exemption category for
  background mic use (unlike playback's `MediaSessionCompat`
  exemption). Samsung ("Sleeping apps"/"Deep sleeping apps") and
  Xiaomi/MIUI (Autostart, Battery Saver) restrictions have **no
  standard API** — only `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` is a
  real Android intent; OEM-specific toggles must be set manually by
  the user via Settings. dontkillmyapp.com is the reference for
  per-OEM specifics.

## Phased recording approach
- **Phase 1 - CONFIRMED WORKING**: recording in the foreground,
  including with the screen locked (locking the screen doesn't
  background the process, so no special permission needed). Verified
  with an actual playable `.m4a` file pulled from the device and
  played in VLC.
- **Phase 2 - NEXT UP, STARTING NOW**: continuing to record/stream
  when the app is **fully backgrounded** (not just locked). Needs a
  native foreground service (Android) / properly held `AVAudioSession`
  (iOS). A permission-prompt hook already exists in the POC (fires via
  `AppState` detection the moment the user backgrounds the app *while
  recording*, opens the Android battery-optimization exemption dialog)
  — but the actual background-capable native recording session itself
  is **not implemented yet**. This is the work to start next.
- Explicitly out of scope: app fully killed/swiped away — that's a
  hard OS boundary no framework overrides; only backgrounded-but-not-
  killed is in scope for Phase 2.

## POC status and real bugs found/fixed along the way
The standalone `audio-poc` Expo/RN project validated the above. Files:
- `App.tsx` — URL input + Download, Play/Pause, Loop toggle,
  Start/Stop Recording with live timer.
- `src/services/AudioService.ts` — downloads audio via
  `expo-file-system` (caches to avoid re-download), sets up
  `react-native-track-player`, loop via `RepeatMode.Track`.
- `src/services/RecordingService.ts` — records via
  `react-native-audio-recorder-player`. Contains three real fixes
  found during testing (useful context if similar symptoms resurface
  during the real migration):
  1. **Runtime mic permission** - declaring `RECORD_AUDIO` in the
     manifest/`app.json` is not enough on Android 6+; an explicit
     `PermissionsAndroid.request()` is required before recording, or
     the recorder silently "succeeds" while producing an unplayable
     near-empty file.
  2. **`file://` scheme stripping** - `expo-file-system`'s
     `documentDirectory` returns a `file://` URI, but the native
     Android recorder (`java.io.File`-based) doesn't understand that
     prefix and throws `ENOENT` if passed it directly; strip the
     scheme before passing the path to `startRecorder()`.
  3. **Explicit `AudioSet` (AAC/MPEG_4)** - relying on the library's
     default encoder config was less reliable for proper container
     finalization; passing an explicit `AudioSet` (AAC encoder,
     MPEG_4 output, mic source) made recordings consistently valid.
- `index.js` — registers the TrackPlayer background playback service.
- `app.json` — `UIBackgroundModes: ["audio"]` (iOS),
  `FOREGROUND_SERVICE`/`WAKE_LOCK`/`RECORD_AUDIO`/
  `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` (Android).
- `package.json` — `react-native` pinned to `0.74.5` to match the
  installed Expo SDK exactly (an earlier mismatch caused build
  failures).
- `BUILD_AND_TEST.md` — step-by-step Windows+Android Studio and
  macOS+Xcode build/run instructions (including running via Android
  Studio's own device picker, not just CLI), plus a troubleshooting
  log of real Gradle/NDK/version-mismatch errors with reasoning.

### Non-recorder learning worth keeping in mind
When verifying a recorded file by pulling it off the device, **don't
pipe binary data through PowerShell's `>` redirect** (e.g.
`adb exec-out ... cat ... > file`) — PowerShell's `>` does text/
encoding conversion by default and can silently corrupt binary files,
producing a file of plausible size that won't play, which looks
exactly like a recording bug but isn't one. Use `cmd.exe` for that
specific redirect, or `adb pull` from a location the app can write to,
or Android Studio's **Device File Explorer** (most reliable, avoids
shell redirection entirely).

### Testing environment specifics
- Windows, Android Studio installed, JDK 21 selected for Gradle 8.8
  compatibility.
- Tested on the **Android Emulator** launched via `npx expo run:android`
  (not Android Studio's Run button) — confirmed the emulator's
  **Extended Controls → Microphone → "Virtual microphone uses host
  audio input"** must be enabled for real mic input to reach the
  virtual device, separately from Windows' own per-app mic permission
  (`qemu-system-x86_64` needs that too, checked via Windows Settings →
  Privacy → Microphone → Recent activity).
- Also has a **physical Android device** set up via wireless ADB
  debugging (paired via `adb pair`, shows as `adb-<serial>` rather than
  a plain IP - expected for mDNS-based wireless debugging).
- Prefers running via **Android Studio's device picker + Run button**
  (open `audio-poc\android` in Studio, pick device from the toolbar)
  over plain CLI, matching the Capacitor-era workflow — note Metro
  (`npx expo start --dev-client`) must run in a separate terminal
  alongside Studio's Run button, since Studio only builds/installs the
  native shell.

## Original migration plan (proposed, not yet acted on)
Before the POC detour, this plan was proposed for migrating the real
app's components and never followed through on - still the intended
starting point once Phase 2 is far enough along (or in parallel, see
below):
1. **User shares the real app's component list/structure** - not full
   code, just an inventory - so scope can be sized. **Still not
   shared.**
2. **Inventory pass**, sorting existing pieces into: business logic/
   services (API calls, data models, version-selection logic, the
   language/transliteration mapping - expected to port with moderate
   rework), Angular components/templates (need full UI rewrite as RN
   components - not a mechanical translation), and native plugin usage
   (current Capacitor audio/filesystem plugins - each needs a direct
   RN-equivalent identified; track-player + audio-recorder-player
   cover audio, others not yet inventoried).
3. **Stand up the RN app skeleton** with `react-native-track-player`
   wired for the real version-playback + loop use case first, inside
   the actual app shell rather than only the standalone POC.
4. **Migrate screen by screen**, starting with the language/
   transliteration logic specifically (pure logic, no UI dependency,
   lower risk to port and validate first).

### Pending before real migration starts
- The component/structure share (step 1) - **blocking**.
- Whether `audio-poc`'s code gets merged into the real
  `sua-bhajnavali-app-rn` project once Phase 2 is confirmed, or the
  real app's RN skeleton gets built fresh with the POC's services
  ported in as reference - **not yet decided**.
- Confirming the exact current contents/state of
  `C:\Users\rajai\source\sua-bhajnavali-app-rn` (old Angular/Capacitor
  project still in place? empty folder earmarked for RN? already
  partially set up?) - needed before step 3 can begin for real.

## Immediate focus for the new thread: Phase 2 — background recording
Starting point: design and implement a native foreground service
(Android) that keeps `react-native-audio-recorder-player` (or a
successor, if streaming requirements push toward a different native
recording approach) recording once the app is backgrounded, plus the
iOS equivalent (a properly held `AVAudioSession` with the right
background mode declared). The existing `AppState`-based permission-
prompt hook in `RecordingService.ts` is the entry point this connects
to — currently it only opens the battery-optimization settings dialog;
it needs to actually keep the recording session alive once that's
granted.

## Not yet started
- Phase 2 native background recording implementation (this thread's
  focus).
- RTMP push publisher integration (native module needed).
- Media server side (RTMP ingest → HLS transcode) — no server work
  done, protocol choice only confirmed.
- Continuous multi-track "playlist" playback of downloaded bhajans
  (new requirement #5 above) - likely no POC needed, extend the
  existing track-player setup with a queue instead of a single track.
- Stream-without-downloading playback option (new requirement #6
  above) - likely no POC needed, pass a remote URL directly as a
  track's `url` instead of a local file path.
- Notifications (new requirement #7) - lowest priority, no concrete
  requirement yet, not started.
- Video (explicitly deferred — audio-only is current scope).
- Actual migration of the real app's existing Angular/Capacitor
  components, multi-language/transliteration logic, etc. into the RN
  codebase — all work so far has been in the isolated `audio-poc`
  scaffold, not the real app.
