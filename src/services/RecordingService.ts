import { AppState, AppStateStatus, Linking, Platform } from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import * as FileSystem from 'expo-file-system';

const recorder = new AudioRecorderPlayer();

/**
 * The app-sandbox URI as expo-file-system gives it, e.g.
 * "file:///data/user/0/com.example.audiopoc/files/live_recording.m4a".
 * Useful for reading the file back afterward with expo-file-system APIs
 * (which DO expect the file:// scheme).
 */
export function getRecordingUri() {
  return `${FileSystem.documentDirectory}live_recording.m4a`;
}

/**
 * react-native-audio-recorder-player's native Android layer writes via
 * java.io.File, which does NOT understand a "file://" scheme prefix —
 * handing it a file:// URI is what produces the
 * "open failed: ENOENT (No such file or directory)" error, because the
 * literal string "file:" gets treated as part of a (nonexistent) path
 * segment rather than being stripped as a URI scheme.
 * The recorder needs a plain filesystem path instead.
 */
function toNativeRecorderPath(fileUri: string) {
  return Platform.OS === 'android'
    ? fileUri.replace('file://', '')
    : fileUri;
}

/**
 * Phase 1 scope: recording works while the app is in the foreground,
 * including when the screen is locked (locking the screen does NOT
 * background the app process — it just turns the display off, so no
 * special permission is needed for this case).
 */
export async function startRecording(
  onProgress?: (positionMs: number) => void
): Promise<string> {
  const fileUri = getRecordingUri();

  // documentDirectory itself always exists (it's the app's own sandbox
  // folder), but confirming here guards against edge cases where it
  // hasn't been created yet on first app launch.
  const dirInfo = await FileSystem.getInfoAsync(FileSystem.documentDirectory!);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory!, {
      intermediates: true,
    });
  }

  const nativePath = toNativeRecorderPath(fileUri);
  const uri = await recorder.startRecorder(nativePath);
  recorder.addRecordBackListener((e) => {
    onProgress?.(e.currentPosition);
  });
  return uri;
}

export async function stopRecording(): Promise<string> {
  const result = await recorder.stopRecorder();
  recorder.removeRecordBackListener();
  return result;
}

/**
 * Phase 2 hook: only relevant once the app is actually sent to the
 * background WHILE recording. We don't ask for this upfront — only
 * when the user's action (backgrounding mid-recording) actually needs it,
 * so the ask has clear context instead of a cold permission dialog.
 */
export function watchForBackgroundDuringRecording(
  isRecordingRef: { current: boolean },
  onNeedsBackgroundPermission: () => void
) {
  const handler = (state: AppStateStatus) => {
    if (state !== 'active' && isRecordingRef.current) {
      onNeedsBackgroundPermission();
    }
  };
  const sub = AppState.addEventListener('change', handler);
  return () => sub.remove();
}

/**
 * Opens the Android battery-optimization exemption dialog directly
 * (this part IS a standard Android intent, no OEM-specific code needed).
 * The OEM-specific step (Xiaomi Autostart, Samsung sleeping-apps list)
 * has no equivalent API — it can only be described to the user and
 * linked to their general app-settings screen.
 */
export function requestBackgroundRecordingPermission() {
  if (Platform.OS === 'android') {
    Linking.sendIntent('android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS');
  } else {
    // iOS has no user-facing background-recording toggle; background
    // audio-session behavior is governed by the UIBackgroundModes
    // entitlement declared in app.json, reviewed at App Store submission.
    Linking.openSettings();
  }
}
