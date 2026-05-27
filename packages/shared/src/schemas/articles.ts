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
  /** OGP の og:image。Slack 風プレビュー用。取得失敗時は undefined。 */
  imageUrl: z.string().url().optional(),
  /** OGP の og:description / meta description。冒頭抜粋。 */
  description: z.string().optional(),
  /** og:site_name または既知のサイト名。"Qiita" など。 */
  siteName: z.string().optional(),
  /** 著者表示名。Qiita API の user.id / name。 */
  authorName: z.string().optional(),
  /** 著者アイコン URL。Qiita API の user.profile_image_url。 */
  authorIconUrl: z.string().url().optional(),
});
export type RelatedArticle = z.infer<typeof relatedArticleSchema>;

export const articlesRelatedForInputSchema = z.object({
  videoId: videoIdSchema,
});
export type ArticlesRelatedForInput = z.infer<typeof articlesRelatedForInputSchema>;

export const articlesRelatedForOutputSchema = z.object({
  articles: z.array(relatedArticleSchema),
});
export type ArticlesRelatedForOutput = z.infer<typeof articlesRelatedForOutputSchema>;
