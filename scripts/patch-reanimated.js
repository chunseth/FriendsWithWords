#!/usr/bin/env node
/**
 * Patch react-native-reanimated podspec to accept React Native 0.73.
 * Reanimated 3.19.x sometimes ships with a minimal RN version set to 78 (4.x requirement).
 */
const path = require('path');
const fs = require('fs');

const utilsPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-reanimated',
  'scripts',
  'reanimated_utils.rb'
);

if (!fs.existsSync(utilsPath)) {
  process.exit(0);
}

let content = fs.readFileSync(utilsPath, 'utf8');
const patched = content.replace(
  /minimalReactNativeVersion = \d+/,
  'minimalReactNativeVersion = 73'
);
if (patched !== content) {
  fs.writeFileSync(utilsPath, patched);
}
