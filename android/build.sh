#!/usr/bin/env bash
# Gera o APK do aplicativo Espaço Cativar Pilates sem Android Studio/Gradle.
#
# Requisitos (Ubuntu/Debian):  sudo apt-get install -y openjdk-17-jdk aapt zipalign apksigner dalvik-exchange
#
# Assinatura: usa o keystore em $KEYSTORE (padrão: android/keystore/cativar-release.jks).
# Se não existir, um novo é criado e a senha é salva em android/keystore/keystore.properties.
# ⚠️  Guarde o keystore com segurança: atualizações do app PRECISAM ser assinadas com a mesma chave.
set -euo pipefail
cd "$(dirname "$0")"

# shellcheck disable=SC1091
source version.properties
MIN_SDK=26
TARGET_SDK=34
BUILD=.build
DIST=dist
ANDROID_JAR="${ANDROID_JAR:-$BUILD/android-$TARGET_SDK.jar}"
ANDROID_JAR_URL="https://raw.githubusercontent.com/Sable/android-platforms/master/android-$TARGET_SDK/android.jar"
ANDROID_JAR_SHA256="6cea1df3efb77103ac3e2beb9bf4718964b0e0869ab16d39d29d5cbae1c147ad"
KEYSTORE="${KEYSTORE:-keystore/cativar-release.jks}"
KEY_ALIAS="${KEY_ALIAS:-cativar}"
APK_NAME="EspacoCativarPilates-v$VERSION_NAME.apk"

for tool in javac aapt2 dalvik-exchange zipalign apksigner keytool; do
  command -v "$tool" >/dev/null || { echo "✖ Ferramenta ausente: $tool"; exit 1; }
done

mkdir -p "$BUILD" "$DIST"
if [ ! -f "$ANDROID_JAR" ]; then
  echo "• Baixando android.jar (API $TARGET_SDK)…"
  curl -fsSL -o "$ANDROID_JAR" "$ANDROID_JAR_URL"
fi
echo "$ANDROID_JAR_SHA256  $ANDROID_JAR" | sha256sum -c --quiet - || { echo "✖ android.jar com checksum inesperado"; exit 1; }

rm -rf "$BUILD/gen" "$BUILD/obj" "$BUILD"/*.apk "$BUILD"/*.zip "$BUILD"/*.dex
mkdir -p "$BUILD/gen/br/com/espacocativar/pilates" "$BUILD/obj"

echo "• Compilando recursos…"
aapt2 compile --dir res -o "$BUILD/res.zip"
aapt2 link -I "$ANDROID_JAR" --manifest AndroidManifest.xml "$BUILD/res.zip" \
  --min-sdk-version "$MIN_SDK" --target-sdk-version "$TARGET_SDK" \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  --java "$BUILD/gen" -o "$BUILD/unsigned.apk"

cat > "$BUILD/gen/br/com/espacocativar/pilates/BuildInfo.java" <<JAVA
package br.com.espacocativar.pilates;
final class BuildInfo {
    static final String VERSION_NAME = "$VERSION_NAME";
    static final int VERSION_CODE = $VERSION_CODE;
    private BuildInfo() {}
}
JAVA

echo "• Compilando Java…"
javac -source 8 -target 8 -Xlint:-options -encoding UTF-8 -bootclasspath "$ANDROID_JAR" \
  -d "$BUILD/obj" $(find src "$BUILD/gen" -name '*.java')

echo "• Gerando classes.dex…"
dalvik-exchange --dex --min-sdk-version="$MIN_SDK" --output="$BUILD/classes.dex" "$BUILD/obj"
(cd "$BUILD" && zip -q -j unsigned.apk classes.dex)

echo "• Alinhando…"
zipalign -f -p 4 "$BUILD/unsigned.apk" "$BUILD/aligned.apk"

if [ ! -f "$KEYSTORE" ]; then
  echo "• Criando keystore de assinatura em $KEYSTORE"
  mkdir -p "$(dirname "$KEYSTORE")"
  KEYSTORE_PASSWORD="${KEYSTORE_PASSWORD:-$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)}"
  keytool -genkeypair -keystore "$KEYSTORE" -storepass "$KEYSTORE_PASSWORD" -keypass "$KEYSTORE_PASSWORD" \
    -alias "$KEY_ALIAS" -keyalg RSA -keysize 4096 -validity 10000 \
    -dname "CN=Espaco Cativar Pilates, O=Espaco Cativar, C=BR" >/dev/null 2>&1
  printf 'KEYSTORE_PASSWORD=%s\nKEY_ALIAS=%s\n' "$KEYSTORE_PASSWORD" "$KEY_ALIAS" > "$(dirname "$KEYSTORE")/keystore.properties"
  chmod 600 "$KEYSTORE" "$(dirname "$KEYSTORE")/keystore.properties"
fi
if [ -z "${KEYSTORE_PASSWORD:-}" ] && [ -f "$(dirname "$KEYSTORE")/keystore.properties" ]; then
  # shellcheck disable=SC1091
  source "$(dirname "$KEYSTORE")/keystore.properties"
fi
: "${KEYSTORE_PASSWORD:?Defina KEYSTORE_PASSWORD}"
export KEYSTORE_PASSWORD

echo "• Assinando…"
apksigner sign --ks "$KEYSTORE" --ks-key-alias "$KEY_ALIAS" --ks-pass env:KEYSTORE_PASSWORD \
  --key-pass env:KEYSTORE_PASSWORD --min-sdk-version "$MIN_SDK" --out "$DIST/$APK_NAME" "$BUILD/aligned.apk"
apksigner verify --min-sdk-version "$MIN_SDK" "$DIST/$APK_NAME"

echo "✔ APK gerado: android/$DIST/$APK_NAME ($(du -h "$DIST/$APK_NAME" | cut -f1))"
