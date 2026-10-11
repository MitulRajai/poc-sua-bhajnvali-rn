# Build & Test Instructions — Android (Windows/Mac) and iOS (Mac)

This project needs a **dev client build** (native code from
`react-native-track-player` and `react-native-audio-recorder-player`),
not Expo Go. Follow the path that matches your machine.

## Contents

| Part | What it covers |
|---|---|
| **A** | Android on Windows via Android Studio (CLI and Studio device picker) |
| **B** | iOS on Mac: Xcode 27 requirements, run from terminal/VS Code, run from Xcode, simulator vs real iPhone |
| **C** | iOS from Windows (not possible locally) |
| **D** | Earlier Android/Windows troubleshooting log (SDK 51 era) |
| **E** | App shows "Searching for development servers" / waits for a server |
| **F** | Feature test checklist and how to pull recorded files (Android and iOS) |
| **G** | Running from VS Code with device selection |
| **H** | **Fixes to carry into the real implementation** (read before migration) |
| **I** | **Testing without the dev server and without copying files** (standalone builds, in-app recording playback) |

> **Two machines are in play.** Part A was written for the Windows
> machine (`C:\Users\rajai\...`). Parts B, E, F and G apply to the Mac
> (`/Users/mitulrajai/...`). The Mac project runs **Expo SDK 57**; the
> earlier Windows project was on SDK 51. Commands are the same, but
> generated native files differ between SDKs.

---

## PART A — Android on Windows via Android Studio

There are **two ways to run the Android build**: via the command line
(`npx expo run:android`), or via Android Studio's own device picker and
Run button, the same workflow as the Capacitor project. Use either, or
mix them (build once via CLI, then iterate via Studio).

### A1. One-time environment setup

1. **Install Node.js (LTS)** from https://nodejs.org. Verify:
   ```
   node -v
   npm -v
   ```

2. **Install Android Studio** from https://developer.android.com/studio
   with default options (installs the SDK, Platform-Tools and an
   emulator image).

