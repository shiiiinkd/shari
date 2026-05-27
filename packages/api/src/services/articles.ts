/**
 * 関連記事（Qiita / Zenn）取得サービス。Workers 互換・fetch のみ。
 *
 * - Qiita: 公式 v2 検索 API を叩く。QIITA_TOKEN があれば付ける（レート制限が緩和される）
 *   - URL の重複は API 側で起きうるため明示的に dedup
 *   - 検索クエリは動画タイトルから記号・括弧・YouTube 特有の装飾を落としてから渡す
 *   - 著者アイコン・ユーザー名は API レスポンスから直接取れる
 * - Zenn: 公開検索 API が存在しないため MVP では空配列（articles.ts §関連メモ参照）
 *
 * OGP プレビュー（画像・説明）は `fetchOgp` で各記事 URL を fetch して取る。
 * Workers の I/O 並列で同時 fetch する想定（router 側で 3 件まで絞る）。
 * 失敗時は画像なしカードとして縮退表示する。cache miss 時にしか走らず、結果は
 * DB に保存されて以降の cache hit では再 fetch しない。
 *
 * スコアは各サイトのリアクション数を log で正規化して 0〜1 に押し込む（並び順比較用）。
 */
import type { RelatedArticle } from "@shari/shared";
import { z } from "zod";

// Qiita 検索の per_page は router 側の上位 N 件絞り込みより多めに取って質を確保する。
const QIITA_PER_PAGE = 6;
const QIITA_QUERY_MAX_LENGTH = 80;
// 1 サイト遅延が全体レスポンスを引きずらないよう短めに。失敗しても画像なしで描画継続できる。
const OGP_FETCH_TIMEOUT_MS = 2000;

const qiitaItemSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  likes_count: z.number().int().nonnegative().optional(),
  user: z
    .object({
      id: z.string().optional(),
      name: z.string().optional(),
      profile_image_url: z.string().url().optional(),
    })
    .optional(),
});
const qiitaResponseSchema = z.array(qiitaItemSchema);

export async function searchQiita(
  query: string,
  options: { token?: string } = {},
): Promise<RelatedArticle[]> {
  const sanitized = sanitizeQiitaQuery(query);
  if (!sanitized) return [];

  const url = new URL("https://qiita.com/api/v2/items");
  url.searchParams.set("query", sanitized);
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

  // Qiita API が同 URL を複数返すケースを防ぐ（タグ集計記事が複数タグでヒットする等）
  const seenUrls = new Set<string>();
  const uniqueItems = parsed.data.filter((item) => {
    if (seenUrls.has(item.url)) return false;
    seenUrls.add(item.url);
    return true;
  });

  return uniqueItems.map((item) => {
    const authorName = item.user?.name?.trim() || item.user?.id;
    return {
      source: "qiita" as const,
      url: item.url,
      title: item.title,
      score: normalizeReactionCount(item.likes_count ?? 0),
      siteName: "Qiita",
      ...(authorName ? { authorName } : {}),
      ...(item.user?.profile_image_url ? { authorIconUrl: item.user.profile_image_url } : {}),
    } satisfies RelatedArticle;
  });
}

/**
 * Zenn は公開検索 API が無いため MVP では未実装 → **Phase 2 送り**。
 *
 * Phase 2 で検討する代替手段:
 *   - https://zenn.dev/topics/<slug>/feed を topic 推定で叩く（topic 抽出が別問題）
 *   - https://zenn.dev/api/articles?topicname=<slug> を JSON で叩く（同上）
 *
 * 着手判断:
 *   MVP では Qiita のみで十分カバーできるか様子見。Qiita 単独だと
 *   関連記事の質・量が不足すると判断した時点で着手する。詳細な
 *   未確定事項は docs/data-model.md 参照。
 */
export async function searchZenn(_query: string): Promise<RelatedArticle[]> {
  return [];
}

/**
 * 与えられた article 群に OGP 画像・説明をマージして返す。
 * 各 article URL を並列 fetch（最大 N 件）。失敗・タイムアウトは元の article をそのまま返す。
 *
 * Workers 制約:
 *   - I/O 並列は CPU 時間を消費しないので 6 件並列は安全
 *   - 各 fetch は AbortSignal.timeout で打ち切り、全体応答が引きずられないようにする
 */
