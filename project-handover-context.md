# Project handover: Capacitor to React Native migration (Sua Bhajnavali app)

Paste this into a new thread to continue. Last updated 11 Oct 2026.
Companion files: `BUILD_AND_TEST.md` (exact build, run and fix steps),
`POC_STATUS_AND_NEXT_STEPS.md` (test matrix and ordered next steps),
`poc-updates/` (latest `App.tsx` and one `AudioService.ts` edit).

## 1. The app and why we are migrating

- Existing production app: **Angular hybrid app on Capacitor**
  (`com.mgrtechsolutions.suabhajnavali`), Android and iOS.
- Four languages. Non-English content is **transliterated** into the
  Latin script, not translated.
- Each bhajan ("version") has an audio file, downloaded when the app
  starts and played with a Capacitor audio plugin.
- **Problems under Capacitor:** playback runs through a WebView audio
  tag, so it stops when the app is backgrounded or closed, and looping
  after the app is closed is unreliable.
- **Decision:** move to **React Native with Expo** (one codebase for
  iOS and Android) and fix audio with a native player.

## 2. Requirements

| # | Requirement | Status |
|---|---|---|
| 1 | Loop a single bhajan | Works on Android in the POC (SDK 51). Not retested on SDK 57. |
| 2 | Live audio recording (video later) | Foreground recording works on Android (SDK 51). Not retested on SDK 57 or iOS. |
| 3 | Live streaming so others can listen in real time | Protocol chosen: **RTMP push, server converts to HLS**. Not built. |
| 4 | One codebase, iOS and Android | Expo/React Native chosen. |
| 5 | Continuous playlist of downloaded bhajans (play 5 of 10 in a row, no taps) | Not built. Probably no separate POC: track-player supports a queue. |
| 6 | Play from a URL without downloading, as an alternative to download-then-play | Not built. Probably no separate POC: track-player accepts a remote URL directly. |
| 7 | Push notifications | Lowest priority, no concrete requirement. |

## 3. Key technical decisions

- **Playback: `react-native-track-player`.** Runs in a native background
  service (Android) or an audio session (iOS), not a WebView. On Android
  it uses the media-session pattern that also exempts VLC and Spotify
  from battery killing, so playback needs no extra permission.
- **Looping:** native repeat mode, not a JavaScript "on ended" handler.
- **Recording: `react-native-audio-recorder-player`** (records to a
  file). It will not cover live streaming. Pushing live audio will need a
  native RTMP publisher (for example HaishinKit on iOS and
  `rtmp-rtsp-stream-client-java` on Android, or a wrapper library).
- **Background recording is harder than background playback.** There is
  no OS exemption category for microphone use. Android needs a
  **foreground service of type microphone**. Samsung and Xiaomi can still
  kill it unless the user changes battery settings by hand (no API for
  that). iOS needs a held audio session. A fully swiped-away app cannot
  be kept recording by any framework.
- **Phases:** Phase 1 = recording in the foreground and with the screen
  locked. Phase 2 = recording while the app is backgrounded.

## 4. Where the code is

| | Windows machine | Mac |
|---|---|---|
| Path | `C:\Users\rajai\source\sua-bhajnavali-app-rn` | `/Users/mitulrajai/sua-bhajnavali-rn-poc/poc-sua-bhajnvali-rn` |
| Expo SDK | 51 | **57** |
| Used for | Android | iOS (also Android possible) |

It is still unclear whether the Windows folder is only the POC or also
holds the real Angular/Capacitor app. **Confirm this first.**

**Git: the merge is COMPLETED** (reported 11 Oct 2026). Both machines
had committed to `main`, so the histories had diverged. The rule used,
kept for reference: generated/config files take the SDK 57 version and
then re-apply custom edits. Hand-written source (`App.tsx`,
`src/services/*`, the three Kotlin files) keeps the Phase 2 version,
then gets the SDK 57 changes (`expo-file-system/legacy` import).
Still worth confirming after the merge: `npm install --legacy-peer-deps`
has been run, the three `Recording*.kt` files, the package registration
in `MainApplication.kt` and the manifest `<service>` entry are all still
present, and
`git grep -n -e "<<<<<<<" -e ">>>>>>>" -- src android ios app.json package.json`
prints nothing.

