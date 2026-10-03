import { registerRootComponent } from 'expo';
import TrackPlayer from 'react-native-track-player';
import App from './App';
import { PlaybackService } from './src/services/AudioService';

// This registers the background service that keeps audio alive
// when the app is backgrounded or the screen is off.
// This is the piece Capacitor's WebView <audio> tag cannot do.
TrackPlayer.registerPlaybackService(() => PlaybackService);

registerRootComponent(App);
