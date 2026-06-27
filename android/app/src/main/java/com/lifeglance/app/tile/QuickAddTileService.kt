package com.lifeglance.app.tile

import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.service.quicksettings.TileService
import com.lifeglance.app.MainActivity

/**
 * Quick Settings tile that opens lifeGLANCE straight into the "add milestone"
 * sheet — the same action the quick-add home-screen widget triggers.
 *
 * It launches MainActivity with the widget_action="new" extra, which
 * MainActivity.handleWidgetIntent() stashes for the web layer to consume on
 * resume (consumeWidgetLaunchTarget() → target.action === 'new' → AddMilestoneSheet).
 * No new deep-link/JS plumbing is needed: it reuses the existing contract.
 */
class QuickAddTileService : TileService() {

    override fun onClick() {
        super.onClick()

        val intent = Intent(this, MainActivity::class.java).apply {
            putExtra(MainActivity.EXTRA_WIDGET_ACTION, "new")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }

        // startActivityAndCollapse(Intent) throws on Android 14+ (this app targets
        // SDK 36); the PendingIntent overload (added in API 34) is required there.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val pending = PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            startActivityAndCollapse(pending)
        } else {
            @Suppress("DEPRECATION")
            startActivityAndCollapse(intent)
        }
    }
}
