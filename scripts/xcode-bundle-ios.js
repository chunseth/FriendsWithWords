#!/usr/bin/env node

const path = require("path");
const Server = require("metro/src/Server");
const outputBundle = require("metro/src/shared/output/bundle");
const { loadConfig, mergeConfig, resolveConfig } = require("metro-config");

async function loadMetroConfig(projectRoot) {
  const projectConfig = await resolveConfig(undefined, projectRoot);
  if (projectConfig.isEmpty) {
    throw new Error(`No Metro config found in ${projectRoot}`);
  }

  const reactNativePath = path.join(projectRoot, "node_modules", "react-native");
  const initializeCore = require.resolve(
    path.join(reactNativePath, "Libraries/Core/InitializeCore"),
    { paths: [projectRoot] }
  );

  const config = await loadConfig({
    cwd: projectRoot,
    resetCache: true,
  });

  return mergeConfig(config, {
    resolver: {
      platforms: ["ios", "android", "native"],
    },
    serializer: {
      getModulesRunBeforeMainModule: () => [initializeCore],
    },
  });
}

async function main() {
  const projectRoot = process.env.PROJECT_ROOT || process.cwd();
  const entryFile = process.env.ENTRY_FILE || "index.js";
  const platform = process.env.BUNDLE_PLATFORM || "ios";
  const dev = process.env.DEV === "true";
  const minify = process.env.MINIFY === "true";
  const bundleOutput = process.env.BUNDLE_FILE;
  const assetsDest = process.env.ASSETS_DEST;
  const saveAssets = require(path.join(
    projectRoot,
    "node_modules",
    "@react-native",
    "community-cli-plugin",
    "dist",
    "commands",
    "bundle",
    "saveAssets.js"
  )).default;

  if (!bundleOutput) {
    throw new Error("BUNDLE_FILE is required");
  }

  process.env.NODE_ENV = dev ? "development" : "production";

  const config = await loadMetroConfig(projectRoot);
  const server = new Server(config, { watch: false });
  const requestOptions = {
    ...Server.DEFAULT_BUNDLE_OPTIONS,
    bundleType: "bundle",
    dev,
    entryFile,
    minify,
    platform,
  };

  try {
    const bundle = await outputBundle.build(server, requestOptions);
    await outputBundle.save(
      bundle,
      {
        bundleOutput,
        dev,
        platform,
      },
      (message) => console.log(`info ${message}`)
    );

    const assets = await server.getAssets({
      ...requestOptions,
      bundleType: "todo",
    });
    await saveAssets(assets, platform, assetsDest);
  } finally {
    server.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
