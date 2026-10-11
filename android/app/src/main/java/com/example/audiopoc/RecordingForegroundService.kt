// NEW FILE — place at:
// android/app/src/main/java/com/example/audiopoc/RecordingForegroundService.kt
//
// This service's only job is to tell Android "a real, user-visible
// recording is in progress" via the mandatory persistent notification.
// It does NOT do the actual audio capture itself — that's still
// react-native-audio-recorder-player, running as before. What this adds
// is the thing Android requires to NOT kill the process while
// backgrounded during an active microphone recording (Android 14+
// specifically requires the service be typed "microphone" or the OS
// will throw a SecurityException and refuse to start it at all).

package com.example.audiopoc

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class RecordingForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "recording_channel"
        const val NOTIFICATION_ID = 1001
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // FOREGROUND_SERVICE_TYPE_MICROPHONE is required on Android 10+
            // for a service that uses the mic; Android 14 (API 34) enforces
            // this strictly — omitting it causes a runtime crash on 14+.
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Recording in progress")
            .setContentText("Your audio is being recorded")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Recording",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }
}
