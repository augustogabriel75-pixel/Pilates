package br.com.espacocativar.pilates;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;

/** Guarda e valida o endereço do servidor do Espaço Cativar. */
final class ServerConfig {
    private static final String PREFS = "cativar";
    private static final String KEY_URL = "server_url";

    private ServerConfig() {}

    static String get(Context ctx) {
        return prefs(ctx).getString(KEY_URL, null);
    }

    static void set(Context ctx, String url) {
        prefs(ctx).edit().putString(KEY_URL, url).apply();
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Normaliza o endereço digitado. Retorna null se for inválido. */
    static String normalize(String input) {
        if (input == null) return null;
        String s = input.trim();
        if (s.isEmpty()) return null;
        if (!s.startsWith("http://") && !s.startsWith("https://")) s = "https://" + s;
        while (s.endsWith("/")) s = s.substring(0, s.length() - 1);
        Uri u = Uri.parse(s);
        String host = u.getHost();
        if (host == null || host.isEmpty() || host.contains(" ")) return null;
        String path = u.getPath() == null ? "" : u.getPath();
        return u.getScheme() + "://" + u.getEncodedAuthority() + path;
    }

    /** Mesma origem (esquema + host + porta) do servidor configurado. */
    static boolean sameOrigin(Uri a, Uri b) {
        if (a == null || b == null || a.getScheme() == null || a.getHost() == null) return false;
        return a.getScheme().equalsIgnoreCase(b.getScheme())
                && a.getHost().equalsIgnoreCase(b.getHost())
                && port(a) == port(b);
    }

    private static int port(Uri u) {
        if (u.getPort() != -1) return u.getPort();
        return "https".equalsIgnoreCase(u.getScheme()) ? 443 : 80;
    }

    static boolean isLocalHttp(Uri u) {
        if (!"http".equalsIgnoreCase(u.getScheme())) return false;
        String h = u.getHost() == null ? "" : u.getHost();
        return h.equals("localhost") || h.startsWith("10.") || h.startsWith("192.168.")
                || h.matches("^172\\.(1[6-9]|2\\d|3[01])\\..*") || h.endsWith(".local");
    }
}
