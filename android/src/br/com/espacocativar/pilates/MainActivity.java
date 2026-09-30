package br.com.espacocativar.pilates;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

/**
 * Aplicativo Espaço Cativar Pilates: exibe o sistema web do estúdio em tela cheia.
 * A sessão (cookie HttpOnly) fica guardada pelo CookieManager do WebView.
 */
public class MainActivity extends Activity {
    static final String APP_SCHEME = "cativar-app";
    private static final int COPPER = 0xFFA86B45;

    private WebView web;
    private LinearLayout errorView;
    private TextView errorText;
    private ProgressBar progress;
    private String baseUrl;
    private Uri base;
    private boolean mainFrameFailed;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        baseUrl = ServerConfig.get(this);
        if (baseUrl == null) {
            openSetup();
            finish();
            return;
        }
        base = Uri.parse(baseUrl);

        FrameLayout root = new FrameLayout(this);
        web = new WebView(this);
        root.addView(web, match());

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setIndeterminate(true);
        progress.setIndeterminateTintList(android.content.res.ColorStateList.valueOf(COPPER));
        FrameLayout.LayoutParams plp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(4), Gravity.TOP);
        root.addView(progress, plp);

        errorView = buildErrorView();
        errorView.setVisibility(View.GONE);
        root.addView(errorView, match());
        setContentView(root);

        configureWebView();
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(baseUrl);
    }

    private void configureWebView() {
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setUserAgentString(s.getUserAgentString() + " CativarApp/" + BuildInfo.VERSION_NAME);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(web, false);

        // WebChromeClient habilita os diálogos confirm()/alert() usados pelo sistema.
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (APP_SCHEME.equals(url.getScheme())) {
                    openSetup();
                    return true;
                }
                if (ServerConfig.sameOrigin(url, base)) return false;
                // Links externos (WhatsApp, telefone, e-mail, outros sites) abrem fora do app.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (ActivityNotFoundException ignored) {
                }
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                mainFrameFailed = false;
                progress.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
                if (!mainFrameFailed) errorView.setVisibility(View.GONE);
                CookieManager.getInstance().flush();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError(String.valueOf(error.getDescription()));
            }

            @Override
            public void onReceivedSslError(WebView view, android.webkit.SslErrorHandler handler, android.net.http.SslError error) {
                handler.cancel(); // nunca aceita certificado inválido
                showError("Certificado de segurança (HTTPS) inválido.");
            }
        });
    }

    private void showError(String detail) {
        mainFrameFailed = true;
        progress.setVisibility(View.GONE);
        errorText.setText("Endereço: " + baseUrl + "\n\n" + detail
                + "\n\nVerifique sua conexão com a internet ou se o servidor do estúdio está ligado.");
        errorView.setVisibility(View.VISIBLE);
    }

    private LinearLayout buildErrorView() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setPadding(dp(32), dp(32), dp(32), dp(32));
        box.setBackgroundColor(isNight() ? 0xFF171514 : 0xFFFBF8F3);
        box.setClickable(true);

        TextView title = new TextView(this);
        title.setText("Não foi possível conectar");
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        title.setTextColor(isNight() ? 0xFFF5EEE3 : 0xFF211F1D);
        title.setGravity(Gravity.CENTER);
        box.addView(title);

        errorText = new TextView(this);
        errorText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        errorText.setTextColor(0xFF8A847E);
        errorText.setGravity(Gravity.CENTER);
        errorText.setPadding(0, dp(12), 0, dp(24));
        box.addView(errorText);

        Button retry = button("Tentar novamente", true);
        retry.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                errorView.setVisibility(View.GONE);
                String current = web.getUrl();
                if (current == null || current.startsWith("data:") || current.equals("about:blank")) web.loadUrl(baseUrl);
                else web.reload();
            }
        });
        box.addView(retry);

        Button change = button("Alterar servidor", false);
        change.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { openSetup(); }
        });
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(12);
        box.addView(change, lp);
        return box;
    }

    Button button(String text, boolean primary) {
        return styledButton(this, text, primary);
    }

    static Button styledButton(Activity a, String text, boolean primary) {
        Button b = new Button(a);
        b.setText(text);
        b.setAllCaps(false);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        float d = a.getResources().getDisplayMetrics().density;
        b.setPadding((int) (24 * d), (int) (12 * d), (int) (24 * d), (int) (12 * d));
        GradientDrawable bg = new GradientDrawable();
        bg.setCornerRadius(14 * d);
        if (primary) {
            bg.setColor(COPPER);
            b.setTextColor(Color.WHITE);
        } else {
            bg.setColor(Color.TRANSPARENT);
            bg.setStroke((int) (1 * d), 0xFFDCC4A0);
            b.setTextColor(COPPER);
        }
        b.setBackground(bg);
        b.setStateListAnimator(null);
        return b;
    }

    private void openSetup() {
        startActivity(new Intent(this, SetupActivity.class));
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Servidor alterado na tela de configuração: recarrega.
        String url = ServerConfig.get(this);
        if (url != null && web != null && !url.equals(baseUrl)) {
            baseUrl = url;
            base = Uri.parse(url);
            web.clearHistory();
            web.loadUrl(baseUrl);
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null && errorView.getVisibility() != View.VISIBLE && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
        if (web != null) web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }

    private boolean isNight() {
        return (getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK)
                == android.content.res.Configuration.UI_MODE_NIGHT_YES;
    }

    private int dp(int v) {
        return (int) (v * getResources().getDisplayMetrics().density);
    }

    private static FrameLayout.LayoutParams match() {
        return new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
    }
}