## 5. POC files (Expo, TypeScript)

- `App.tsx`: URL box and Download, downloaded-audio Play/Pause and Loop,
  Start/Stop Recording, and (new) **My recording**: file size, in-app
  playback, position/duration, a warning for files under about 5 KB.
  Replacement file is in `poc-updates/`.
- `src/services/AudioService.ts`: download and cache with
  `expo-file-system`, track-player setup, loop. One small edit is needed
  so `loadTrack` takes an id and title (`poc-updates/AudioService_loadTrack_change.md`).
- `src/services/RecordingService.ts`: runtime microphone permission,
  `file://` stripping on Android, explicit AAC/MPEG-4 settings, starts and
  stops the Android foreground service, and an `AppState` prompt for the
  battery exemption.
- `index.js`: registers the track-player playback service.
- `app.json`: iOS `UIBackgroundModes: ["audio"]` and microphone text;
  Android permissions including `FOREGROUND_SERVICE_MICROPHONE`;
  plugins `expo-dev-client` and `expo-build-properties`
  (`ios.enableSceneSupport: true`).
- `package.json`: `expo.autolinking.buildFromSource: ["expo-modules-core"]`.
- Android native (inside `android/`, **written but never tested**):
  `RecordingForegroundService.kt`, `RecordingForegroundModule.kt`,
  `RecordingForegroundPackage.kt`, registration in `MainApplication.kt`,
  and the `<service>` entry in `AndroidManifest.xml`. These are deleted
  by `prebuild --clean`.

## 6. Bugs found and fixed (apply to the real app)

**Recording (Android)**
- `ENOENT` on start: the native layer does not understand `file://`.
  Strip the prefix before `startRecorder()`.
- Tiny, unplayable file: the manifest permission is not enough. Request
  `RECORD_AUDIO` at runtime.
- Use an explicit AAC/MPEG-4 `AudioSet`.
- Pulling the file: **PowerShell's `>` corrupts binary files** (plays 0
  seconds). Use cmd.exe, Android Studio's Device File Explorer, or
  in-app playback. `adb pull` from `/data/data` is permission denied.
- Android emulator needs **Extended Controls, Microphone, "Virtual
  microphone uses host audio input"** and Windows microphone access for
  the emulator process.

**Android build (SDK 51 era)**
- `Could not get unknown property 'release'`:
  `org.gradle.configureondemand=false`.
- Mismatched versions: `npx expo install --fix`.
- `[CXX1101] NDK ... source.properties`: delete the NDK folder and
  reinstall it in SDK Manager.
- Locked Gradle caches: close Android Studio, stop Gradle/Java
  processes, delete the whole `caches` folder.
- Pick a JDK that the project's Gradle supports (JDK 21 worked for
  Gradle 8.8; Android Studio's JDK 25 did not).

**iOS with Xcode 27 (the most important set)**
- Xcode 27 removed `Simulator.app` (Device Hub replaces it), rejects iOS
  deployment targets below 15, and requires the UIScene lifecycle.
- **Fix = Expo SDK 57**: `expo` 57.0.27 or later, `expo-build-properties`
  57.0.22 or later, `ios.enableSceneSupport: true`, then
  `npx expo prebuild --clean --platform ios`.
- App closed at launch on a real iPhone with
  `Library not loaded: @rpath/React.framework/React`: precompiled Expo
  modules. Fix with `buildFromSource` for `expo-modules-core`. The
  package name was inferred, so add more packages if another framework
  crashes.
- **Xcode 26 cannot run on macOS 27.** Do not plan on downgrading.
- Xcode's "Copying shared cache symbols" can hang, especially with low
  disk space. Use `npx expo run:ios --device` instead.
- `prebuild --clean` wipes the signing team. Re-select it in Xcode and
  set `ios.bundleIdentifier` in `app.json`.
- To find why an iOS app closes: `xcrun devicectl device process launch
  --console --terminate-existing --device <id> <bundle id>`.
**iOS background recording**
- Works on a real iPhone with only `UIBackgroundModes: ["audio"]`.
  Do not add the Android foreground-service work for iOS.
