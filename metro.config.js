const path = require("path");
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const exclusionList = require("metro-config/src/defaults/exclusionList");

const projectRoot = __dirname;
const escapePathForRegex = (filePath) =>
  filePath.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&");
const blockListedPaths = [
  path.join(projectRoot, ".agents"),
  path.join(projectRoot, ".codex"),
  path.join(projectRoot, ".cursor"),
  path.join(projectRoot, ".expo"),
  path.join(projectRoot, ".git"),
  path.join(projectRoot, ".idea"),
  path.join(projectRoot, ".vscode"),
  path.join(projectRoot, "android", ".gradle"),
  path.join(projectRoot, "ios", "Pods"),
  path.join(projectRoot, "ios", "build"),
  path.join(projectRoot, "android", "build"),
  path.join(projectRoot, "android", "app", "build"),
  path.join(projectRoot, "node_modules", ".cache"),
  path.join(projectRoot, "node_modules", ".vite"),
  path.join(projectRoot, "supabase", ".temp"),
];
const blockListPatterns = [
  ...blockListedPaths.map(
    (blockedPath) =>
      new RegExp(`${escapePathForRegex(blockedPath)}(?:\\/.*)?$`)
  ),
  /.*\/Library\/Developer\/Xcode\/DerivedData(?:\/.*)?$/,
];

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  resolver: {
    blockList: exclusionList(blockListPatterns),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
