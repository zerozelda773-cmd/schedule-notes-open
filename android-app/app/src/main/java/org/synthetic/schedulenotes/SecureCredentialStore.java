package org.synthetic.schedulenotes;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import org.json.JSONException;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class SecureCredentialStore {
    private static final String PREFS = "secure_cloud_credentials_v1";
    private static final String KEY_ALIAS = "work_progress_cloud_credentials_v1";
    private static final String EMAIL = "email";
    private static final String PASSWORD = "password_ciphertext";
    private static final String IV = "password_iv";
    private static final String REMEMBER_ACCOUNT = "remember_account";
    private static final String REMEMBER_PASSWORD = "remember_password";
    private final SharedPreferences preferences;

    SecureCredentialStore(Context context) {
        preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    synchronized void save(String email, String password, boolean rememberAccount, boolean rememberPassword) throws Exception {
        SharedPreferences.Editor editor = preferences.edit().clear()
            .putBoolean(REMEMBER_ACCOUNT, rememberAccount)
            .putBoolean(REMEMBER_PASSWORD, rememberPassword);
        if (rememberAccount) editor.putString(EMAIL, String.valueOf(email == null ? "" : email).trim());
        if (rememberPassword && password != null && !password.isEmpty()) {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
            byte[] encrypted = cipher.doFinal(password.getBytes(StandardCharsets.UTF_8));
            editor.putString(PASSWORD, Base64.encodeToString(encrypted, Base64.NO_WRAP));
            editor.putString(IV, Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP));
        }
        if (!editor.commit()) throw new IllegalStateException("安全凭据保存失败");
    }

    synchronized String loadJson() {
        JSONObject result = new JSONObject();
        boolean rememberAccount = preferences.getBoolean(REMEMBER_ACCOUNT, true);
        boolean rememberPassword = preferences.getBoolean(REMEMBER_PASSWORD, true);
        try {
            result.put("email", rememberAccount ? preferences.getString(EMAIL, "") : "");
            result.put("password", rememberPassword ? decryptPassword() : "");
            result.put("rememberAccount", rememberAccount);
            result.put("rememberPassword", rememberPassword);
            result.put("secure", true);
        } catch (Exception error) {
            preferences.edit().remove(PASSWORD).remove(IV).putBoolean(REMEMBER_PASSWORD, false).apply();
            try {
                result.put("password", "");
                result.put("rememberPassword", false);
                result.put("error", "已保存密码无法解密，请重新输入");
            } catch (JSONException ignored) { }
        }
        return result.toString();
    }

    synchronized void clear() {
        preferences.edit().clear().apply();
    }

    synchronized void clearPassword() {
        preferences.edit().remove(PASSWORD).remove(IV).putBoolean(REMEMBER_PASSWORD, false).apply();
    }

    private String decryptPassword() throws Exception {
        String ciphertext = preferences.getString(PASSWORD, "");
        String iv = preferences.getString(IV, "");
        if (ciphertext.isEmpty() || iv.isEmpty()) return "";
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
        return new String(cipher.doFinal(Base64.decode(ciphertext, Base64.NO_WRAP)), StandardCharsets.UTF_8);
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        java.security.Key existing = keyStore.getKey(KEY_ALIAS, null);
        if (existing instanceof SecretKey) return (SecretKey) existing;
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .build());
        return generator.generateKey();
    }
}
