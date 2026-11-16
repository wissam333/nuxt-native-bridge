package com.nnb.playground;

import android.os.Bundle;
import com.nnb.bridge.NnbBridgeActivity;

/** Thin app shell: theme, edge-to-edge and insets live in the nnb-bridge library. */
public class MainActivity extends NnbBridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    // App-local plugins register here until the nnb package absorbs them.
    registerPlugin(ThemePrefsPlugin.class);
    registerPlugin(FileSavePlugin.class);
    super.onCreate(savedInstanceState);
  }
}
