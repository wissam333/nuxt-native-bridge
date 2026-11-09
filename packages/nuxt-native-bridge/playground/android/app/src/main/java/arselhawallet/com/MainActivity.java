package arselhawallet.com;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  private static final String PREFS = "app_prefs";
  private static final String KEY_DARK = "theme_dark";

  @Override
  public void onCreate(Bundle savedInstanceState) {
    // Splash theme must be applied before the window is created, using the
    // user's app-level theme (persisted by ThemePrefsPlugin via the <html> JS),
    // NOT the system dark-mode setting.
    SharedPreferences prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    boolean dark = prefs.getBoolean(KEY_DARK, false);
    setTheme(dark ? R.style.AppTheme_NoActionBarLaunchDark : R.style.AppTheme_NoActionBarLaunch);

    registerPlugin(FileSavePlugin.class);
    registerPlugin(ThemePrefsPlugin.class);
    super.onCreate(savedInstanceState);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      getWindow().setStatusBarContrastEnforced(false);
      getWindow().setNavigationBarContrastEnforced(false);
    }
  }

  public void onPermissionRequest(PermissionRequest request) {
    request.grant(request.getResources());
  }
}