/**
 * 関連記事（Qiita / Zenn）取得の schema。
 * tRPC procedure `articles.relatedFor` の入出力。
 * DB 列対応は docs/data-model.md §3.5 related_articles。
 */
import { z } from "zod";
import { videoIdSchema } from "./youtube.js";

export const articleSourceSchema = z.enum(["qiita", "zenn"]);
export type ArticleSource = z.infer<typeof articleSourceSchema>;

export const relatedArticleSchema = z.object({
  source: articleSourceSchema,
  url: z.string().url(),
  title: z.string().min(1),
  /** 正規化スコア（0〜1）。検索エンジン側のいいね数 / リアクション数を基にする。 */
  score: z.number().nonnegative().optional(),
});
export type RelatedArticle = z.infer<typeof relatedArticleSchema>;

export const articlesRelatedForInputSchema = z.object({
  videoId: videoIdSchema,
});
export type ArticlesRelatedForInput = z.infer<typeof articlesRelatedForInputSchema>;

export const articlesRelatedForOutputSchema = z.object({
  articles: z.array(relatedArticleSchema),
  cacheHit: z.boolean(),
});
export type ArticlesRelatedForOutput = z.infer<typeof articlesRelatedForOutputSchema>;
