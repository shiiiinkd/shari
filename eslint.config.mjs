// @ts-check
/**
 * shari のルート ESLint 設定（flat config）。
 * - Prettier と衝突するスタイル系ルールは eslint-config-prettier で off
 * - 型チェックは別途 `pnpm typecheck`（tsc --noEmit）で担当
 * - React Hooks ルールは apps/mobile に限定して適用
 */
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import ts from "typescript-eslint";

export default ts.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.expo/**",
      "**/.wrangler/**",
      "**/.turbo/**",
      "**/.next/**",
      "**/coverage/**",
      "apps/mobile/android/**",
      "apps/mobile/ios/**",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["apps/mobile/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // Metro の設定ファイルは Metro 側の制約で CommonJS (require / module.exports)
    // 必須。Node ランタイムで実行される config なので CJS globals を許可する。
    files: ["apps/mobile/metro.config.js"],
    languageOptions: {
      globals: {
        require: "readonly",
        module: "readonly",
        __dirname: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // 実機 Expo Go 用の起動スクリプト（Node ESM ランタイムで実行）。Node globals を許可する。
    files: ["apps/mobile/scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
      },
    },
  },
  prettier,
);
