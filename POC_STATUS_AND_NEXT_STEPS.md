# POC status and next steps

Last updated: 11 Oct 2026.
Status key: ✅ confirmed by you · ❓ written or built but **not tested** · ⛔ not started.

## 1. Where the code lives

| | Windows machine | Mac |
|---|---|---|
| Path | `C:\Users\rajai\source\sua-bhajnavali-app-rn` | `/Users/mitulrajai/sua-bhajnavali-rn-poc/poc-sua-bhajnvali-rn` |
| Expo SDK | 51 (original POC) | **57** (upgraded for Xcode 27) |
| Used for | Android build and tests | iOS build and tests |

Both machines committed to `main`, so the histories had diverged. The
**merge is COMPLETED** (reported 11 Oct 2026). The rule that was used
for conflicts, kept for reference:
- **Generated/config files** (`build.gradle`, `settings.gradle`,
  `gradle.properties`, Gradle wrapper, `package.json`,
  `package-lock.json`, `AndroidManifest.xml`, `MainApplication.kt`):
  take the **SDK 57 (Mac) version**, then re-apply your own additions.
  For `package-lock.json` take either side and run
  `npm install --legacy-peer-deps`.
- **Hand-written source** (`App.tsx`, `src/services/*`, the three
  `Recording*.kt` files): keep the **Phase 2 (Windows) version**, then
  apply the SDK 57 changes (`expo-file-system/legacy` import, the new
  `MainApplication.kt` package-list style).

## 2. Test matrix

| Feature | Android (SDK 51) | Android (SDK 57) | iOS simulator (SDK 57) | iPhone (SDK 57) |
|---|---|---|---|---|
| App builds, installs, opens | ✅ | ❓ | ✅ | ✅ (connects to Metro) |
| Download from URL | ✅ | ❓ | ❓ | ❓ |
| Play / pause | ✅ | ❓ | ❓ | ❓ |
| Loop | ✅ | ❓ | ❓ | ❓ |
| Lock-screen playback / controls | ❓ | ❓ | n/a | ❓ |
| Recording to file (foreground) | ✅ (playable `.m4a`) | ❓ | n/a (no mic) | ❓ |
| Recording with screen locked | ❓ | ❓ | n/a | ❓ |
| **Background recording (Phase 2)** | ❓ code written, **not tested** | ❓ | n/a | ⛔ not built |
| Play the recording inside the app | ❓ new, not tested | ❓ | n/a | ❓ |
| Standalone build with no dev server | ❓ new, not tested | ❓ | ❓ | ❓ |

## 3. Written but not tested

- **Android Phase 2 native pieces:** `RecordingForegroundService.kt`,
  `RecordingForegroundModule.kt`, `RecordingForegroundPackage.kt`; the
  package registration in `MainApplication.kt`; the manifest
  `<service ... foregroundServiceType="microphone">` entry; the
  `FOREGROUND_SERVICE_MICROPHONE` permission; and the JS in
  `RecordingService.ts` that starts and stops the service. **They are in
  the project but have never been run.** On SDK 57 they also depend on
  React Native's interop layer for older native modules.
- **In-app playback of the recording** (new `App.tsx`).
- **Standalone builds** (no dev server), see Part I of
  `BUILD_AND_TEST.md`.
- **`ios.appleTeamId`** keeping the signing team across
  `prebuild --clean`, and the `buildFromSource` list covering every
  precompiled framework that crashes on a device.

## 4. Not started

- iOS background recording (held audio session plus background mode).
- RTMP push from the phone and HLS playback for listeners, and the
  media server.
- Continuous playlist playback of downloaded bhajans.
- Stream-without-downloading option.
- Push notifications (lowest priority, no concrete requirement).
- Video (deferred).
- Migration of the real Angular/Capacitor app. Blocked until you share
  its component and file structure.

## 5. Decisions and risks to settle

1. **Audio library.** Expo SDK 55+ forces the New Architecture.
   `react-native-track-player` v4 is frozen. v5 (`@rntp/player`) is
   commercially licensed. `react-native-audio-recorder-player` is also
   not flagged as New Architecture ready. Both run through the interop
   layer in the POC. Whether they behave correctly at runtime is
   untested.
2. **Free Apple ID builds expire after 7 days.** A paid developer
   account removes that.
3. **Android re-adds after regeneration.** `prebuild --clean` deletes
   the Kotlin files and manifest edits. Plan an Expo config plugin.
4. **Android OEM battery killing** (Samsung, Xiaomi) can still stop a
   background recording even with a foreground service. That needs a
   real Samsung or Xiaomi phone to judge.

## 6. Next steps, in order

1. ~~**Finish the merge**~~ **Done.** Quick follow-up checks: run
   `npm install --legacy-peer-deps` if not yet done, confirm the three
   `Recording*.kt` files, the `MainApplication.kt` registration and the
   manifest `<service>` entry survived, then check no conflict markers
   remain:
   `git grep -n -e "<<<<<<<" -e ">>>>>>>" -- src android ios app.json package.json`
   (works on Windows and Mac; printing nothing means it is clean)
2. **Apply the new code** from `poc-updates/`: replace `App.tsx` and
   make the one-function edit in `AudioService.ts`.
3. **Build a standalone Release build on the iPhone** (no Metro) and run
   the feature checks from Part F of `BUILD_AND_TEST.md`: download,
   play, loop, lock the screen, record, then play the recording
   **inside the app**. Record the results in the table above.
4. **Do the same on an Android phone**, using a Release build.
5. **Test Android Phase 2** (background recording). Rebuild after the
   native files are confirmed present, then run F6.
6. **Decide the audio library** from the results of steps 3 to 5.
7. **Build iOS background recording**, tested on the iPhone.
8. **Write the Expo config plugin** for the Android service.
9. **Streaming, playlist, stream-without-download**, then the real
   migration (share the component inventory first).