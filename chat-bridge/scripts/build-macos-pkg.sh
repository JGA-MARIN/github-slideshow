#!/usr/bin/env bash
# Build Brygga.app + Brygga-0.1.0.pkg (can run on Linux with xar + mkbom)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${VERSION:-0.1.0}"
IDENTIFIER="se.brygga.app"
PKG_ID="se.brygga.app.pkg"
DIST_DIR="${ROOT}/dist"
WORK="${DIST_DIR}/work"
APP_NAME="Brygga"
APP_BUNDLE="${WORK}/root/Applications/${APP_NAME}.app"
NODE_VERSION="${NODE_VERSION:-22.14.0}"
NEXT_VERSION="$(node -p "require('${ROOT}/package.json').dependencies.next.replace(/^[^\d]*/, '')")"

mkdir -p "$DIST_DIR" "$WORK"
rm -rf "$WORK"
mkdir -p "$APP_BUNDLE/Contents/MacOS" \
  "$APP_BUNDLE/Contents/Resources/app" \
  "$WORK/flat/base.pkg" \
  "$WORK/scripts"

echo "==> Building Next.js standalone"
cd "$ROOT"
npm run build

STANDALONE="${ROOT}/.next/standalone"
STATIC_SRC="${ROOT}/.next/static"
PUBLIC_SRC="${ROOT}/public"

if [[ ! -d "$STANDALONE" ]]; then
  echo "Standalone-output saknas. Kontrollera next.config.ts (output: 'standalone')." >&2
  exit 1
fi

echo "==> Copying app into bundle"
# Next may nest under package folder name when monorepo-ish; prefer deepest server.js
if [[ -f "${STANDALONE}/server.js" ]]; then
  APP_SRC="$STANDALONE"
elif [[ -f "${STANDALONE}/chat-bridge/server.js" ]]; then
  APP_SRC="${STANDALONE}/chat-bridge"
else
  APP_SRC="$(dirname "$(find "$STANDALONE" -name server.js | head -1)")"
fi

rsync -a --delete "$APP_SRC/" "$APP_BUNDLE/Contents/Resources/app/"
mkdir -p "$APP_BUNDLE/Contents/Resources/app/.next"
rsync -a "$STATIC_SRC/" "$APP_BUNDLE/Contents/Resources/app/.next/static/"
if [[ -d "$PUBLIC_SRC" ]]; then
  rsync -a "$PUBLIC_SRC/" "$APP_BUNDLE/Contents/Resources/app/public/"
fi
cp "${ROOT}/.env.example" "$APP_BUNDLE/Contents/Resources/app/.env.example"

# INCLUDE_INTEL=1 also ships Intel (x64) Node + SWC. Default is Apple Silicon only.
INCLUDE_INTEL="${INCLUDE_INTEL:-0}"

echo "==> Installing darwin SWC binaries for runtime"
TMP_SWC="$(mktemp -d)"
cd "$TMP_SWC"
SWC_PACKAGES=("@next/swc-darwin-arm64@${NEXT_VERSION}")
if [[ "$INCLUDE_INTEL" == "1" ]]; then
  SWC_PACKAGES+=("@next/swc-darwin-x64@${NEXT_VERSION}")
