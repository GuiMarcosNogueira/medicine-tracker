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

module.exports = config;
