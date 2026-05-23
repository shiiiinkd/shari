// @ts-check
/**
 * shari のルート ESLint 設定（flat config）。
 * - Prettier と衝突するスタイル系ルールは eslint-config-prettier で off
 * - 型チェックは別途 `pnpm typecheck`（tsc --noEmit）で担当
 */
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
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
  prettier,
);
