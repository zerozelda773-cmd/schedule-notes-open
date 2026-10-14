package org.synthetic.schedulenotes;

import android.app.Activity;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.WebView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Locale;

final class MorningBriefSpeaker {
    private final Activity activity;
    private final WebView webView;
    private TextToSpeech speech;
    private boolean ready;
    private String pendingText;
    private volatile int generation;

    MorningBriefSpeaker(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    void start() {
        activity.runOnUiThread(() -> {
            final int request = ++generation;

            webView.evaluateJavascript("(function(){try{var task=document.getElementById('taskView');var brief=task&&task.querySelector('.briefing');return task&&!task.hidden&&brief&&!brief.hidden&&typeof briefingText==='function'?briefingText():'';}catch(error){return '';}})()", value -> {
                if (request != generation) return;
                try {
                    String text = new JSONArray("[" + value + "]").getString(0).trim();
                    if (text.isEmpty() || text.length() > 4000) throw new IllegalArgumentException("Invalid morning brief");
                    pendingText = text;
                    if (speech == null) {
                        speech = new TextToSpeech(activity, status -> activity.runOnUiThread(() -> {
                            if (status != TextToSpeech.SUCCESS || speech == null) { failEngine(); return; }
                            int language = speech.setLanguage(Locale.SIMPLIFIED_CHINESE);
                            if (language == TextToSpeech.LANG_MISSING_DATA || language == TextToSpeech.LANG_NOT_SUPPORTED) { failEngine(); return; }
                            speech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                                @Override public void onStart(String id) { if (id.equals("morning-brief-" + generation)) state("speaking"); }
                                @Override public void onDone(String id) { if (id.equals("morning-brief-" + generation)) state("idle"); }
                                @Override public void onError(String id) { if (id.equals("morning-brief-" + generation)) state("error"); }
                            });
                            ready = true;
                            speakPending(generation);
                        }));
                    } else if (ready) speakPending(request);
                } catch (Exception invalid) {
                    state("error");
                }
            });
        });
    }

    private void speakPending(int request) {
        if (request != generation || pendingText == null || speech == null) return;
        String text = pendingText;
        pendingText = null;
        if (speech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "morning-brief-" + request) == TextToSpeech.ERROR) state("error");
    }

    private void failEngine() {
        pendingText = null;
        ready = false;
        if (speech != null) speech.shutdown();
        speech = null;
        state("error");
    }

    void stop() {
        activity.runOnUiThread(() -> {
            generation++;
            pendingText = null;
            if (speech != null) speech.stop();
            state("idle");
        });
    }

    void destroy() {
        generation++;
        pendingText = null;
        if (speech != null) speech.shutdown();
        speech = null;
    }

    private void state(String value) {
        activity.runOnUiThread(() -> webView.evaluateJavascript("window.MorningBriefSpeech&&window.MorningBriefSpeech.onState(" + JSONObject.quote(value) + ")", null));
    }
}