3. **Install SDK components** (if the wizard didn't):
   Android Studio → **More Actions → SDK Manager**.
   - **SDK Platforms:** the latest Android version.
   - **SDK Tools:** Android SDK Build-Tools, Platform-Tools, Emulator.
   - Click **Apply**.

4. **Set `ANDROID_HOME`**
   - Copy the **Android SDK Location** shown in SDK Manager
     (typically `C:\Users\<you>\AppData\Local\Android\Sdk`).
   - Windows **Settings → System → About → Advanced system settings →
     Environment Variables**. Under **User variables** add
     `ANDROID_HOME` = that path.
   - Edit `Path` and add `%ANDROID_HOME%\platform-tools` and
     `%ANDROID_HOME%\emulator`.
   - Close and reopen all terminals. Verify: `adb --version`.

5. **Java (JDK).** Usually bundled with Android Studio. Verify
   `java -version`. If Studio shows *"Please Select Gradle JVM to Import
   Project: Gradle X is incompatible with the Gradle JVM version Y"*,
   click the **Use JVM 21** option it offers (Gradle 8.8 supports up to
   JDK 22; Studio's bundled JDK 25 was too new). Pick whichever
   compatible version Studio proposes.

### A2. Connect a device (emulator or real phone)

**Emulator:** Android Studio → **Virtual Device Manager → Create
Device** → pick a phone and system image → ▶ to boot it once.

> **Disk-space note:** an emulator image plus its quick-boot snapshot
> can use several GB. Create only one AVD, and use a real device when
> you can.

**Real device (recommended):**
- **Settings → About phone → tap Build number 7 times**.
- **Settings → Developer options → USB debugging** on.
- Connect by USB and accept the "Allow USB debugging" prompt.
- Verify: `adb devices` lists it as `device`.

**Wireless debugging (Android 11+):**
1. Phone: **Developer options → Wireless debugging → on**.
2. Tap **Pair device with pairing code** (shows IP:port and a 6-digit code).
3. PC: `adb pair <ip>:<pairing-port>` and enter the code.
4. `adb devices -l`. A paired phone often appears as `adb-<serial>...`
   (mDNS name) instead of an IP. That is normal and already connected.
   Only if it is absent, run `adb connect <ip>:<debug-port>` using the
   port on the main Wireless debugging screen (different from the
   pairing port).
5. Phone and PC must be on the same Wi-Fi.

### A3. First-time build

1. Open a terminal **inside the project folder**.
2. `npm install`
3. `npx expo prebuild` (generates the native `android` folder)
4. `npx expo run:android` (builds, installs on the device `adb` sees,
   and starts Metro). The first run takes several minutes.

If both an emulator and a phone are connected, choose the target:
`npx expo run:android --device` (it shows a list).

### A4. Everyday workflow: run from Android Studio

After A3 has run once (so `android/` exists):

1. Android Studio → **File → Open** → select the project's **`android`**
   folder (not the project root).
2. Let Gradle sync finish.
3. Pick your phone or emulator in the **device dropdown** in the top
   toolbar.
4. **Start Metro in a separate terminal first:**
   ```
   npx expo start --dev-client
   ```
   Studio's Run button only builds and installs the app. It does not
   start Metro. See **Part E** if the app then says it is searching for
   or cannot find a server.
5. Click ▶ **Run** (Shift+F10).

JS changes hot-reload through Metro. Hit Run in Studio again only when
native code or native dependencies change.

### A5. What you can and cannot validate

| Test | Emulator | Any real Android device | Real Samsung/Xiaomi |
|---|---|---|---|
| Download, play, loop | ✅ | ✅ | ✅ |
| Screen-lock playback/recording | ✅ | ✅ | ✅ |
| Background playback persistence | ✅ | ✅ | ✅ |
| Real microphone input | ⚠️ needs host-mic setting, see F3 | ✅ | ✅ |
| OEM background-kill behaviour | ❌ not reproducible | ❌ unless that brand | ✅ only way |

### A6. Android Phase 2 (background recording): native pieces required

Background recording needs a **foreground service of type
microphone**. These pieces live inside the generated `android/`
folder, so **`prebuild --clean` deletes them**. Re-add after any clean.

1. Three Kotlin files in
   `android/app/src/main/java/com/example/audiopoc/`:
   `RecordingForegroundService.kt`, `RecordingForegroundModule.kt`,
   `RecordingForegroundPackage.kt`.
2. Register the package in `MainApplication.kt`
   (`packages.add(RecordingForegroundPackage())` in the package list;
   the exact code differs between SDK versions).
3. In `AndroidManifest.xml`:
   - Permissions: `FOREGROUND_SERVICE` and
     **`FOREGROUND_SERVICE_MICROPHONE`** (required on Android 14+).
   - Inside `<application>`:
     ```xml
     <service
         android:name=".RecordingForegroundService"
         android:foregroundServiceType="microphone"
         android:exported="false" />
     ```
4. `app.json` → `android.permissions` includes
   `FOREGROUND_SERVICE_MICROPHONE`.
5. **Rebuild**. A JS reload is not enough for native changes.

Status on SDK 57 / New Architecture: **not yet re-verified.** The
module uses the older native-module style, which normally works through
React Native's interop layer. Confirm it on a device.

---

## PART B — iOS on Mac

### B0. Know your Xcode and macOS combination first

| Your setup | What to expect |
|---|---|
| **Xcode 27** (macOS 26.6 or 27) | Needs **Expo SDK 57+** with the settings in **Part H**. Older SDKs fail in several ways (Simulator not found, deployment-target errors, Swift errors, launch crash). |
| **Xcode 26.x** | Works with older SDKs. **Xcode 26 will not run on macOS 27**, so downgrading Xcode is not an option on the latest macOS. |

Why Xcode 27 is different:
- `Simulator.app` no longer exists. It is replaced by **Device Hub**
  (`com.apple.dt.Devices`). Expo's CLI supports this from CLI 56+.
- Xcode 27 rejects iOS deployment targets below 15.0.
- Apps built with the iOS 27 SDK **must adopt the UIScene lifecycle**,
  or they close instantly at launch.

### B1. One-time setup

1. Node.js LTS (`brew install node`).
2. **Xcode** from the Mac App Store. Open it once, accept the license
   and any "install additional components" prompt.
3. Select it and accept the license:
   ```
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   xcode-select -p
   ```
4. Install an iOS simulator runtime (Xcode → Settings → Components).
5. CocoaPods (`sudo gem install cocoapods`), Watchman (`brew install watchman`).
6. **Free disk space.** Xcode, simulator runtimes, DerivedData and the
   device symbol cache are large. Check:
   ```
   df -h /System/Volumes/Data
   ```
   Keep **at least 15 GB** free. Safe to clear:
   `rm -rf ~/Library/Developer/Xcode/DerivedData`, the project's
   `ios/build`, `xcrun simctl delete unavailable`, and unused runtimes.

### B2. Project setup for Xcode 27 (do once per project)

Summary (details and reasons are in **Part H**):

1. Expo `57.0.27` or later, `expo-build-properties` `57.0.22` or later.
2. `app.json` → `plugins`:
   ```json
   "plugins": [
     "expo-dev-client",
     ["expo-build-properties", { "ios": { "enableSceneSupport": true } }]
   ]
   ```
3. `package.json`:
   ```json
   "expo": {
     "autolinking": {
       "buildFromSource": ["expo-modules-core"]
     }
   }
   ```
4. `app.json` → `ios.bundleIdentifier` set to your own unique ID.
5. Regenerate and confirm the scene manifest exists:
   ```
   npx expo prebuild --clean --platform ios
   git grep --untracked -l UIApplicationSceneManifest -- ios
   ```
   The `git grep` command must print a path (it works the same on
   Windows and Mac).
6. After `--clean`, **re-select your signing team** (B4 step 3).

### B3. Run on the iOS Simulator (terminal or VS Code)

```
npx expo run:ios
```
Expo CLI 56+ boots the simulator through Device Hub. To choose a
specific simulator:
```
npx expo run:ios --device
```
(shows a list of simulators and connected iPhones) or by name:
```
npx expo run:ios --device "iPhone 17 Pro"
```
To open Device Hub yourself: `open -b com.apple.dt.Devices`.

If you see `Can't determine id of Simulator app`, you are on an SDK
older than 56 under Xcode 27. See Part H, item H1.

### B4. Run on a real iPhone from Xcode (select the device in Xcode)

1. **Prepare the iPhone:**
   - Connect by cable, unlock, tap **Trust**.
   - **Settings → Privacy & Security → Developer Mode** on, then
     restart when prompted.
2. In Xcode: **File → Open** → `ios/<appname>.xcworkspace` (the
   `.xcworkspace`, never the `.xcodeproj`).
3. **Signing:** click the blue project icon → select the app target →
   **Signing & Capabilities** → tick **Automatically manage signing** →
   choose your **Team** (add your Apple ID in Xcode → Settings →
   Accounts if the list is empty). If the bundle ID is unavailable,
   change it to something unique and put the same value in `app.json`.
   Free Apple IDs: the app expires after **7 days** and only a few apps
   can be installed at once.
4. **Select the device:** use the device dropdown in the Xcode top
   toolbar (next to the Run ▶ button) and pick your iPhone.
5. **Start Metro** in a terminal: `npx expo start --dev-client`.
6. Click ▶ **Run** in Xcode.
7. **First launch only:** on the iPhone go to **Settings → General →
   VPN & Device Management → your Apple ID → Trust**, then open the app.
8. When the app opens it shows the dev client screen. See **Part E**.

> **If Xcode sits at "Copying shared cache symbols ... 0%"**, it is
> copying OS symbols from the phone. It can take 10 to 30 minutes and
> may stall when disk space is low. Don't wait. Stop it and use the
> terminal route instead (B5), which does not need that step.

### B5. Run on a real iPhone from the terminal (no Xcode UI)

```
npx expo run:ios --device
```
Pick your iPhone from the list. This builds, signs (needs the team set
once) and installs. Metro starts automatically in that terminal.

To see why an app closes at launch, run it with console output:
```
xcrun devicectl list devices
xcrun devicectl device process launch --console --terminate-existing --device <device id> <your.bundle.id>
```
The first error line is almost always the cause (examples in Part H).

### B6. What you can and cannot validate on iOS

| Test | Simulator | Real iPhone |
|---|---|---|
| Download, play, loop | ✅ | ✅ |
| Screen-lock playback | ⚠️ unreliable | ✅ |
| Background playback persistence | ❌ | ✅ |
| Microphone recording | ❌ no real mic | ✅ required |
| iOS Phase 2 (background recording via audio session) | ❌ | ✅, **not built yet** |

---

## PART C — iOS from Windows

Not possible locally. `expo run:ios` and Xcode require macOS.
Options: **EAS Build** (cloud, needs an Apple Developer account for
distribution; note EAS Xcode 27 images were still "coming soon" at the
last check) or a Mac you can borrow or rent.

---

## PART D — Earlier Android/Windows troubleshooting log (SDK 51 project)

Errors hit while first setting up the Android build, kept as reference.

### D1. `Could not get unknown property 'release'` (project `:expo`)
Cause: `--configure-on-demand` changes project evaluation order, so
`expo-modules-core`'s publishing block ran before the `release`
component existed. Fix in `android/gradle.properties`:
```
org.gradle.configureondemand=false
```

### D2. Mismatched dependency versions
`npx expo-doctor` flagged `react-native` not matching the SDK. Fix:
```
npx expo install --fix
npm install
```
Then regenerate native folders (`prebuild --clean`).

### D3. `[CXX1101] NDK ... did not have a source.properties file`
Cause: NDK folder incomplete or corrupt (interrupted download). Delete
the folder, then reinstall it in Android Studio → **SDK Manager → SDK
Tools → Show Package Details → NDK (Side by side)** and let it finish.
PowerShell: `Remove-Item -Recurse -Force "<path>"`.
cmd.exe: `rd /s /q "<path>"`. (PowerShell rejects `/s /q`.)

### D4. Gradle cache delete fails: "file is being used by another process"
Cause: Gradle daemons still running. Close Android Studio, then:
```
.\gradlew.bat --stop
Get-Process | Where-Object { $_.ProcessName -match "java|gradle" } | Stop-Process -Force
```
Re-check, because daemons can respawn while Studio is open. A reboot
clears all locks. After a half-deleted `.gradle\caches`, delete the
whole `caches` folder (not part of it) and rebuild.

---

## PART E — App shows "Searching for development servers" (waiting for a server)

**What it means:** this is a *development build*. The installed app
contains the native code but **not your JavaScript**. It loads JS from
**Metro**, the dev server on your computer. Xcode's Run and Android
Studio's Run only **install** the app. They do not start Metro.

### E1. Fix steps (both platforms)

1. **Start Metro and leave it running:**
   ```
   npx expo start --dev-client
   ```
   Note the address it prints, such as `http://192.168.x.x:8081`.
2. **Same network:** phone and computer on the same Wi-Fi. Public or
   office Wi-Fi often blocks device-to-device traffic. A phone hotspot
   works as a test.
3. **iPhone only:** allow **Local Network** for the app
   (**Settings → Privacy & Security → Local Network** → app on). If it
   was denied once, discovery silently fails. Toggle on, reopen the app.
4. **Enter the URL manually** on the dev client screen
   (**Enter URL manually**): `http://192.168.x.x:8081`.
5. **Check from the phone's browser:** open
   `http://<computer-ip>:8081/status`. It must say `packager-status:running`.
   If that page does not load, it is a network problem, not an app problem.
6. **Firewall/VPN:** allow Node through the computer's firewall; turn
   off VPNs on both devices.
7. **Last resort:** `npx expo start --dev-client --tunnel` (slower, works
   across networks).

### E2. Android-specific

- **USB-connected phone:** forward the port, then reopen the app:
  ```
  adb reverse tcp:8081 tcp:8081
  ```
- **Emulator:** reaches the computer automatically via `10.0.2.2`.
- Red screen "Unable to load script" means Metro is not reachable. Use
  the steps above.

### E3. Free the port if Metro says 8081 is busy

Mac: `lsof -ti:8081 | xargs kill`

Windows (cmd or PowerShell): `netstat -ano | findstr :8081`, then
`taskkill /PID <pid from the last column> /F`

---

## PART F — Feature test checklist and pulling recorded files

### F1. Playback and loop (all platforms)

1. Paste a URL (or use the prefilled sample) and tap **Download**.
2. Confirm the progress counter moves and finishes.
3. Tap **Play**. Confirm sound.
4. Tap **Loop: On**, let the track finish, confirm it restarts.
5. Lock the screen and background the app. Confirm audio and looping
   continue and lock-screen controls appear.

### F2. Recording (phase 1: foreground and locked screen)

1. Tap **Start Recording**. Allow the microphone prompt.
2. Speak for about 10 seconds. Confirm the timer advances.
3. Lock the screen mid-recording (should keep going).
4. Tap **Stop** and wait for the **"Recording saved"** alert before
   pulling the file.
5. Pull and play the file (F4 or F5). It should have the full duration.

### F3. Emulator microphone (Android emulator only)

No real audio reaches the app unless both are on:
- Emulator **Extended Controls (⋮) → Microphone → "Virtual microphone
  uses host audio input"**.
- Windows **Privacy → Microphone**: desktop apps allowed (the emulator
  process is `qemu-system-x86_64`).

### F4. Pulling a recording off **Android**

Recordings live in the app's private storage:
`/data/data/<package>/files/live_recording.m4a`.

- **Easiest:** Android Studio → **View → Tool Windows → Device File
  Explorer** → `data/data/<package>/files/` → right-click the file →
  **Save As**. (Debug builds only.)
- **Terminal, Windows, use cmd.exe, not PowerShell:**
  ```
  adb exec-out run-as com.example.audiopoc cat files/live_recording.m4a > live_recording.m4a
  ```
  **Do not use PowerShell for this.** Its `>` re-encodes the bytes and
  silently corrupts binary files. You get a file of normal size that
  plays 0 seconds in VLC, which looks like a recorder bug but is not.
- `adb pull` straight from `/data/data/...` fails with "Permission
  denied", and copying to `/sdcard` also fails on Android 10+. Use the
  two methods above.

### F5. Pulling a recording off **iOS**

There is no `adb`. Enable file sharing so the app's Documents folder
shows in the Files app. In `app.json` → `ios.infoPlist`:
```json
"UIFileSharingEnabled": true,
"LSSupportsOpeningDocumentsInPlace": true
```
Then `npx expo prebuild` and rebuild (native change). Afterwards:
**Files app → On My iPhone → <app name> → live_recording.m4a**. Tap to
play, or share it to your Mac.

Alternative: Xcode → **Window → Devices and Simulators** → select the
iPhone → select the app → gear icon → **Download Container**.

### F6. Android background recording test (Phase 2, needs A6 done)

1. Rebuild and install (native changes).
2. **Start Recording.** A persistent **"Recording in progress"**
   notification must appear immediately. If it doesn't, the native
   module or service is not wired. Check Logcat before going further.
3. Press the **home button** (do not swipe the app away). Wait 15 to
   20 seconds.
4. Reopen the app and tap **Stop**.
5. Pull the file (F4). Duration should cover the **backgrounded time**.
6. **Samsung/Xiaomi only:** if it still cuts off, set the OEM exemption
   manually.
   - Samsung: Settings → Battery → Background usage limits → remove the
     app from Sleeping/Deep sleeping apps.
   - Xiaomi: Settings → Apps → Manage apps → app → Autostart on, and
     Battery saver → No restrictions.
   - Reference: dontkillmyapp.com
7. Swiping the app away from recents **will** still stop recording.
   That is an OS limit, not a bug.

### F7. iOS background recording

**Not built yet.** It needs a held audio session with the right
background mode. Note: iOS testing for recording and backgrounding
requires a **real iPhone**.

---

## PART G — Running from VS Code with device selection

VS Code's integrated terminal (**Terminal → New Terminal**) runs the
same Expo commands. Device selection is done by the Expo CLI.

### G1. One command (Metro starts automatically)

| Goal | Command |
|---|---|
| iOS simulator (choose from list) | `npx expo run:ios --device` |
| iOS simulator by name | `npx expo run:ios --device "iPhone 17 Pro"` |
| Real iPhone | `npx expo run:ios --device` then pick the iPhone |
| Android emulator or phone | `npx expo run:android --device` |

Before choosing an Android target, list what `adb` sees: `adb devices`.
Before choosing an iPhone, list devices: `xcrun devicectl list devices`.

### G2. Two terminals (better for daily work)

1. **Terminal 1, Metro (leave running):**
   ```
   npx expo start --dev-client
   ```
2. In the Metro terminal, press:
   - `i` open on an iOS simulator, `shift+i` **choose** a simulator
   - `a` open on Android, `shift+a` **choose** a device or emulator
3. Or install from **Terminal 2** with `npx expo run:ios --device` or
   `npx expo run:android --device`, then open the app. It connects to
   the Metro already running.

(Key bindings are shown in the Metro terminal's own help line. If they
differ in your CLI version, trust the on-screen list.)

### G3. Combining VS Code with Xcode or Android Studio

- Edit code in VS Code with Metro running.
- Use **Xcode** (B4) or **Android Studio** (A4) only when you need to
  install a native change or pick a device in their UI.
- Both IDEs share the same Metro server. You do not need one Metro per IDE.

### G4. Common VS Code terminal issues

- **Windows PowerShell vs cmd:** `rd /s /q` and `>` binary redirects
  behave differently. See D3 and F4.
- **Stale env vars:** after installing Android Studio or setting
  `ANDROID_HOME`, fully restart VS Code.
- **Stop a running build or Metro:** `Ctrl+C`. Orphaned processes:
  Mac: `pkill -f xcodebuild` and `pkill -f expo`.
  Windows: `taskkill /IM node.exe /F` (this stops **all** Node processes).

---

## PART H — Fixes to carry into the real implementation

Everything below was found while getting the POC working. Apply these
to the real app. **Status** says how well each is confirmed.

### H1. iOS: Xcode 27 + Expo

| # | Symptom | Cause | Fix | Status |
|---|---|---|---|---|
| H1.1 | `CommandError: Can't determine id of Simulator app` | Xcode 27 removed `Simulator.app` (replaced by Device Hub). SDK 51 to 54-era CLIs only look for Simulator. | Use **Expo SDK 57+** (Device Hub support is in CLI 56+). | Confirmed: build and launch work on SDK 57 |
| H1.2 | `IPHONEOS_DEPLOYMENT_TARGET is set to 13.4, but the range of supported ... is 15.0 to 27.0` | Old React Native pods target iOS 13.4; Xcode 27 rejects < 15.0. | Upgrading the SDK fixes it. **Do not keep manual Podfile overrides.** | Confirmed (resolved by upgrade) |
| H1.3 | `cannot find 'TARGET_IPHONE_SIMULATOR' in scope` in `expo-dev-menu` | Xcode 27 SDK no longer exposes that macro to older Expo native code. | Upgrade the SDK (same as above). | Confirmed |
| H1.4 | App closes at launch on a **real iPhone**: `Library not loaded: @rpath/React.framework/React` (from `ExpoModulesWorklets`) | Expo's **precompiled** native modules expect a `React.framework` that the device build does not embed. The simulator embeds it and hides the problem. | `package.json`: `"expo": { "autolinking": { "buildFromSource": ["expo-modules-core"] } }`, then `cd ios && pod install`, delete the app from the phone, rebuild. | Confirmed for this app. The package name was inferred. If the next crash names another framework, add that package to the list. |
| H1.5 | App closes at launch: `UIScene life cycle is required for apps built with this SDK` | iOS 27 SDK requires the scene lifecycle. SDK 57's older patches still generate the legacy `AppDelegate` startup. | Expo `57.0.27+`, `expo-build-properties` `57.0.22+`, plugin option `ios.enableSceneSupport: true`, then `npx expo prebuild --clean --platform ios`. Verify with `git grep --untracked -l UIApplicationSceneManifest -- ios`. | Confirmed |
| H1.6 | `Signing for "<app>" requires a development team` | `prebuild --clean` regenerates the Xcode project and drops the team. | Re-select the team in Xcode. Set `ios.bundleIdentifier` in `app.json`. `ios.appleTeamId` is the setting meant to persist the team across regenerations. | Team selection confirmed. **`appleTeamId` persistence not verified on SDK 57.** |
| H1.7 | Xcode stuck at "Copying shared cache symbols ... 0%" | First-time OS symbol copy from the phone. Slow, and can stall when disk is low. | Use `npx expo run:ios --device` instead. Keep 15+ GB free. Delete `~/Library/Developer/Xcode/iOS DeviceSupport` to retry. | Workaround confirmed |
| H1.8 | `xcodes` Homebrew install fails (`.build/apple/Products/Release` missing) | Known incompatibility with macOS 27's Swift toolchain. | Download Xcode manually from developer.apple.com (not needed on SDK 57). | Informational |
| H1.9 | Unsure whether Xcode 26 can be installed alongside | Apple support: **Xcode 26 is not supported on macOS 27.** | Don't plan on downgrading. Stay on Xcode 27 and a current SDK. | Informational |

How to see why an iOS app closes at launch (use this before guessing):
```
xcrun devicectl device process launch --console --terminate-existing --device <device id> <bundle id>
```
Alternatives: the **Console** app (select the iPhone, search the app
name) or **Settings → Privacy & Security → Analytics & Improvements →
Analytics Data** on the phone.

### H2. JavaScript and dependency changes

| # | Item | Detail |
|---|---|---|
| H2.1 | File system import | In recent SDKs the old file-system functions moved. Use `import * as FileSystem from 'expo-file-system/legacy'` (or migrate to the new API). |
| H2.2 | Install flag | Use `npm install --legacy-peer-deps` while the audio libraries' peer ranges are older. Commit the lockfile created that way. |
| H2.3 | Keep versions aligned | `npx expo install --fix` then `npx expo-doctor`. Do not hand-edit versions. |
| H2.4 | `expo-build-properties` | Needed for `enableSceneSupport`. The earlier `deploymentTarget: 15.1` workaround is **no longer needed** on SDK 57. |

### H3. Audio libraries and the New Architecture: **decision needed**

- Expo SDK 55+ **forces the New Architecture**.
- `react-native-track-player` **v4 is frozen** and built for the old
  architecture. **v5 (`@rntp/player`)** is a rewrite and is
  **commercially licensed** (personal and educational use free). Check
  its pricing against your plans for the Bhajnavali app before
  committing.
- `react-native-audio-recorder-player` is also not flagged as New
  Architecture ready. `expo-doctor` reports both
  (`reactNativeDirectoryCheck`).
- In the POC, the app **builds, installs and connects to Metro on a real
  iPhone** through React Native's interop layer. **Still to record from
  tests:** whether play, loop, lock-screen controls, recording and
  background behaviour all work on SDK 57. Interop problems tend to
  appear at runtime, not at build time.
- Do not silence the doctor warning with
  `expo.doctor.reactNativeDirectoryCheck.exclude` until you have
  chosen to keep these libraries on purpose.
- Alternatives to evaluate before the real migration: `@rntp/player`
  (licence), Expo's own audio module, and a New Architecture recorder.

### H4. Android recording fixes

| # | Symptom | Cause | Fix |
|---|---|---|---|
| H4.1 | `open failed: ENOENT` when starting a recording | Recorder's native layer uses `java.io.File` and does not understand a `file://` URI. | Strip `file://` before `startRecorder()` on Android. Keep the URI form for Expo file APIs. |
| H4.2 | Recording "works" but the file is tiny and unplayable | `RECORD_AUDIO` in the manifest is not enough. | Request the permission at runtime with `PermissionsAndroid` before recording. |
| H4.3 | Valid size but inconsistent container | Library defaults not guaranteed to finalize cleanly. | Pass an explicit `AudioSet`: AAC encoder, MPEG_4 output, mic source. |
| H4.4 | File plays 0 seconds in VLC after pulling | **PowerShell `>` corrupts binary.** | Pull with cmd.exe or Device File Explorer (F4). |
| H4.5 | Recording dies when the app is backgrounded | No foreground service of type microphone. | A6: service + module + package + manifest + `FOREGROUND_SERVICE_MICROPHONE`. |
| H4.6 | Foreground service + manifest edits vanish | `prebuild --clean` regenerates `android/` and `ios/`. | **To do before the real migration:** wrap the Kotlin files and manifest edits in an **Expo config plugin** (`withAndroidManifest` + `withDangerousMod`) so every prebuild reapplies them. |
| H4.7 | Gradle `release` property error, NDK `source.properties` error, locked caches | See Part D. | See Part D. |

### H5. Git hygiene

Commit `android/` and `ios/` **for now**, because the custom native
edits exist only there. Ignore generated and machine-specific files.

Add to `.gitignore`:
```
node_modules/
.expo/
*.log
build.log
.DS_Store
**/.DS_Store

# Android
android/.gradle/
android/build/
android/app/build/
android/local.properties
android/.idea/
*.apk
*.aab

# iOS
ios/Pods/
ios/build/
ios/.xcode.env.local
**/xcuserdata/
DerivedData/
```

If ignored files are already tracked, untrack them (keeps them on disk).
Use `--ignore-unmatch` so one missing path doesn't abort the whole command:
```
git rm -r --cached --ignore-unmatch .expo ios/Pods ios/build build.log
```

Expected in a regeneration commit: deleted `ic_launcher.png` /
`ic_launcher_round.png` / `splashscreen.xml` alongside new
`ic_launcher.webp` / `splashscreen_logo.png` /
`ic_launcher_background.xml` (the newer template replaced them). Commit
both the deletions and the additions. Check for stray build output with:
```
git status --short -uall
```
Look through the list for `Pods/`, `/build/`, `.DS_Store`, `.expo/` or
`.log` entries. To filter it instead:
- Mac: `git status --short -uall | grep -E "Pods/|/build/|\.DS_Store|\.expo/|\.log"`
- Windows PowerShell: `git status --short -uall | Select-String "Pods/|/build/|\.DS_Store|\.expo/|\.log"`

### H6. Environment lessons

- **Disk space:** Xcode, runtimes, DerivedData, the iOS device symbol
  cache, emulator images and Gradle caches add up. Keep 15+ GB free
  before big builds or Xcode downloads.
- **Windows shells:** PowerShell and cmd.exe differ for `rd /s /q` and
  `>`. When a command fails, check which shell you are in.
- **Native change means rebuild.** A JS reload only covers JS.
  New or edited native code needs a rebuild, and generated native
  folders need regenerating when `app.json` or plugins change.
- **After `prebuild --clean`:** re-set the signing team (iOS), re-add
  the Android Phase 2 files (until H4.6 is done), and delete the old app
  from the device before reinstalling.

### H7. Pre-migration checklist

- [ ] Choose the audio libraries (H3), including the track-player licence.
- [ ] Record SDK 57 test results for playback, loop, recording and
      background behaviour on a real iPhone and a real Android device.
- [ ] Build the Expo config plugin for the Android foreground service (H4.6).
- [ ] Build iOS background recording (held audio session).
- [ ] Verify `ios.appleTeamId` persists across `prebuild --clean` (H1.6).
- [ ] Confirm the `buildFromSource` list covers every precompiled
      framework that crashes on device (H1.4).
- [ ] Run the real app's component inventory (still not shared).


---

## PART I — Testing without the dev server and without copying files

### I1. Why the app keeps asking for a dev server

A **Debug** build (what `npx expo run:*` and Xcode's Run button install
by default) contains the native code but **not your JavaScript**. It
fetches the JS from Metro on your computer every time it opens. If the
computer is off, the app can only show "Searching for development
servers".

A **Release** build embeds the JavaScript bundle inside the app, so it
opens and runs on its own. This is the build to use when you want to
test away from your computer.

| | Debug (dev client) | Release (standalone) |
|---|---|---|
| Needs Metro running | **Yes** | **No** |
| Hot reload / dev menu / red error screen | Yes | No |
| Change JS and see it | instantly | rebuild and reinstall |
| Closer to what users get | no | **yes** |
| Where to read errors | Metro terminal | device logs (see I1.4) |

Use Debug while developing. Install a Release build when you want to
carry the phone around and test on its own.

### I1.1 iOS: standalone build on a real iPhone

From the project folder:
```
npx expo run:ios --configuration Release --device
```
Pick your iPhone from the list. Unlock the phone and keep it connected
until the app opens. After that you can unplug and turn the Mac off.

Same thing from Xcode instead:
1. Open `ios/<appname>.xcworkspace`.
2. **Product → Scheme → Edit Scheme… → Run → Info →
   Build Configuration → Release.**
3. Pick your iPhone in the top toolbar, then click ▶ Run.
4. To go back to a dev build, set the configuration back to **Debug**.

Notes:
- Signing is needed as before. Set the team in
  **Signing & Capabilities**.
- With a **free Apple ID** the build stops opening after **7 days**.
  Rebuild to refresh it.
- The first launch may need
  **Settings → General → VPN & Device Management → Trust**.

### I1.2 Android: standalone build on a real phone

```
npx expo run:android --variant release --device
```
Pick your phone from the list.

Or build an APK once and install it on any phone:
```
cd android
./gradlew assembleRelease        # Windows: .\gradlew.bat assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```
The Expo template signs Release builds with the **debug keystore**, so
this installs and runs fine for testing. It is **not** a Play Store
build. A real upload keystore is a later task.

### I1.3 Important behaviours

- **Installing a Release build over a Debug build replaces it**, because
  both use the same app ID. When you go back to developing, install the
  Debug build again.
- The Release build runs through the same interop layer and the same
  native code, but Release-only crashes are possible. Treat a Release
  test as a real test, not a formality.
- After any JS change you must rebuild to see it in a Release build.

### I1.4 Reading errors without Metro

- **iPhone:** run it from the terminal and watch the console:
  ```
  xcrun devicectl list devices
  xcrun devicectl device process launch --console --terminate-existing --device <device id> <bundle id>
  ```
  Or open the **Console** app on the Mac, select the iPhone, and filter
  by the app name. On the phone itself, crash reports are in
  **Settings → Privacy & Security → Analytics & Improvements →
  Analytics Data**.
- **Android:** `adb logcat` (filter with
  Windows: `adb logcat | findstr /i "ReactNative audiopoc AndroidRuntime"`,
  Mac: `adb logcat | grep -i -E "ReactNative|audiopoc|AndroidRuntime"`).

### I2. Playing a recording inside the app (no copying to a computer)

The updated `App.tsx` (in `poc-updates/`) adds a **My recording** section:

1. **Start Recording**, speak, **Stop**, and wait for the
   "Recording saved" alert. It shows the file size.
2. Scroll to **My recording**. It shows the saved file size and a
   **Play recording** button. Tap it to listen on the phone. The line
   under it shows `position / duration`.
3. The recording from an earlier session is found automatically on
   launch, so you can reopen the app and replay it without recording
   again.
4. **How to read the result:**
   - **Duration matches how long you spoke and you can hear it:** the
     recording works.
   - **Size under about 5 KB, with a warning shown:** the recording is
     almost certainly empty. Check the microphone permission. On the
     Android emulator, check the host-microphone setting (F3).
   - **Duration shows 0:00 and it will not play:** the file was not
     finalized correctly. Report it as a recorder issue.
5. Each new recording **overwrites** the previous one (a single file,
   `live_recording.m4a`). Timestamped files and a list of recordings are
   a later improvement.

The player is shared with the downloaded audio. Tapping Play on the
downloaded audio reloads that file, and tapping Play recording loads the
recording. Lock-screen controls show whichever one is loaded.

### I3. Optional: also open the file outside the app

- **iPhone:** with the file-sharing keys from F5, the recording appears
  in **Files → On My iPhone → <app name>**.
- **Android:** use F4 (Device File Explorer or the cmd.exe command).
  These are only needed if you want to inspect the file on a computer.