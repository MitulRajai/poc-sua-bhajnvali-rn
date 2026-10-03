# Build & Test Instructions — Windows / Android Studio vs macOS / Xcode

This project needs a **dev client build** (native code from
`react-native-track-player` and `react-native-audio-recorder-player`),
not Expo Go. Follow the path that matches your machine.

There are **two ways to run the Android build**: via the command line
(`npx expo run:android`), or via Android Studio's own device picker and
Run button — the same workflow you're used to from the Capacitor
project. Both are documented below; use whichever you prefer, or mix
them (e.g. build once via CLI, then iterate via Android Studio).

---

## PART A — Windows: Android build via Android Studio

### A1. One-time environment setup

1. **Install Node.js (LTS)**
   - Download from https://nodejs.org and install.
   - Verify: open **Command Prompt** or **PowerShell** and run:
     ```
     node -v
     npm -v
     ```

2. **Install Android Studio**
   - Download from https://developer.android.com/studio
   - Run the installer, keep default options (this installs the Android
     SDK, SDK Platform-Tools, and an emulator image).

3. **Install the Android SDK components** (if not already installed by
   the setup wizard):
   - Open Android Studio → **More Actions** (or **Tools**) →
     **SDK Manager**.
   - Under **SDK Platforms** tab: check the latest Android version
     (e.g. Android 14.0).
   - Under **SDK Tools** tab: check **Android SDK Build-Tools**,
     **Android SDK Platform-Tools**, **Android Emulator**.
   - Click **Apply** to install.

4. **Set the `ANDROID_HOME` environment variable**
   - In Android Studio's SDK Manager, copy the **Android SDK Location**
     path shown at the top (typically
     `C:\Users\<yourname>\AppData\Local\Android\Sdk`).
   - Open Windows **Settings → System → About → Advanced system
     settings → Environment Variables**.
   - Under **User variables**, click **New**:
     - Variable name: `ANDROID_HOME`
     - Variable value: the SDK path you copied
   - Edit the `Path` variable (User variables) and add these two entries:
     - `%ANDROID_HOME%\platform-tools`
     - `%ANDROID_HOME%\emulator`
   - Click OK on all dialogs, then **close and reopen** any terminal
     windows so the new variables take effect.
   - Verify:
     ```
     adb --version
     ```
     This should print an Android Debug Bridge version, not an error.

5. **Install Java (JDK 17)** — usually bundled with Android Studio
   already. Verify:
   ```
   java -version
   ```
   If this fails, install **Temurin JDK 17** from
   https://adoptium.net and set `JAVA_HOME` the same way as step 4.

### A2. Connect a device (emulator or real phone) in Android Studio

**Option 1 — emulator:**
1. Android Studio → **More Actions → Virtual Device Manager**.
2. Click **Create Device**, pick a phone (e.g. Pixel 7) → **Next**.
3. Pick a system image → **Next** → **Finish**.
4. Click the ▶ play icon to launch it once and confirm it boots to the
   home screen.

**Option 2 — real device (recommended, since this is what you'll use
day to day, and it's the only way to test Samsung/Xiaomi-specific
background behavior):**
- On the phone: **Settings → About phone → tap "Build number" 7 times**
  to enable Developer Options.
- **Settings → Developer options → enable USB debugging** (or use
  wireless debugging — see the note on that further down if you're
  pairing over Wi-Fi instead of USB).
- Connect via USB, accept the "Allow USB debugging" prompt on the
  phone.
- Verify it's visible: run `adb devices` in a terminal — should list
  your device as `device`, not `unauthorized` or empty.

### A3. First-time build (does the heavy native setup once)

The very first build still needs to go through this step once, even if
you plan to use Android Studio afterward — it's what generates the
native `android` project folder and installs all dependencies
correctly. After this, you can switch to the Studio-only workflow in
A4 for everyday runs.

1. Unzip this project, open a terminal **inside the project folder**
   (`audio-poc`).
2. Install dependencies:
   ```
   npm install
   ```
3. Generate the native Android project:
   ```
   npx expo prebuild
   ```
4. Build and install onto whatever device is visible to `adb` (this
   also starts the Metro bundler):
   ```
   npx expo run:android
   ```
   First run takes several minutes (Gradle build). The app should
   auto-launch on the emulator or connected device when done.

### A4. Everyday workflow: run and pick device from inside Android Studio

Once A3 has been done at least once (so the `android` folder exists),
you can skip the CLI entirely and work the way you're used to from
Capacitor:

