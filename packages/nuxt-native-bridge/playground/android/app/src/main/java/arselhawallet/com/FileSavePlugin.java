package arselhawallet.com;

import android.content.Context;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;
import android.util.Base64;
import java.io.File;
import java.io.FileOutputStream;

@CapacitorPlugin(name = "FileSave")
public class FileSavePlugin extends Plugin {

    @PluginMethod
    public void saveToCache(PluginCall call) {
        String base64Data = call.getString("data");
        String fileName   = call.getString("fileName", "invoice.png");

        try {
            if (base64Data != null && base64Data.contains(",")) {
                base64Data = base64Data.split(",")[1];
            }

            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);

            Context ctx = getContext();
            
            // Use external cache dir — readable by other apps without FileProvider
            File cacheDir = ctx.getExternalCacheDir();
            if (cacheDir == null) cacheDir = ctx.getCacheDir(); // fallback
            
            File outFile = new File(cacheDir, fileName);

            FileOutputStream fos = new FileOutputStream(outFile);
            fos.write(bytes);
            fos.flush();
            fos.close();

            // Use file:// URI directly — works with external cache
            String fileUri = "file://" + outFile.getAbsolutePath();

            JSObject result = new JSObject();
            result.put("uri", fileUri);
            result.put("path", outFile.getAbsolutePath());
            call.resolve(result);

        } catch (Exception e) {
            call.reject("FileSave failed: " + e.getMessage());
        }
    }
}