export async function enrichWithOgp(articles: RelatedArticle[]): Promise<RelatedArticle[]> {
  return Promise.all(
    articles.map(async (a) => {
      const ogp = await fetchOgp(a.url);
      if (!ogp) return a;
      return {
        ...a,
        ...(ogp.imageUrl ? { imageUrl: ogp.imageUrl } : {}),
        ...(ogp.description ? { description: ogp.description } : {}),
        ...(ogp.siteName && !a.siteName ? { siteName: ogp.siteName } : {}),
      };
    }),
  );
}

type OgpData = {
  imageUrl?: string;
  description?: string;
  siteName?: string;
};

async function fetchOgp(url: string): Promise<OgpData | null> {
  try {
    const res = await fetch(url, {
      headers: {
        // 一部サイトは UA で出し分けるため、ブラウザ風 UA を付ける
        "User-Agent": "Mozilla/5.0 (compatible; shari-bot/1.0; +https://github.com/shari)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(OGP_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;

    // OGP は通常 head に集中している。<head> 内（無ければ先頭 200KB）だけ読めば十分。
    // 大きな本文を全部メモリに乗せないため、stream は使わず単純に slice。
    const html = await res.text();
    const headEnd = html.indexOf("</head>");
    const target = headEnd > 0 ? html.slice(0, headEnd) : html.slice(0, 200_000);

    return {
      imageUrl: extractMeta(target, "og:image") ?? extractMeta(target, "twitter:image"),
      description: extractMeta(target, "og:description") ?? extractMetaName(target, "description"),
      siteName: extractMeta(target, "og:site_name"),
    };
  } catch {
    return null;
  }
}

/** <meta property="<name>" content="..."> 形式から content を抜く */
function extractMeta(html: string, property: string): string | undefined {
  // property と content の順序は逆もあるため両パターン許容
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1]);
  }
  return undefined;
}

/** <meta name="description" content="..."> 形式 */
function extractMetaName(html: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i");
  const m = html.match(re);
  return m?.[1] ? decodeEntities(m[1]) : undefined;
}

/**
 * HTML entity の最小デコード。
 * 名前付きは表示崩れに直結する頻出のみ対応、その他は数値参照（&#NNN; / &#xHHH;）で
 * カバーする。完全な名前付きエンティティ表を持たないのは Workers バンドルサイズ抑制のため。
 * &amp; は他デコードで再エンティティ化を避けるため最後に処理する。
 */
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      const code = parseInt(h, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&amp;/g, "&");
}

/**
 * Qiita 検索クエリ前処理。
 *
 * 動画タイトルを丸投げすると Qiita 検索構文（tag:, user: 等）と衝突したり、
 * 装飾語（【】, ｜, #shorts 等）が大量にスコア付けに紛れ込んでヒットが歪む。
 * 記号類を空白化し、ストップワードを落とし、長さ上限で切る。
 *
 * 形態素解析は Workers で重いため使わず、決め打ちの空白分割で済ませる。
 */
export function sanitizeQiitaQuery(raw: string): string {
  // 全角/半角の括弧・記号系を空白に置換（Qiita 検索の予約文字含む）
  const replaced = raw
    .replace(/[【】[\]［］（）()｜|/／#＃＠@:：,，、。.！!？?～~"'`「」『』〈〉《》〜]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // ストップワード（YouTube 特有の装飾語）。タイトルの大半を占めるのは技術キーワードなので
  // ここではノイズになりやすい一般語のみ落とす。
  const stopWords = new Set([
    "youtube",
    "shorts",
    "解説",
    "入門",
    "初心者",
    "向け",
    "完全",
    "ガイド",
    "まとめ",
    "vlog",
    "live",
  ]);
  const tokens = replaced.split(" ").filter((t) => t.length > 0 && !stopWords.has(t.toLowerCase()));

  // 長すぎると Qiita 側でヒット 0 になりやすいので上限で切る
  let result = tokens.join(" ");
  if (result.length > QIITA_QUERY_MAX_LENGTH) {
    result = result.slice(0, QIITA_QUERY_MAX_LENGTH).trimEnd();
  }
  return result;
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
