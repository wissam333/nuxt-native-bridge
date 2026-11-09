package arselhawallet.com;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ThemePrefs")
public class ThemePrefsPlugin extends Plugin {

    private static final String PREFS = "app_prefs";
    private static final String KEY_DARK = "theme_dark";

    @PluginMethod
    public void setDark(PluginCall call) {
        Boolean dark = call.getBoolean("dark");
        if (dark == null) {
            call.reject("dark is required");
            return;
        }
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(KEY_DARK, dark).apply();
        call.resolve();
    }
}