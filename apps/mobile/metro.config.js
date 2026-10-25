const fs = require('fs');
const path = require('path');
const { withNxMetro } = require('@nx/expo');
const { getDefaultConfig } = require('expo/metro-config');
const { mergeConfig } = require('@expo/metro/metro-config');
const { withNativewind } = require('nativewind/metro');

const defaultConfig = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = defaultConfig.resolver;

// In a Git worktree or Nx monorepo, node_modules may be symlinked or located in the workspace root.
// Metro requires all resolved files to be included in watchFolders to compute SHA-1 hashes properly.
const watchFolders = new Set();
const currentRoot = path.resolve(__dirname, '../../');

watchFolders.add(currentRoot);

const currentRootNodeModules = path.resolve(currentRoot, 'node_modules');

if (fs.existsSync(currentRootNodeModules)) {
  watchFolders.add(currentRootNodeModules);

  try {
    const realNodeModules = fs.realpathSync(currentRootNodeModules);
    watchFolders.add(realNodeModules);
    const parentRoot = path.dirname(realNodeModules);
    watchFolders.add(parentRoot);
  } catch {
    // ignore symlink resolution errors
  }
}


/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const customConfig = {
  cacheVersion: "mobile",
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  },
  resolver: {
    assetExts: assetExts.filter((ext) => ext !== 'svg'),
    sourceExts: [...sourceExts, 'cjs', 'mjs', 'svg'],
  },
};

const nxConfig = withNxMetro(mergeConfig(defaultConfig, customConfig), {
  debug: false,
  extensions: [],
  watchFolders: Array.from(watchFolders),
});

module.exports = withNativewind(nxConfig);


