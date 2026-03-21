# Android Release Policy And Risk Register

## Scope
This document defines Android release controls for:
- iOS-only icon dependency handling (`react-native-sfsymbols`)
- Android smoke checks for shared screens
- Android versioning alignment with `package.json`
- Release signing requirements
- Build-toolchain and patch-script risk tracking

## iOS Symbol Dependency Validation
`react-native-sfsymbols` remains a required dependency even when used only in iOS UI paths, because shared imports and platform resolution still require the package to exist in installs used by Android CI/build environments.

Run:

```bash
npm run check:android-prereqs
```

This verifies:
- `react-native-sfsymbols` exists in `package.json` dependencies
- iOS and Android symbol adapters exist
- patch scripts for gesture/reanimated exist

## Android Smoke Checks For Shared Screens
Android import-level smoke checks are required for shared screens that historically imported `SFSymbol`.

Run:

```bash
npm run test:android-smoke
```

These tests fail if `react-native-sfsymbols` is imported in shared screen modules.

## Versioning Policy
- Source of truth for display version: `package.json` `version`
- `android/app/build.gradle` `versionName`: must match `package.json` version
- `versionCode`: derived from semver (`major*10000 + minor*100 + patch`) unless explicitly overridden with `-PANDROID_VERSION_CODE=...`
- `versionCode` must strictly increase for each Play Store release

Example:
- `1.1.1` -> `10101`
- `1.2.0` -> `10200`
- `1.3.0` -> `10300`
- `1.3.1` -> `10301`
- `1.4` -> `10400`

## Release Signing Policy
- Debug keystore must never be used for release builds
- Release builds require all of:
  - `RELEASE_STORE_FILE`
  - `RELEASE_STORE_PASSWORD`
  - `RELEASE_KEY_ALIAS`
  - `RELEASE_KEY_PASSWORD`
- If a release task is requested without these values, Gradle fails the build at configuration time

## Toolchain Risk Tracking
Current known risk:
- Kotlin pinned to `1.8.0` while compile/target SDK and AGP are modern

Required checks each release:
1. Run Android smoke checks.
2. Run a debug Android build and a release Android build.
3. Review dependency upgrade notes for React Native, AGP, Kotlin, and gesture libs.
4. Log compatibility outcomes in release notes/PR description.

## Patch Script Risk Tracking
Current known risk:
- Postinstall patching of third-party packages:
  - `scripts/patch-gesture-handler.js`
  - `scripts/patch-reanimated.js`

Required checks each dependency update:
1. Run `npm install` from clean `node_modules`.
2. Verify both patch scripts still apply cleanly.
3. Run smoke tests and app startup checks.
4. Remove patches when upstream fixes are available.
