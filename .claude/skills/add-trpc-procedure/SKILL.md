---
name: add-trpc-procedure
description: shari に新しい tRPC procedure（query / mutation）を追加するときの完全手順。Zod schema の配置先、sub-router 化のタイミング、mobile からの呼び出しまで型シェアを壊さず一気通貫で実装する規約。
---

# add-trpc-procedure — tRPC procedure 追加

## 目的

procedure 追加は shari の最頻出作業。
**型シェアを壊さない / Zod schema を共通化する / 命名を揃える** ことを毎回手動で気にしなくて済むよう手順化する。

## 配置ルール

| 種別                                                                                   | 置き場所                                                                                        |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| router 本体                                                                            | `packages/api/src/router.ts`（数が増えたら `packages/api/src/routers/<domain>.ts` に分離）      |
| **複数パッケージで使う** Zod schema（mobile 事前バリデーション + backend 入力検証 等） | `packages/shared/src/schemas/<domain>.ts`                                                       |
| router 内でしか使わない一時的な schema                                                 | router ファイル内にローカル定義                                                                 |
| Context（DB クライアント・認証ユーザー等）                                             | `packages/api/src/trpc.ts` の `TRPCContext` 型 + `apps/backend/src/index.ts` の `createContext` |

**判定**: schema を mobile 側で `youtubeUrlSchema.safeParse(input)` のようにも使うなら → `packages/shared`。
backend の `input(...)` でしか使わないなら → router 内ローカル定義で十分。

## 手順

### 1. sub-router にするか判断

- 既存の `appRouter` 直下が 5 procedure 未満 → 直下に追加
- 5 以上 or 明確なドメイン（`summary` / `articles` / `auth`）→ `packages/api/src/routers/<domain>.ts` に切り出し、`router.ts` で `router({ summary: summaryRouter, ... })` の形にする

### 2. Zod schema を定義

複数パッケージで使うなら `packages/shared/src/schemas/<domain>.ts` に書き、`packages/shared/src/index.ts` から再エクスポート。

```ts
// packages/shared/src/schemas/summary.ts
import { z } from "zod";
import { videoIdSchema } from "./youtube.js";

export const summaryInputSchema = z.object({
  videoId: videoIdSchema,
  language: z.enum(["ja", "en"]).default("ja"),
});
export type SummaryInput = z.infer<typeof summaryInputSchema>;

export const summaryOutputSchema = z.object({
  summaryMd: z.string(),
  model: z.string(),
  cacheHit: z.boolean(),
});
export type SummaryOutput = z.infer<typeof summaryOutputSchema>;
```

router 内ローカルでよい場合は schema をそのまま router ファイルに書く。

### 3. procedure を実装

```ts
// packages/api/src/routers/summary.ts
import { summaryInputSchema, summaryOutputSchema } from "@shari/shared";
import { publicProcedure, router } from "../trpc.js";

export const summaryRouter = router({
  create: publicProcedure
    .input(summaryInputSchema)
    .output(summaryOutputSchema) // 出力型も Zod で固める（型シェアと整合性確保）
    .mutation(async ({ input, ctx }) => {
      // 1. videos キャッシュ確認
      // 2. transcripts 取得（無ければ YouTube API）
      // 3. summaries キャッシュ確認
      // 4. miss なら Claude API 呼ぶ
      // 5. requests に記録
      return { summaryMd: "...", model: "claude-sonnet-4-6", cacheHit: false };
    }),
});
```

**重要**:

- `.output(schema)` を付ける（後方互換を担保しつつクライアントへの型シェアを安定させる）
- 副作用（API呼び出し・DB書き込み）は procedure 本体にベタ書きしない。`packages/shared` か別 module に切り出して **注入可能**にする
- 認証必須なら `protectedProcedure`（後で `packages/api/src/trpc.ts` に追加する想定）を使う

### 4. ルートに登録

```ts
// packages/api/src/router.ts
import { summaryRouter } from "./routers/summary.js";

export const appRouter = router({
  hello: /* ... */,
  summary: summaryRouter,
});
```

### 5. mobile から呼ぶ

```ts
// apps/mobile/src/screens/ResultScreen.tsx
const mutation = trpc.summary.create.useMutation();
mutation.mutate({ videoId: "dQw4w9WgXcQ", language: "ja" });
```

型は自動で流れてくる（`packages/api` の `AppRouter` 経由）。**手動で type 再宣言しない**。

### 6. 動作確認

並列で:

- `pnpm --filter @shari/backend dev`（wrangler dev :8787）
- `pnpm --filter @shari/mobile dev`（expo start）

mobile から実行 → 期待レスポンス + Zod バリデーション動作（不正入力で 400 が返る）を確認。

## チェックリスト

- [ ] input に Zod schema を付けた（`z.string()` 単独で URL を受けていないか）
- [ ] output に Zod schema を付けた
- [ ] schema が複数パッケージで使われるなら `packages/shared` に置いた
- [ ] sub-router 化の閾値（5本）を超えたら分離した
- [ ] mobile 側で `AppRouter` 経由の型補完が効いている（手動 type 宣言していない）
- [ ] 副作用（API呼び出し）が procedure 本体にベタ書きされていない
- [ ] エラーレスポンスに内部スタックトレースを含めていない（`TRPCError` で適切な code を返す）
- [ ] 認可が必要なら `protectedProcedure` を使った（`publicProcedure` のままにしていない）

## やってはいけないこと

- ❌ mobile 側で `import type { AppRouter } from "../../../packages/api/src/router"` のような相対パス import（必ず `@shari/api` 経由）
- ❌ Zod schema を mobile と backend で別々に書く（必ず `@shari/shared` で1箇所定義）
- ❌ output を `z.any()` や型注釈なしで返す（クライアント型シェアが壊れる）
- ❌ `input(z.unknown())` のような実質バリデーションなし（必ず最小限の形を Zod で表現）
