//  1. New "My recording" section: shows the saved file's size, plays it
//     inside the app (no copying to a computer), and shows position/duration.
//  2. On launch it looks for a recording saved in an earlier session, so you
//     can replay it without recording again.
//  3. Small-file warning: a recording under ~5 KB is almost always silent/empty.
//  4. One shared player is used for both the downloaded audio and the
//     recording, so the app tracks which one is loaded ("activeSource") and
//     reloads the right file when you switch.
//  5. Uses 'expo-file-system/legacy' (SDK 57 path for the old file API).

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import TrackPlayer, {
  usePlaybackState,
  useProgress,
  State,
} from 'react-native-track-player';
import * as FileSystem from 'expo-file-system/legacy';
import {
  ensureAudioDownloaded,
  clearCachedAudio,
  setupPlayerIfNeeded,
  loadTrack,
  togglePlayPause,
  setLoopEnabled,
  getLocalFilePath,
} from './src/services/AudioService';
import {
  startRecording,
  stopRecording,
  getRecordingUri,
  watchForBackgroundDuringRecording,
  requestBackgroundRecordingPermission,
} from './src/services/RecordingService';

const DEFAULT_URL =
  'https://storage.googleapis.com/sua-bhajnavali-audio/bholeaayehaidarpetere.mp3';

// Under this size a recording is almost certainly empty/silent.
const SUSPICIOUSLY_SMALL_BYTES = 5 * 1024;

type Source = 'download' | 'recording' | null;

function fmtTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function fmtSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    : `${(bytes / 1024).toFixed(1)} KB`;
}

