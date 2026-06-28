#!/bin/sh
set -e

DEST="${CONFIGURATION_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}"
PROJECT_ROOT="${PROJECT_ROOT:-"${PROJECT_DIR}/.."}"
REACT_NATIVE_XCODE="${REACT_NATIVE_PATH}/scripts/react-native-xcode.sh"

ulimit -n 65536 2>/dev/null || ulimit -n 16384 2>/dev/null || ulimit -n 8192 2>/dev/null || true
echo "React Native bundle open-file limit: $(ulimit -n)"

if [ "${CONFIGURATION}" != "Release" ]; then
  exec "${REACT_NATIVE_XCODE}"
fi

unset SKIP_BUNDLING
export FORCE_BUNDLING=1
export CI=1
export DEV=false
export BUNDLE_PLATFORM=ios
export BUNDLE_FILE="${CONFIGURATION_BUILD_DIR}/main.jsbundle"
export ASSETS_DEST="${DEST}"
export MINIFY=false

cd "${PROJECT_ROOT}"

if [ -n "${ENTRY_FILE}" ]; then
  :
elif [ -s "index.ios.js" ]; then
  export ENTRY_FILE=index.ios.js
else
  export ENTRY_FILE=index.js
fi

[ -z "${NODE_BINARY}" ] && NODE_BINARY="$(command -v node)"

"${NODE_BINARY}" "${PROJECT_ROOT}/scripts/xcode-bundle-ios.js"

HERMES_ENGINE_PATH="${PODS_ROOT}/hermes-engine"
[ -z "${HERMES_CLI_PATH}" ] && HERMES_CLI_PATH="${HERMES_ENGINE_PATH}/destroot/bin/hermesc"

if [ "${USE_HERMES}" = "false" ]; then
  cp "${BUNDLE_FILE}" "${DEST}/"
  BUNDLE_FILE="${DEST}/main.jsbundle"
else
  "${HERMES_CLI_PATH}" -emit-binary -max-diagnostic-width=80 -O -out "${DEST}/main.jsbundle" "${BUNDLE_FILE}"
  BUNDLE_FILE="${DEST}/main.jsbundle"
fi

if [ ! -f "${BUNDLE_FILE}" ]; then
  echo "error: Release build is missing main.jsbundle. The app would crash on launch."
  exit 1
fi
