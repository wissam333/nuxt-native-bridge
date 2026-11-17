package com.nnb.bridge;

import android.app.Activity;
import android.graphics.Insets;
import android.os.Build;
import android.view.WindowInsets;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Real safe-area insets for the one CSS-token writer (audit 20). systemBars
 * is API 29+; older devices fall back to the legacy system window insets.
 */
@CapacitorPlugin(name = "NnbInsets")
public class NnbInsetsPlugin extends Plugin {

    @PluginMethod
    public void getInsets(PluginCall call) {
        JSObject res = new JSObject();
        Activity activity = bridge.getActivity();
        WindowInsets wi = activity.getWindow().getDecorView().getRootWindowInsets();
        if (wi == null) {
            res.put("top", 0);
            res.put("bottom", 0);
        }
        else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            Insets sys = wi.getInsets(WindowInsets.Type.systemBars());
            Insets cut = wi.getInsets(WindowInsets.Type.displayCutout());
            res.put("top", Math.max(sys.top, cut.top));
            res.put("bottom", sys.bottom);
        }
        else {
            res.put("top", wi.getSystemWindowInsetTop());
            res.put("bottom", wi.getSystemWindowInsetBottom());
        }
        call.resolve(res);
    }
}
