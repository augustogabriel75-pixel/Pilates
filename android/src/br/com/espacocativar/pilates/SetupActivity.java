package br.com.espacocativar.pilates;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** Primeira execução / "Alterar servidor": define o endereço do sistema do estúdio. */
public class SetupActivity extends Activity {
    private EditText input;
    private TextView error;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        boolean night = (getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK)
                == android.content.res.Configuration.UI_MODE_NIGHT_YES;
        int textColor = night ? 0xFFF5EEE3 : 0xFF211F1D;

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER_HORIZONTAL | Gravity.CENTER_VERTICAL);
        box.setPadding(dp(28), dp(40), dp(28), dp(40));
        scroll.addView(box, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        ImageView logo = new ImageView(this);
        logo.setImageDrawable(getDrawable(R.mipmap.ic_launcher));
        box.addView(logo, new LinearLayout.LayoutParams(dp(96), dp(96)));

        TextView title = new TextView(this);
        title.setText("Espaço Cativar Pilates");
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 26);
        title.setTextColor(textColor);
        title.setTypeface(android.graphics.Typeface.SERIF, android.graphics.Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, dp(16), 0, dp(4));
        box.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText("Fisioterapia & Pilates");
        subtitle.setTextColor(0xFFA86B45);
        subtitle.setLetterSpacing(0.2f);
        subtitle.setGravity(Gravity.CENTER);
        box.addView(subtitle);

        TextView label = new TextView(this);
        label.setText("Endereço do servidor do estúdio");
        label.setTextColor(0xFF8A847E);
        label.setPadding(0, dp(36), 0, dp(8));
        box.addView(label, fullWidth());

        input = new EditText(this);
        input.setHint("https://cativar.seudominio.com.br");
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setImeOptions(EditorInfo.IME_ACTION_GO);
        input.setTextColor(textColor);
        String current = ServerConfig.get(this);
        input.setText(current != null ? current : "https://");
        input.setSelection(input.getText().length());
        input.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            @Override public boolean onEditorAction(TextView v, int actionId, KeyEvent event) {
                save();
                return true;
            }
        });
        box.addView(input, fullWidth());

        error = new TextView(this);
        error.setTextColor(0xFFDC2626);
        error.setPadding(0, dp(6), 0, 0);
        box.addView(error, fullWidth());

        TextView hint = new TextView(this);
        hint.setText("Peça o endereço ao estúdio. Na internet use https://. "
                + "Na rede Wi-Fi do estúdio pode ser algo como http://192.168.0.10:3000");
        hint.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        hint.setTextColor(0xFF8A847E);
        hint.setPadding(0, dp(8), 0, dp(24));
        box.addView(hint, fullWidth());

        android.widget.Button go = MainActivity.styledButton(this, "Conectar", true);
        go.setOnClickListener(new android.view.View.OnClickListener() {
            @Override public void onClick(android.view.View v) { save(); }
        });
        box.addView(go, fullWidth());

        TextView version = new TextView(this);
        version.setText("Versão " + BuildInfo.VERSION_NAME);
        version.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        version.setTextColor(0xFFA19B95);
        version.setGravity(Gravity.CENTER);
        version.setPadding(0, dp(24), 0, 0);
        box.addView(version, fullWidth());

        setContentView(scroll);
    }

    private void save() {
        final String url = ServerConfig.normalize(input.getText().toString());
        if (url == null) {
            error.setText("Endereço inválido.");
            return;
        }
        Uri u = Uri.parse(url);
        if ("http".equals(u.getScheme()) && !ServerConfig.isLocalHttp(u)) {
            new AlertDialog.Builder(this)
                    .setTitle("Conexão sem criptografia")
                    .setMessage("Este endereço usa http:// fora da rede local. Seus dados e senha podem ser interceptados. "
                            + "Recomendamos usar https://. Deseja continuar mesmo assim?")
                    .setNegativeButton("Voltar", null)
                    .setPositiveButton("Continuar", new DialogInterface.OnClickListener() {
                        @Override public void onClick(DialogInterface d, int w) { commit(url); }
                    })
                    .show();
            return;
        }
        commit(url);
    }

    private void commit(String url) {
        ServerConfig.set(this, url);
        Intent i = new Intent(this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(i);
        finish();
    }

    private LinearLayout.LayoutParams fullWidth() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    private int dp(int v) {
        return (int) (v * getResources().getDisplayMetrics().density);
    }
}
