const path = require("path");

const { getDefaultConfig } = require("expo/metro-config");

/**
 * Expo + pnpm workspace 用 Metro 設定。
 *
 * 主目的は 2 点:
 *   1. workspace ルート (packages/shared, packages/api) を Metro に監視させる
 *      - watchFolders + nodeModulesPaths を明示的に設定しないと、pnpm の symlink を
 *        辿ったソース変更を Metro が拾わない
 *   2. `.js` 拡張子で書かれた TS source の相対 import を解決する
 *      - packages/shared は ESM + TypeScript NodeNext idiom で `import "./foo.js"` と書く
 *      - Metro デフォルト resolver は拡張子が明示されていると別拡張子へのフォールバックを
 *        行わないため、`.js` を `.ts` / `.tsx` にフォールバックさせる
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
// pnpm の場合は disableHierarchicalLookup を切ると nested .pnpm/<pkg>/node_modules を
// 辿れなくなって expo-modules-core 等の peer dep が見つからなくなるため、
// hierarchical lookup は有効のまま nodeModulesPaths にプロジェクトと workspace root を
// 追加するだけにする。
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // .js → .ts / .tsx へのフォールバック。
  // 相対パスのみ対象。bare module の `.js` (例: react.js) はそのまま。
  if (moduleName.endsWith(".js") && (moduleName.startsWith("./") || moduleName.startsWith("../"))) {
    for (const ext of [".ts", ".tsx"]) {
      try {
        return context.resolveRequest(context, moduleName.replace(/\.js$/, ext), platform);
      } catch {
        // 次の拡張子を試す
      }
    }
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