export default function App() {
  // --- Download / playback state ---
  const [urlInput, setUrlInput] = useState(DEFAULT_URL);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isLoop, setIsLoop] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<Source>(null);

  const playbackState = usePlaybackState();
  const progress = useProgress(500);
  const isPlaying = playbackState.state === State.Playing;

  // --- Recording state ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingSize, setRecordingSize] = useState<number | null>(null);
  const isRecordingRef = useRef(false);

  const refreshRecordingInfo = useCallback(async () => {
    const uri = getRecordingUri();
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      setRecordingUri(uri);
      setRecordingSize(info.size ?? 0);
    } else {
      setRecordingUri(null);
      setRecordingSize(null);
    }
  }, []);

  useEffect(() => {
    setupPlayerIfNeeded().catch((e) => setError(e?.message));
    // Pick up a recording saved in an earlier session.
    refreshRecordingInfo().catch(() => {});
  }, [refreshRecordingInfo]);

  // Only prompt for the background-recording exemption once it's relevant.
  useEffect(() => {
    const unwatch = watchForBackgroundDuringRecording(isRecordingRef, () => {
      Alert.alert(
        'Keep recording in the background?',
        'To keep recording while the app is backgrounded, some phones (Samsung, Xiaomi) also need a battery setting changed so the system does not stop the recording.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Allow', onPress: () => requestBackgroundRecordingPermission() },
        ]
      );
    });
    return unwatch;
  }, []);

  const onDownloadPress = useCallback(async () => {
    setError(null);
    setIsDownloading(true);
    setDownloadProgress(0);
    try {
      await clearCachedAudio();
      const localPath = await ensureAudioDownloaded(setDownloadProgress, urlInput);
      await loadTrack(localPath);
      setActiveSource('download');
      setIsDownloaded(true);
    } catch (e: any) {
      setError(e?.message ?? 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  }, [urlInput]);

  // Play/pause the DOWNLOADED audio. If the recording is loaded, switch back.
  const onPlayPausePress = useCallback(async () => {
    if (activeSource !== 'download') {
      await loadTrack(getLocalFilePath());
      setActiveSource('download');
      await TrackPlayer.play();
      return;
    }
    await togglePlayPause();
  }, [activeSource]);

  // Play/pause the RECORDING inside the app.
  const onPlayRecordingPress = useCallback(async () => {
    if (!recordingUri) return;
    try {
      if (activeSource !== 'recording') {
        await loadTrack(recordingUri, 'recording', 'My Recording');
        setActiveSource('recording');
        await TrackPlayer.play();
      } else {
        await togglePlayPause();
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not play the recording');
    }
  }, [recordingUri, activeSource]);

  const onLoopPress = useCallback(async () => {
    const next = !isLoop;
    setIsLoop(next);
    await setLoopEnabled(next);
  }, [isLoop]);

  const onRecordPress = useCallback(async () => {
    try {
      if (isRecording) {
        await stopRecording();
        isRecordingRef.current = false;
        setIsRecording(false);
        // The file changed on disk, so force a reload on the next play.
        setActiveSource((prev) => (prev === 'recording' ? null : prev));
        await refreshRecordingInfo();
        const info = await FileSystem.getInfoAsync(getRecordingUri());
        const size = info.exists ? info.size ?? 0 : 0;
        Alert.alert(
          'Recording saved',
          size < SUSPICIOUSLY_SMALL_BYTES
            ? `Only ${fmtSize(size)}. That is very small, so the recording may be empty. Check the microphone permission.`
            : `Size: ${fmtSize(size)}. Use "Play recording" below to listen.`
        );
      } else {
        await startRecording((ms) => setRecordMs(ms));
        isRecordingRef.current = true;
        setIsRecording(true);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Recording failed');
    }
  }, [isRecording, refreshRecordingInfo]);

  const recordingIsPlaying = isPlaying && activeSource === 'recording';
  const downloadIsPlaying = isPlaying && activeSource === 'download';
  const small =
    recordingSize !== null && recordingSize < SUSPICIOUSLY_SMALL_BYTES;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Audio Playback + Recording POC</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        {/* --- Download section --- */}
        <Text style={styles.sectionLabel}>Audio URL</Text>
        <TextInput
          style={styles.input}
          value={urlInput}
          onChangeText={setUrlInput}
          placeholder="https://…/audio.mp3"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={styles.button}
          onPress={onDownloadPress}
          disabled={isDownloading}
        >
          <Text style={styles.buttonText}>
            {isDownloading ? 'Downloading…' : 'Download'}
          </Text>
        </TouchableOpacity>
        {isDownloading && (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={styles.progressText}>
              {Math.round(downloadProgress * 100)}%
            </Text>
          </View>
        )}

        {/* --- Downloaded audio playback --- */}
        {isDownloaded && (
          <View style={styles.controls}>
            <Text style={styles.sectionLabel}>Downloaded audio</Text>
            <TouchableOpacity style={styles.button} onPress={onPlayPausePress}>
              <Text style={styles.buttonText}>
                {downloadIsPlaying ? 'Pause' : 'Play'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, isLoop && styles.buttonActive]}
              onPress={onLoopPress}
            >
              <Text style={styles.buttonText}>
                Loop: {isLoop ? 'On' : 'Off'}
              </Text>
            </TouchableOpacity>
            {activeSource === 'download' && (
              <Text style={styles.hint}>
                {fmtTime(progress.position)} / {fmtTime(progress.duration)}
              </Text>
            )}
            <Text style={styles.hint}>
              Lock the screen or background the app while playing. A
              lock-screen control should appear and playback/looping should
              continue.
            </Text>
          </View>
        )}

        {/* --- Recording section --- */}
        <View style={styles.controls}>
          <Text style={styles.sectionLabel}>Recording</Text>
          <TouchableOpacity
            style={[styles.button, isRecording && styles.buttonRecording]}
            onPress={onRecordPress}
          >
            <Text style={styles.buttonText}>
              {isRecording
                ? `Stop (${Math.round(recordMs / 1000)}s)`
                : 'Start Recording'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.hint}>
            Locking the screen keeps recording going. Wait for the "Recording
            saved" alert after tapping Stop.
          </Text>
        </View>

        {/* --- My recording: view + play inside the app --- */}
        <View style={styles.controls}>
          <Text style={styles.sectionLabel}>My recording</Text>
          {recordingUri ? (
            <>
              <Text style={[styles.hint, small && styles.warn]}>
                Saved file: {fmtSize(recordingSize ?? 0)}
                {small ? '  (very small, may be empty)' : ''}
              </Text>
              <TouchableOpacity
                style={[styles.button, styles.buttonPurple]}
                onPress={onPlayRecordingPress}
                disabled={isRecording}
              >
                <Text style={styles.buttonText}>
                  {recordingIsPlaying ? 'Pause recording' : 'Play recording'}
                </Text>
              </TouchableOpacity>
              {activeSource === 'recording' && (
                <Text style={styles.hint}>
                  {fmtTime(progress.position)} / {fmtTime(progress.duration)}
                </Text>
              )}
            </>
          ) : (
            <Text style={styles.hint}>No recording saved yet.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, gap: 8 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#444', marginTop: 16, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  center: { alignItems: 'center', gap: 8, marginTop: 8 },
  progressText: { fontSize: 14 },
  error: { color: 'red', textAlign: 'center', marginBottom: 12 },
  controls: { gap: 12 },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonActive: { backgroundColor: '#16a34a' },
  buttonRecording: { backgroundColor: '#dc2626' },
  buttonPurple: { backgroundColor: '#7c3aed' },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 13, color: '#666' },
  warn: { color: '#b45309', fontWeight: '600' },
});
