#!/usr/bin/env node
/**
 * Patches react-native-gesture-handler:
 * 1. Remove the "react-native" field so Metro uses "main" (lib/commonjs/index.js)
 *    instead of "src/index.ts", which has broken imports in the published package.
 * 2. Rename RNGestureHandlerButtonManager.m -> .mm so iOS build finds the file
 *    (Xcode/codegen may reference the .mm path; the package ships only .m).
 */
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..', 'node_modules', 'react-native-gesture-handler');
const pkgPath = path.join(root, 'package.json');
const buttonManagerM = path.join(root, 'apple', 'RNGestureHandlerButtonManager.m');
const buttonManagerMm = path.join(root, 'apple', 'RNGestureHandlerButtonManager.mm');

if (!fs.existsSync(pkgPath)) {
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
if (pkg['react-native']) {
  delete pkg['react-native'];
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

// So iOS build finds RNGestureHandlerButtonManager.mm: create it from .m (then remove .m to avoid duplicate compile)
if (fs.existsSync(buttonManagerM) && !fs.existsSync(buttonManagerMm)) {
  fs.copyFileSync(buttonManagerM, buttonManagerMm);
  fs.unlinkSync(buttonManagerM);
}
