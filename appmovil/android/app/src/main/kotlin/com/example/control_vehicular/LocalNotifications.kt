package com.example.control_vehicular

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * "Trip assigned" and "resume your paused trip" notifications. Bound to the process-wide engine
 * with the application context, so they still work after the activity is removed from recents.
 */
object LocalNotifications {
    private const val ASSIGNMENTS = "trip_assignments"
    private const val PAUSE = "trip_pause"

    /** A single reminder that each new one replaces instead of stacking. */
    private const val PAUSE_NOTIFICATION_ID = 0x50415553

    fun register(engine: FlutterEngine, context: Context) {
        MethodChannel(engine.dartExecutor.binaryMessenger, "control_vehicular/notifications").setMethodCallHandler { call, result ->
            val title = call.argument<String>("title") ?: ""
            val body = call.argument<String>("body") ?: ""
            when (call.method) {
                "showAssignment" -> {
                    val id = call.argument<String>("id")
                    if (id == null) {
                        result.error("ARGS", "Missing id", null)
                        return@setMethodCallHandler
                    }
                    show(context, ASSIGNMENTS, "Viajes asignados", id.hashCode(), title, body)
                }
                "showPauseReminder" -> show(context, PAUSE, "Recordatorios de pausa", PAUSE_NOTIFICATION_ID, title, body)
                else -> {
                    result.notImplemented()
                    return@setMethodCallHandler
                }
            }
            result.success(null)
        }
    }

    @Suppress("DEPRECATION")
    private fun show(context: Context, channel: String, channelName: String, id: Int, title: String, body: String) {
        val manager = context.getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(NotificationChannel(channel, channelName, NotificationManager.IMPORTANCE_HIGH))
        }
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val open = launch?.let {
            PendingIntent.getActivity(context, id, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        }
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, channel)
        else Notification.Builder(context).setPriority(Notification.PRIORITY_HIGH)
        val notification = builder
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(0xFF01215A.toInt())
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(Notification.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(open)
            .build()
        // Without POST_NOTIFICATIONS (Android 13+) the system drops it; the app still shows the state on screen.
        manager.notify(id, notification)
    }
}
