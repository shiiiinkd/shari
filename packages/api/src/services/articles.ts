/**
 * 関連記事（Qiita / Zenn）取得サービス。Workers 互換・fetch のみ。
 *
 * - Qiita: 公式 v2 検索 API を叩く。QIITA_TOKEN があれば付ける（レート制限が緩和される）
 * - Zenn: 公開検索 API が存在しないため MVP では空配列。後続で RSS / カテゴリ feed
 *   ベースのフォールバックを検討する（TODO 参照）
 *
 * 入力は「クエリ文字列」抽象に統一する（動画タイトルを呼び元から渡す）。
 * スコアは各サイトのリアクション数を log で正規化して 0〜1 に押し込む（並び順比較用）。
 */
import type { RelatedArticle } from "@shari/shared";
import { z } from "zod";

const QIITA_PER_PAGE = 5;

const qiitaItemSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  likes_count: z.number().int().nonnegative().optional(),
});
const qiitaResponseSchema = z.array(qiitaItemSchema);

export async function searchQiita(
  query: string,
  options: { token?: string } = {},
): Promise<RelatedArticle[]> {
  const url = new URL("https://qiita.com/api/v2/items");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(QIITA_PER_PAGE));

  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    // Qiita 障害時は空配列で握りつぶす（要約コアフローを止めない）
    return [];
  }

  const raw: unknown = await res.json();
  const parsed = qiitaResponseSchema.safeParse(raw);
  if (!parsed.success) return [];

  return parsed.data.map((item) => ({
    source: "qiita" as const,
    url: item.url,
    title: item.title,
    score: normalizeReactionCount(item.likes_count ?? 0),
  }));
}

/**
 * Zenn は公開検索 API が無いため MVP では未実装。
 * TODO: Zenn RSS feed（topic 別）から候補を引く代替手段を検討。
 * 候補:
 *   - https://zenn.dev/topics/<slug>/feed を topic 推定で叩く（topic 抽出が別問題）
 *   - https://zenn.dev/api/articles?topicname=<slug> を JSON で叩く（同上）
 */
export async function searchZenn(_query: string): Promise<RelatedArticle[]> {
  return [];
}

/**
 * リアクション数（自然数）を 0〜1 に押し込む雑な正規化。
 * 1 reaction = 0.18 程度、100 reactions = 0.8 程度、1000+ で頭打ち。
 * MVP では比較順序が分かれば十分なので雑でよい。
 */
function normalizeReactionCount(n: number): number {
  if (n <= 0) return 0;
  return Math.min(1, Math.log10(n + 1) / 3);
}
