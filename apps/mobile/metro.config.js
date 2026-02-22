// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { FileStore } = require('metro-cache');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Expo SDK 52 auto-detects pnpm monorepo via EXPO_USE_METRO_WORKSPACE_ROOT (on by default).
// Still need to tell Metro about the workspace node_modules for hoisted pnpm.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Isolate Metro cache per project to avoid cross-monorepo cache collisions.
config.cacheStores = [
  new FileStore({ root: path.join(projectRoot, '.metro-cache') }),
];

// On web, replace native-only modules with lightweight stubs so SSR and the
// browser bundle don't crash when the native module initializes.
const WEB_STUBS = {
  'react-native-vision-camera': path.resolve(
    projectRoot,
    'src/__web_stubs__/react-native-vision-camera.js',
  ),
  'react-native-vision-camera-mlkit': path.resolve(
    projectRoot,
    'src/__web_stubs__/react-native-vision-camera-mlkit.js',
  ),
  'react-native-worklets-core': path.resolve(
    projectRoot,
    'src/__web_stubs__/react-native-worklets-core.js',
  ),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && Object.prototype.hasOwnProperty.call(WEB_STUBS, moduleName)) {
    return { filePath: WEB_STUBS[moduleName], type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