fi
npm pack "${SWC_PACKAGES[@]}" >/dev/null
for tgz in ./*.tgz; do
  tar -xzf "$tgz"
  PKG_DIR="$(tar -tzf "$tgz" | head -1 | cut -d/ -f1)"
  NAME="$(node -p "require('./${PKG_DIR}/package.json').name")"
  DEST="$APP_BUNDLE/Contents/Resources/app/node_modules/${NAME}"
  mkdir -p "$DEST"
  rsync -a "${PKG_DIR}/" "$DEST/"
done
# Drop non-darwin SWC so Next resolves the Mac packages on device
rm -rf "$APP_BUNDLE/Contents/Resources/app/node_modules/@next/swc-linux"* \
  "$APP_BUNDLE/Contents/Resources/app/node_modules/@next/swc-win32"* || true
# Drop Linux-only sharp natives from the Linux build host
rm -rf "$APP_BUNDLE/Contents/Resources/app/node_modules/@img/sharp-linux"* \
  "$APP_BUNDLE/Contents/Resources/app/node_modules/@img/sharp-libvips-linux"* || true
cd "$ROOT"
rm -rf "$TMP_SWC"

echo "==> Downloading Node.js ${NODE_VERSION} for macOS (bin only)"
download_node_bin() {
  local arch="$1"
  local dest="$2"
  local url="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-${arch}.tar.gz"
  local tmp extract
  tmp="$(mktemp)"
  extract="$(mktemp -d)"
  echo "  fetching $url"
  curl -fsSL "$url" -o "$tmp"
  tar -xzf "$tmp" -C "$extract" --strip-components=1
  mkdir -p "$dest/bin"
  cp "$extract/bin/node" "$dest/bin/node"
  chmod 755 "$dest/bin/node"
  rm -rf "$tmp" "$extract"
}

download_node_bin arm64 "$APP_BUNDLE/Contents/Resources/node-arm64"
if [[ "$INCLUDE_INTEL" == "1" ]]; then
  download_node_bin x64 "$APP_BUNDLE/Contents/Resources/node-x64"
fi

echo "==> Writing launcher + Info.plist"
cp "${ROOT}/packaging/macos/Info.plist" "$APP_BUNDLE/Contents/Info.plist"
cp "${ROOT}/packaging/macos/Brygga.command" "$APP_BUNDLE/Contents/MacOS/Brygga"
chmod 755 "$APP_BUNDLE/Contents/MacOS/Brygga"
# Mark as executable script app
chmod -R a+rX "$APP_BUNDLE"

echo "==> Creating flat package"
ROOT_PAYLOAD="$WORK/root"
NUM_FILES="$(find "$ROOT_PAYLOAD" | wc -l | tr -d ' ')"
INSTALL_KB="$(du -k -s "$ROOT_PAYLOAD" | awk '{print $1}')"

cp "${ROOT}/packaging/macos/postinstall" "$WORK/scripts/postinstall"
chmod 755 "$WORK/scripts/postinstall"

(
  cd "$WORK/scripts"
  find . | cpio -o --format=odc --owner=0:80 2>/dev/null | gzip -c
) > "$WORK/flat/base.pkg/Scripts"

(
  cd "$ROOT_PAYLOAD"
  find . | cpio -o --format=odc --owner=0:80 2>/dev/null | gzip -c
) > "$WORK/flat/base.pkg/Payload"

mkbom -u 0 -g 80 "$ROOT_PAYLOAD" "$WORK/flat/base.pkg/Bom"

cat > "$WORK/flat/base.pkg/PackageInfo" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<pkg-info format-version="2" identifier="${PKG_ID}" version="${VERSION}" install-location="/" auth="root" overwrite-permissions="true" relocatable="false" postinstall-action="none">
  <payload installKBytes="${INSTALL_KB}" numberOfFiles="${NUM_FILES}"/>
  <scripts>
    <postinstall file="./postinstall"/>
  </scripts>
  <bundle-version>
    <bundle id="${IDENTIFIER}" CFBundleIdentifier="${IDENTIFIER}" path="./Applications/${APP_NAME}.app" CFBundleVersion="${VERSION}"/>
  </bundle-version>
</pkg-info>
EOF

cat > "$WORK/flat/Distribution" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<installer-gui-script minSpecVersion="2">
  <title>Brygga ${VERSION}</title>
  <organization>se.brygga</organization>
  <domains enable_anywhere="false" enable_currentUserHome="false" enable_localSystem="true"/>
  <options customize="never" require-scripts="false" rootVolumeOnly="true"/>
  <welcome file="welcome.txt" mime-type="text/plain"/>
  <choices-outline>
    <line choice="default">
      <line choice="com.brygga.base"/>
    </line>
  </choices-outline>
  <choice id="default"/>
  <choice id="com.brygga.base" visible="false">
    <pkg-ref id="${PKG_ID}"/>
  </choice>
  <pkg-ref id="${PKG_ID}" version="${VERSION}" onConclusion="none">${PKG_ID}</pkg-ref>
</installer-gui-script>
EOF

# pkg-ref body must be the relative path to the component package for some installers;
# for flat packages using xar of Distribution + base.pkg, Apple expects:
# <pkg-ref id="..." version="...">#base.pkg</pkg-ref> OR path base.pkg
# Use classic bomutils layout with pkg-ref pointing at base.pkg payload count.
cat > "$WORK/flat/Distribution" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<installer-gui-script minSpecVersion="1">
  <title>Brygga</title>
  <options customize="never" require-scripts="false"/>
  <choices-outline>
    <line choice="choice_brygga"/>
  </choices-outline>
  <choice id="choice_brygga" title="Brygga">
    <pkg-ref id="${PKG_ID}"/>
  </choice>
  <pkg-ref id="${PKG_ID}" version="${VERSION}" auth="Root">${INSTALL_KB}</pkg-ref>
  <pkg-ref id="${PKG_ID}" installKBytes="${INSTALL_KB}">#base.pkg</pkg-ref>
</installer-gui-script>
EOF

mkdir -p "$WORK/flat/Resources/en.lproj"
cat > "$WORK/flat/Resources/en.lproj/welcome.txt" <<'EOF'
Brygga installeras i Program / Applications.

Efter installation:
1. Öppna Brygga
2. Ange OpenAI API-nyckel (eller kör demoläge)
3. Ge Automatisering-behörighet till Mail och Kalender

Brygga pratar med macOS Mail och Kalender. iPhone synkar via iCloud.
EOF

PKG_OUT="${DIST_DIR}/Brygga-${VERSION}.pkg"
rm -f "$PKG_OUT"
(
  cd "$WORK/flat"
  /usr/local/bin/xar --compression none -cf "$PKG_OUT" *
)

# Also keep a zip of the .app for users who prefer drag-install
(
  cd "$ROOT_PAYLOAD/Applications"
  zip -r -q "${DIST_DIR}/Brygga-${VERSION}-app.zip" "${APP_NAME}.app"
)

ls -lh "$PKG_OUT" "${DIST_DIR}/Brygga-${VERSION}-app.zip"
echo "OK: $PKG_OUT"
