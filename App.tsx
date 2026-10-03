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
import { usePlaybackState, State } from 'react-native-track-player';
import {
  ensureAudioDownloaded,
  clearCachedAudio,
  setupPlayerIfNeeded,
  loadTrack,
  togglePlayPause,
  setLoopEnabled,
} from './src/services/AudioService';
import {
  startRecording,
  stopRecording,
  watchForBackgroundDuringRecording,
  requestBackgroundRecordingPermission,
} from './src/services/RecordingService';

const DEFAULT_URL =
  'https://storage.googleapis.com/sua-bhajnavali-audio/bholeaayehaidarpetere.mp3';

export default function App() {
  // --- Playback state ---
  const [urlInput, setUrlInput] = useState(DEFAULT_URL);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isLoop, setIsLoop] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playbackState = usePlaybackState();
  const isPlaying = playbackState.state === State.Playing;

  // --- Recording state ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    setupPlayerIfNeeded().catch((e) => setError(e?.message));
  }, []);

  // Only prompt for the background-recording permission once it's
  // actually relevant: the user backgrounded the app WHILE recording.
  useEffect(() => {
    const unwatch = watchForBackgroundDuringRecording(
      isRecordingRef,
      () => {
        Alert.alert(
          'Keep recording in the background?',
          'To keep streaming while the app is backgrounded, this app needs an extra permission. Some phones (Samsung, Xiaomi) may also need a manual setting change to avoid the recording being stopped by the system.',
          [
            { text: 'Not now', style: 'cancel' },
            {
              text: 'Allow',
              onPress: () => requestBackgroundRecordingPermission(),
            },
          ]
        );
      }
    );
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
      setIsDownloaded(true);
    } catch (e: any) {
      setError(e?.message ?? 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  }, [urlInput]);

  const onPlayPausePress = useCallback(() => {
    togglePlayPause();
  }, []);

  const onLoopPress = useCallback(async () => {
    const next = !isLoop;
    setIsLoop(next);
    await setLoopEnabled(next);
  }, [isLoop]);

  const onRecordPress = useCallback(async () => {
    try {
      if (isRecording) {
        const path = await stopRecording();
        isRecordingRef.current = false;
        setIsRecording(false);
        Alert.alert('Recording saved', path);
      } else {
        await startRecording((ms) => setRecordMs(ms));
        isRecordingRef.current = true;
        setIsRecording(true);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Recording failed');
    }
  }, [isRecording]);

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

        {/* --- Playback section --- */}
        {isDownloaded && (
          <View style={styles.controls}>
            <Text style={styles.sectionLabel}>Playback</Text>
            <TouchableOpacity style={styles.button} onPress={onPlayPausePress}>
              <Text style={styles.buttonText}>
                {isPlaying ? 'Pause' : 'Play'}
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
            <Text style={styles.hint}>
              Lock the screen or background the app while playing — a
              lock-screen media control should appear and playback/looping
              should continue.
            </Text>
          </View>
        )}

        {/* --- Recording section --- */}
        <View style={styles.controls}>
          <Text style={styles.sectionLabel}>Recording (phase 1: foreground + locked screen)</Text>
          <TouchableOpacity
            style={[styles.button, isRecording && styles.buttonRecording]}
            onPress={onRecordPress}
          >
            <Text style={styles.buttonText}>
              {isRecording ? `Stop (${Math.round(recordMs / 1000)}s)` : 'Start Recording'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.hint}>
            Locking the screen while recording should keep going — that
            doesn't background the app. Fully backgrounding the app while
            recording will prompt for the extra permission needed to
            continue.
          </Text>
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
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 13, color: '#666' },
});
