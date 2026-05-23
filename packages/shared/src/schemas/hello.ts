/**
 * 疎通確認用 procedure (router.hello) の入力スキーマ。
 * packages/api → packages/shared の依存配線が動くことを確認する目的も兼ねる。
 */
import { z } from "zod";

export const helloInputSchema = z.object({
  name: z.string().min(1).max(50),
});

export type HelloInput = z.infer<typeof helloInputSchema>;
