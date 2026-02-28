#!/usr/bin/env node
/**
 * Remove the "react-native" field from react-native-gesture-handler so Metro
 * uses "main" (lib/commonjs/index.js) instead of "src/index.ts", which has
 * broken imports in the published package.
 */
const path = require('path');
const fs = require('fs');

const pkgPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-gesture-handler',
  'package.json'
);

if (!fs.existsSync(pkgPath)) {
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
if (pkg['react-native']) {
  delete pkg['react-native'];
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}
