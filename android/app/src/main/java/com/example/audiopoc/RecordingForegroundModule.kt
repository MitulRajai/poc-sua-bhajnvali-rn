// NEW FILE — place at:
// android/app/src/main/java/com/example/audiopoc/RecordingForegroundModule.kt
//
// Thin bridge so RecordingService.ts can start/stop the native
// foreground service from JS, right alongside the existing
// recorder.startRecorder()/stopRecorder() calls.

package com.example.audiopoc

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class RecordingForegroundModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "RecordingForegroundModule"

    @ReactMethod
    fun start(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, RecordingForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(intent)
            } else {
                reactApplicationContext.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("START_FAILED", e)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, RecordingForegroundService::class.java)
            reactApplicationContext.stopService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_FAILED", e)
        }
    }
}