1. Open Android Studio.
2. **File → Open**, and select the `audio-poc\android` folder (not the
   project root — Android Studio needs the native `android` subfolder
   specifically, since that's the actual Gradle/Android project; the
   `audio-poc` root is the React Native/JS project, which Android
   Studio doesn't open directly).
3. Let Gradle sync finish (progress bar at the bottom) — this can take
   a few minutes the first time you open it this way.
4. In the device dropdown at the top toolbar (next to the Run button),
   select your connected phone or a running emulator — exactly like in
   your Capacitor project.
5. Click the ▶ **Run** button (or Shift+F10).
6. **Important — start Metro first, in a separate terminal, before or
   right after hitting Run:**
   ```
   npx expo start --dev-client
   ```
   Unlike a plain native Android app, this project still needs the
   Metro bundler serving the JS bundle — Android Studio's Run button
   only builds and installs the native shell; it doesn't start Metro
   for you. Leave this terminal running while you work. If the app
   opens but shows a red "Unable to load script" screen, this is the
   usual cause — make sure Metro is running and the phone/emulator can
   reach your PC on the network (same Wi-Fi, or USB with port
   forwarding already set up by `adb`, which happens automatically for
   USB-connected devices).

From here on, for day-to-day changes to `App.tsx` or the service files,
you don't need to rebuild in Android Studio at all — Metro hot-reloads
JS changes automatically. You only need to hit Run again in Android
Studio when a **native** dependency changes (e.g. you add a new native
library and run `npx expo prebuild` again).

### A5. What you CAN and CANNOT validate on Windows

| Test | Emulator | Real Android device (any brand) | Real Samsung/Xiaomi device |
|---|---|---|---|
| Download, play, loop | ✅ | ✅ | ✅ |
| Screen-lock playback/recording | ✅ | ✅ | ✅ |
| Background playback persistence | ✅ (stock Doze emulated) | ✅ | ✅ |
| OEM background-kill behavior (Samsung "sleeping apps", Xiaomi Autostart) | ❌ not reproducible | ❌ unless it happens to be that brand | ✅ only way to test this |

iOS **cannot** be built or tested from Windows at all — see Part C.

---

## PART B — macOS: iOS build via Xcode

### B1. One-time environment setup

1. **Install Node.js (LTS)** from https://nodejs.org, or via Homebrew:
   ```
   brew install node
   ```
2. **Install Xcode** from the Mac App Store (free, but large — several
   GB). Open it once after installing so it finishes component setup.
3. **Install Xcode Command Line Tools**:
   ```
   xcode-select --install
   ```
4. **Install CocoaPods** (manages iOS native dependencies):
   ```
   sudo gem install cocoapods
   ```
5. **Install Watchman** (recommended, improves file-watching):
   ```
   brew install watchman
   ```

### B2. Build and run on the iOS Simulator (CLI)

1. Unzip the project, open Terminal in the project folder.
2. Install dependencies:
   ```
   npm install
   ```
3. Generate the native iOS project (also runs `pod install`):
   ```
   npx expo prebuild
   ```
4. Build and launch on the Simulator:
   ```
   npx expo run:ios
   ```
   First run takes several minutes. This opens the iOS Simulator
   automatically and installs the app.

   To pick a specific simulated device:
   ```
   npx expo run:ios --device "iPhone 15 Pro"
   ```
   (Run `xcrun simctl list devices` to see available simulator names.)

### B3. Build and run on a real iPhone — via Xcode (device picker, same idea as Android Studio)

1. Connect the iPhone via USB (or use wireless debugging, already paired
   in Xcode).
2. Open `audio-poc/ios/audiopoc.xcworkspace` in Xcode (NOT the `.xcodeproj`
   file — must be the `.xcworkspace`).
3. In Xcode, select your iPhone as the run target from the device
   dropdown in the top toolbar — this is Xcode's equivalent of Android
   Studio's device dropdown.
4. Under **Signing & Capabilities** for the app target, select your
   Apple ID / development team (free Apple ID works for local device
   testing, no paid account required for this).
5. Start Metro in a terminal first, same reasoning as the Android
   Studio flow above:
   ```
   npx expo start --dev-client
   ```
6. Click the ▶ Run button in Xcode.
7. First time only: on the iPhone, go to **Settings → General → VPN &
   Device Management** and trust your developer certificate.

### B4. What you CAN and CANNOT validate on iOS

| Test | Simulator | Real iPhone |
|---|---|---|
| Download, play, loop | ✅ | ✅ |
| Screen-lock playback | ⚠️ simulator has no real lock screen behavior — unreliable | ✅ |
| Background playback persistence | ❌ simulator doesn't suspend apps realistically | ✅ |
| Microphone recording | ❌ simulator has no real mic input | ✅ required |

**For this project, iOS testing of anything background/lock/mic-related
requires a real iPhone** — the Simulator is only useful for confirming
the UI and basic in-foreground playback logic.

---

## PART C — Can I do iOS from Windows at all?

Short answer: **not locally**. `expo run:ios` and Xcode both require
macOS — there's no Windows equivalent tool for building or code-signing
iOS apps.

Options if you don't own a Mac:
1. **Expo Application Services (EAS) Build** — cloud-builds the iOS app
   from your Windows machine and gives you an installable build (via
   TestFlight or ad-hoc distribution) without needing local Xcode:
   ```
   npm install -g eas-cli
   eas login
   eas build --platform ios --profile development
   ```
   Still needs an Apple Developer account (free tier has limits; paid
   is $99/year and required for TestFlight distribution).
2. **Borrow/rent a Mac** — a colleague's machine, a cloud Mac rental
   service (e.g. MacStadium, MacinCloud), just for the build + real
   device testing step.

For now, since you're on Windows: proceed with **Part A** for the
Android side, and treat iOS as a "when you have Mac access" step —
the Android and iOS code in this project is identical (same
`App.tsx`/services), only the build tooling differs.

---

## PART D — Troubleshooting log: real errors hit during setup, and why each fix works

Keep this section as a reference — these are errors actually encountered
while setting this project up, in the order they tend to surface, with
the reasoning behind each fix (not just the command) so the same logic
can be applied if a similar error shows up again later.

### D1. `A problem occurred configuring project ':expo'` /
`MissingPropertyException: Could not get unknown property 'release'`

**Symptom:**
```
Caused by: groovy.lang.MissingPropertyException: Could not get unknown
property 'release' for SoftwareComponent container...
```
thrown from `expo-modules-core\android\ExpoModulesCorePlugin.gradle`.

**Why it happens:** this is a known Gradle/Expo interaction issue. The
`expo-modules-core` Gradle plugin tries to publish a `release` software
component, but that component only exists once the Android library
plugin has finished configuring it. Running the build with
`--configure-on-demand` (as `npx expo run:android` does by default)
can change the order projects get evaluated in, so `expo-modules-core`'s
publishing step sometimes runs before the `release` component exists
yet — hence "unknown property 'release'". It's a build-ordering race,
not a mistake in the project's own code.

**Fix — disable configure-on-demand**, which removes the ordering
variability that triggers the race:

Add to `android/gradle.properties`:
```
org.gradle.configureondemand=false
```

### D2. Stale/mismatched dependency versions

**Symptom:** `npx expo-doctor` reporting:
```
✖ Check that packages match versions required by installed Expo SDK
  react-native@0.74.0 - expected version: 0.74.5
```

**Why it happens:** each Expo SDK version pins exact compatible versions
of `react-native` and related packages. If `package.json` has a
slightly different version (e.g. installed before a dependency bump, or
added by hand), the mismatch alone can cause downstream native build
failures that look unrelated to versioning — including triggering the
D1 issue above more reliably.

**Fix — let Expo's own tool reconcile versions, not a manual edit:**
```
npx expo install --fix
npm install
```
`expo install --fix` resolves the *whole* dependency set together
against the installed SDK, rather than bumping one package in isolation,
which avoids introducing a second mismatch elsewhere.

**Then regenerate native folders**, since they were generated before the
version fix and are now out of sync with the corrected `package.json`
and `app.json`:
```
rd /s /q android
rd /s /q ios
npx expo prebuild --clean
```
(This project's `package.json` already has `react-native` pinned to
`0.74.5` to prevent this specific mismatch on first install.)

### D3. `[CXX1101] NDK ... did not have a source.properties file`

**Symptom:**
```
> [CXX1101] NDK at C:\Users\...\Sdk\ndk\26.1.10909125 did not have a
  source.properties file
```

**Why it happens:** this means the NDK folder exists on disk but is
**incomplete or corrupted** — almost always from an interrupted or
cancelled download via the SDK Manager. Gradle finds the folder, but
can't find the `source.properties` file inside it that it uses to
verify the NDK install, so it fails immediately rather than trying to
use a broken toolchain.

**Fix — delete the broken folder and do a clean reinstall:**

Delete the folder (note: **PowerShell's `rd`/`Remove-Item` doesn't
accept classic `cmd.exe` flags like `/s /q`** — use one of these,
matching whichever shell you're in):

PowerShell:
```powershell
Remove-Item -Recurse -Force "C:\Users\rajai\AppData\Local\Android\Sdk\ndk\26.1.10909125"
```
Command Prompt (cmd.exe):
```
rd /s /q "C:\Users\rajai\AppData\Local\Android\Sdk\ndk\26.1.10909125"
```

Then reinstall cleanly via Android Studio's SDK Manager rather than the
command line, since the Studio UI shows real download progress and is
less likely to silently leave a half-downloaded folder again:
1. Android Studio → **SDK Manager → SDK Tools** tab.
2. Check **"Show Package Details"** (bottom right) to see specific NDK
   versions instead of just "NDK (Side by side)".
3. Under **NDK (Side by side)**, re-check the exact version that failed
   (don't let it silently pick a different one), click **Apply**, and
   let the download complete fully without interrupting it.
4. Rebuild:
   ```
   npx expo run:android
   ```

If it still fails after a clean reinstall, check `android/build.gradle`
for an explicit `ndkVersion` line — if present, make sure that *exact*
version (and no other partial NDK folders) exists under `Sdk\ndk\`, so
Gradle isn't accidentally picking a different, also-broken install.
