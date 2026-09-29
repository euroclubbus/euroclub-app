package com.eclub.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Кеп (29.09): локальний плагін Meta App Events — реєструємо ДО super.onCreate.
        registerPlugin(MetaEventsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