- The "Keep recording in the background?" dialog (Samsung/Xiaomi
  battery settings) is **Android-only**. Gate it with
  `Platform.OS === 'android'` in `watchForBackgroundDuringRecording`.
- Still untested on iOS: long recordings, calls and Siri interrupting
  the session, Low Power Mode. App Store review will want a clear reason
  for background microphone use.

- Mac disk was nearly full during this work (7 GB free). Keep 15 GB or
  more free.

## 7. Testing without a computer, and without copying files

- **Debug builds need Metro.** The app fetches JS from your computer, so
  with the computer off it shows "Searching for development servers".
  When Metro is wanted: `npx expo start --dev-client`, same Wi-Fi, allow
  Local Network on iPhone, or enter the URL by hand.
- **Standalone Release builds need no server:**
  - iPhone: `npx expo run:ios --configuration Release --device`
    (or Xcode: Edit Scheme, Run, Build Configuration = Release).
  - Android: `npx expo run:android --variant release --device`, or
    `gradlew assembleRelease` then `adb install -r`.
  - Trade-offs: no hot reload, rebuild to see JS changes, errors only in
    device logs, a Release install replaces the Debug install, and free
    Apple ID builds expire after 7 days.
  - **Not yet tested.**
- **Recordings can be played inside the app** (new `App.tsx`, section
  "My recording"), so nothing needs copying to a computer. It shows size
  and duration, and warns when the file is almost empty.

## 8. Current status in one paragraph

On Android (SDK 51) download, play, loop and foreground recording work.
On the Mac (SDK 57) the app builds, installs on a real iPhone and
connects to Metro, and it ran on the simulator. **Not yet tested:**
anything audio on SDK 57, lock-screen behaviour, the Android Phase 2
Kotlin files, in-app recording playback, and standalone Release builds.
**Reported working (11 Oct 2026, real iPhone):** recording keeps going
when the app is backgrounded and when the phone is locked. It needs no
native service, only the existing `UIBackgroundModes: ["audio"]` setting.
The Android-only battery dialog was wrongly showing on iOS and must be
limited to Android (see section 6).
**Not built:** RTMP/HLS streaming, playlist, stream-without-download,
and the real app migration.

## 9. Open decisions

1. **Audio library.** SDK 55+ forces the New Architecture. track-player
   v4 is frozen. v5 (`@rntp/player`) is commercially licensed (personal
   and educational use free), so check pricing against your plans.
   The recorder library is not flagged as New Architecture ready.
   Both work through the interop layer at build time, runtime behaviour
   unverified. Alternatives to evaluate: Expo's own audio module.
2. Paid Apple developer account (free builds expire in 7 days).
3. Merge `audio-poc` into the real project, or build the real RN
   skeleton fresh and port services in.
4. Android config plugin so the foreground service survives
   `prebuild --clean`.

## 10. Next steps, in order

1. ~~Finish the git merge~~ **Done.** Quick follow-up checks: run
   `npm install --legacy-peer-deps` if not yet done, and confirm no
   conflict markers remain (command in section 4).
2. Copy in `poc-updates/App.tsx` and make the `loadTrack` edit.
3. Build a standalone Release build on the iPhone and run: download,
   play, loop, lock the screen, record, play the recording in the app.
4. Do the same on an Android phone.
5. Test Android Phase 2 (background recording), then record all results
   in `POC_STATUS_AND_NEXT_STEPS.md`.
6. Choose the audio library.
7. ~~Build iOS background recording~~ Works already (see section 8).
   Remaining: hide the battery dialog on iOS, then test long sessions
   and interruptions (phone call, Siri, another app using the mic).
8. Build the Android config plugin.
9. Streaming (RTMP in, HLS out), playlist, stream-without-download.
10. **Real migration:** share the component and file structure of the
    existing app (inventory only, not full code) so it can be sorted into
    logic that ports, UI that is rewritten, and native plugins that need
    React Native equivalents. Port the language and transliteration
    logic first, since it has no UI dependency.

## 11. What to ask the new thread to do first

- Confirm what is in the Windows folder (POC only, or the real app).
- Walk through the test results from steps 3 to 5.
- Ask for the component inventory template if you are ready to start
  the real migration.
