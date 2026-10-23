package com.example.control_vehicular

import android.content.Context
import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.app.NotificationManager
import io.flutter.plugin.common.MethodChannel
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
    private var permissionReply: MethodChannel.Result? = null
    private var permissionChannel: MethodChannel? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        permissionChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "control_vehicular/permissions").also { channel ->
            channel.setMethodCallHandler { call, result ->
                when (call.method) {
                    "check" -> result.success(permissionState())
                    "request" -> {
                        if (permissionReply != null) {
                            result.error("BUSY", "Permission request in progress", null)
                        } else {
                            val required = mutableListOf(Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.CAMERA)
                            if (Build.VERSION.SDK_INT >= 33) required.add(Manifest.permission.POST_NOTIFICATIONS)
                            val missing = required.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }.toMutableList()
                            // Android 12 requires both location permissions when upgrading approximate access.
                            if (missing.contains(Manifest.permission.ACCESS_FINE_LOCATION) &&
                                !missing.contains(Manifest.permission.ACCESS_COARSE_LOCATION)) missing.add(Manifest.permission.ACCESS_COARSE_LOCATION)
                            if (missing.isEmpty()) result.success(permissionState())
                            else {
                                permissionReply = result
                                requestPermissions(missing.toTypedArray(), 9071)
                            }
                        }
                    }
                    else -> result.notImplemented()
                }
            }
        }
    }

    private fun permissionState(): Map<String, Boolean> = mapOf(
        "location" to (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED),
        "camera" to (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED),
        "notifications" to (if (Build.VERSION.SDK_INT >= 24)
            getSystemService(NotificationManager::class.java).areNotificationsEnabled() else true)
    )

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 9071) {
            permissionReply?.success(permissionState())
            permissionReply = null
        }
    }

    override fun cleanUpFlutterEngine(flutterEngine: FlutterEngine) {
        permissionChannel?.setMethodCallHandler(null)
        permissionReply?.error("DETACHED", "Activity closed", null)
        permissionReply = null
        super.cleanUpFlutterEngine(flutterEngine)
    }
    override fun provideFlutterEngine(context: Context): FlutterEngine {
        val cache = FlutterEngineCache.getInstance()
        return cache.get(ENGINE_ID) ?: FlutterEngine(context.applicationContext).also {
            LocalNotifications.register(it, context.applicationContext)
            it.dartExecutor.executeDartEntrypoint(DartExecutor.DartEntrypoint.createDefault())
            cache.put(ENGINE_ID, it)
        }
    }

    override fun shouldDestroyEngineWithHost(): Boolean = false

    private companion object {
        const val ENGINE_ID = "main"
    }
}
