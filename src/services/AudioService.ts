import * as FileSystem from 'expo-file-system';
import TrackPlayer, {
  Capability,
  RepeatMode,
  Event,
  State,
} from 'react-native-track-player';

// --- CONFIG: swap this for your real version-audio URL later ---
const REMOTE_AUDIO_URL =
  'https://storage.googleapis.com/sua-bhajnavali-audio/bholeaayehaidarpetere.mp3';
const LOCAL_FILE_NAME = 'version_audio.mp3';

export function getLocalFilePath() {
  return `${FileSystem.documentDirectory}${LOCAL_FILE_NAME}`;
}

/**
 * Downloads the audio file once and caches it on disk.
 * Subsequent app opens reuse the cached file instead of re-downloading —
 * mirrors what your Angular app already does, just with expo-file-system
 * instead of a Capacitor filesystem plugin.
 */
export async function ensureAudioDownloaded(
  onProgress?: (fraction: number) => void,
  remoteUrl: string = REMOTE_AUDIO_URL
): Promise<string> {
  const localPath = getLocalFilePath();
  const info = await FileSystem.getInfoAsync(localPath);
  if (info.exists) {
    return localPath;
  }

  const downloadResumable = FileSystem.createDownloadResumable(
    remoteUrl,
    localPath,
    {},
    (progressEvent) => {
      const fraction =
        progressEvent.totalBytesWritten /
        progressEvent.totalBytesExpectedToWrite;
      onProgress?.(fraction);
    }
  );

  const result = await downloadResumable.downloadAsync();
  if (!result) throw new Error('Download failed');
  return result.uri;
}

/** Deletes the cached file so a new URL actually gets re-downloaded. */
export async function clearCachedAudio() {
  const localPath = getLocalFilePath();
  const info = await FileSystem.getInfoAsync(localPath);
  if (info.exists) {
    await FileSystem.deleteAsync(localPath);
  }
}

let isPlayerSetup = false;

/**
 * One-time native player setup. Must run before adding tracks.
 */
export async function setupPlayerIfNeeded() {
  if (isPlayerSetup) return;
  await TrackPlayer.setupPlayer();
  await TrackPlayer.updateOptions({
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.Stop,
      Capability.SeekTo,
    ],
    compactCapabilities: [Capability.Play, Capability.Pause],
  });
  isPlayerSetup = true;
}

export async function loadTrack(localPath: string) {
  await TrackPlayer.reset();
  await TrackPlayer.add({
    id: 'version-audio',
    url: localPath,
    title: 'BHAJAN',
    artist: 'POC',
  });
}

export async function togglePlayPause() {
  const state = await TrackPlayer.getPlaybackState();
  if (state.state === State.Playing) {
    await TrackPlayer.pause();
  } else {
    await TrackPlayer.play();
  }
}

/**
 * RepeatMode.Track = replay the same track automatically on completion.
 * This is native-level looping — it keeps working even if the app
 * is backgrounded, which is exactly the case that broke under Capacitor.
 */
export async function setLoopEnabled(enabled: boolean) {
  await TrackPlayer.setRepeatMode(enabled ? RepeatMode.Track : RepeatMode.Off);
}

/**
 * Background service — required by TrackPlayer. Handles remote/lockscreen
 * controls. Keep this even if you don't wire up all events yet.
 */
export async function PlaybackService() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());
}
