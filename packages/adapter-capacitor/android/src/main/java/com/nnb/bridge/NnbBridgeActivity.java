package com.nnb.bridge;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

/**
 * NNB bridge activity: launch-theme selection from ThemePrefs, edge-to-edge
 * and contrast flags in ONE native path (audit 17/18). App MainActivitys
 * extend this and only register app-local plugins.
 *
 * Launch themes are APP resources generated from brand/splash config by
 * `nnb sync` under fixed names (AppTheme_NoActionBarLaunch / ...Dark) —
 * resolved by convention with getIdentifier, since a library cannot
 * reference the app's R class.
 */
public class NnbBridgeActivity extends BridgeActivity {
    static final String PREFS = "app_prefs";
    static final String KEY_DARK = "theme_dark";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Theme BEFORE super.onCreate: applies at window creation, so the
        // launch theme is correct before the window exists (spec §6.3). The
        // theme choice is app-internal (ThemePrefs), not the system setting.
        SharedPreferences prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        boolean dark = prefs.getBoolean(KEY_DARK, false);
        int theme = getResources().getIdentifier(
            dark ? "AppTheme_NoActionBarLaunchDark" : "AppTheme_NoActionBarLaunch",
            "style",
            getPackageName()
        );
        if (theme > 0) {
            setTheme(theme);
        }

        super.onCreate(savedInstanceState);

        // Insets provider for useNativeSafeArea (audit 20) — registered by the
        // bridge itself, app code never wires it.
        registerPlugin(NnbInsetsPlugin.class);

        // Edge-to-edge (one native path; CSS handles the rest) and the
        // contrast values the starter tuned (both flags off).
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
    }
}
