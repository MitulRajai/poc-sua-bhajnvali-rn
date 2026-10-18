// UPDATED FILE — replace the existing:
// src/services/RecordingService.ts
//
// Changes from the previous version:
// 1. Imports NativeModules to reach the new RecordingForegroundModule.
// 2. startRecording() now starts the native foreground service FIRST,
//    before starting the actual recorder — the service's job is to
//    make the process backgrounding-safe for the whole duration of the
//    recording, not just reactively once backgrounding is detected.
// 3. stopRecording() stops the foreground service after the recorder
//    stops.
// 4. watchForBackgroundDuringRecording's prompt is now specifically
//    about the EXTRA Samsung/Xiaomi OEM-level exemption (battery
//    optimization) — the foreground service itself is already running
//    throughout, handling the baseline Android requirement.

import {
  AppState,
  AppStateStatus,
  Linking,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import AudioRecorderPlayer, {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  OutputFormatAndroidType,
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
} from 'react-native-audio-recorder-player';
import * as FileSystem from 'expo-file-system/legacy';

const recorder = new AudioRecorderPlayer();

// Bridge to the native Android foreground service (see
// RecordingForegroundModule.kt). Undefined on iOS — guarded below.
const { RecordingForegroundModule } = NativeModules;

/**
 * Explicit format config instead of relying on library defaults.
 * MPEG_4 container + AAC encoder is the standard combination for a
 * properly finalized, widely-playable .m4a.
 */
const audioSet = {
  AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
  AudioSourceAndroid: AudioSourceAndroidType.MIC,
  OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
  AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
  AVFormatIDKeyIOS: AVEncodingOption.aac,
};

/**
 * Declaring RECORD_AUDIO in app.json/the manifest only makes the
 * permission available to request — Android 6+ still requires an
 * explicit RUNTIME request before use.
 */
async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const already = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
  );
  if (already) return true;

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: 'Microphone Permission',
      message: 'This app needs access to your microphone to record audio.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    }
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export function getRecordingUri() {
  return `${FileSystem.documentDirectory}live_recording.m4a`;
}

function toNativeRecorderPath(fileUri: string) {
  return Platform.OS === 'android'
    ? fileUri.replace('file://', '')
    : fileUri;
}

/**
 * Starts the native foreground service BEFORE the recorder, so the
 * process is already protected the moment recording begins — not just
 * once the user happens to background the app. No-ops on iOS (handled
 * there via AVAudioSession background mode instead, not this module —
 * see Phase 2 iOS notes).
 */
async function startForegroundProtection() {
  if (Platform.OS !== 'android') return;
  if (!RecordingForegroundModule) {
    console.warn(
      'RecordingForegroundModule not found — did you add the native ' +
        'files and rebuild (npx expo run:android)? JS-only reload is ' +
        'not enough for this change.'
    );
    return;
  }
  await RecordingForegroundModule.start();
}

async function stopForegroundProtection() {
  if (Platform.OS !== 'android' || !RecordingForegroundModule) return;
  await RecordingForegroundModule.stop();
}

/**
 * Phase 2: recording now stays protected through backgrounding, not
 * just foreground + locked screen. Still bounded by the hard OS limit
 * — a fully killed (swiped away) process cannot be kept alive by any
 * foreground service.
 */
export async function startRecording(
  onProgress?: (positionMs: number) => void
): Promise<string> {
  const granted = await ensureMicPermission();
  if (!granted) {
    throw new Error(
      'Microphone permission denied — enable it in Settings to record.'
    );
  }

  await startForegroundProtection();

  const fileUri = getRecordingUri();
  const dirInfo = await FileSystem.getInfoAsync(FileSystem.documentDirectory!);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory!, {
      intermediates: true,
    });
  }

  const nativePath = toNativeRecorderPath(fileUri);
  const uri = await recorder.startRecorder(nativePath, audioSet);
  recorder.addRecordBackListener((e) => {
    onProgress?.(e.currentPosition);
  });
  return uri;
}

export async function stopRecording(): Promise<string> {
  const result = await recorder.stopRecorder();
  recorder.removeRecordBackListener();
  await stopForegroundProtection();
  return result;
}

/**
 * Now specifically about the EXTRA Samsung/Xiaomi OEM-level exemption
 * (battery optimization) — the foreground service itself already
 * covers the baseline Android requirement from the moment recording
 * starts. This still matters because a foreground service alone does
 * NOT guarantee survival against OEM-specific aggressive killing.
 */
export function watchForBackgroundDuringRecording(
  isRecordingRef: { current: boolean },
  onNeedsBackgroundPermission: () => void
) {
  if (Platform.OS !== 'android') {
    return () => {};
  }
  const handler = (state: AppStateStatus) => {
    if (state !== 'active' && isRecordingRef.current) {
      onNeedsBackgroundPermission();
    }
  };
  const sub = AppState.addEventListener('change', handler);
  return () => sub.remove();
}

export function requestBackgroundRecordingPermission() {
  if (Platform.OS === 'android') {
    Linking.sendIntent('android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS');
  } else {
    Linking.openSettings();
  }
}
