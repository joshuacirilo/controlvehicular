package com.example.control_vehicular

import android.content.Context
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.embedding.engine.FlutterEngineCache
import io.flutter.embedding.engine.dart.DartExecutor

/**
 * One Flutter engine lives as long as the process. Removing the app from recents destroys only
 * this activity, so an active trip keeps sampling through geolocator's foreground service, and
 * reopening the app attaches to the same running state.
 */
class MainActivity : FlutterActivity() {
    override fun provideFlutterEngine(context: Context): FlutterEngine {
        val cache = FlutterEngineCache.getInstance()
        return cache.get(ENGINE_ID) ?: FlutterEngine(context.applicationContext).also {
            it.dartExecutor.executeDartEntrypoint(DartExecutor.DartEntrypoint.createDefault())
            cache.put(ENGINE_ID, it)
        }
    }

    override fun shouldDestroyEngineWithHost(): Boolean = false

    private companion object {
        const val ENGINE_ID = "main"
    }
}
