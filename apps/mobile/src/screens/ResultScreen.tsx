import type { RelatedArticle } from "@shari/shared";
import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Image, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import Markdown from "react-native-markdown-display";
import { ActionButton } from "../components/ActionButton";
import { CacheBadge } from "../components/CacheBadge";
import { Skeleton } from "../components/Skeleton";
import { StatusState } from "../components/StatusState";
import { ArtBusy, ArtNotFound } from "../components/illustrations";
import { markdownStyles } from "../components/markdownStyles";
import { useSummary, type SummaryState } from "../hooks/useSummary";
import { ERROR_CODE_DISPLAY, normalizeError, type ErrorCode } from "../lib/error";
import { trpc } from "../lib/trpc";
import type { ResultScreenProps } from "../navigation/types";
import { colors, radii, spacing, type } from "../theme";

type Props = ResultScreenProps;

/**
 * Result:
 *   mode="new"  → summary.create（字幕取得 + Claude 要約）。成功後に関連記事を取得。
 *   mode="view" → summary.get（保存済みの読み取り専用）。関連記事は出さない。
 *                 保存が無ければ「再要約する」で create 経路へ手動切替。
 *
 * create / get の非対称は useSummary に隠蔽。関連記事は「フレッシュ生成（fresh）に伴う時だけ」出す
 * = view からの再要約後は出る、純粋な閲覧では出ない（Qiita 毎回コールの回避）。
 *
 * 画面構成:
 *   - error / not-found → 全画面の落ち着いた StatusState（イラスト中央・赤箱なし）
 *   - loading           → 上寄せのスケルトン
 *   - success / view    → スクロール本文（要約 Markdown ＋ fresh 時のみ関連記事）
 */
export function ResultScreen({ route }: Props) {
  const { videoId, mode } = route.params;
  const summary = useSummary(videoId, mode);
  const { state } = summary;

  if (state.kind === "error") {
    const status = resolveErrorStatus(state, summary.retry, summary.reSummarize);
    return (
      <View style={styles.fill}>
        <StatusState
          art={status.art}
          title={status.title}
          body={status.body}
          primaryLabel={status.primaryLabel}
          onPrimary={status.onPrimary}
        />
      </View>
    );
  }

  if (state.kind === "loading") {
    return (
      <View style={styles.fill}>
        <View style={styles.generating}>
          <View>
            <Skeleton width={64} height={20} borderRadius={6} style={styles.genTitle} />
            <View style={styles.genLines}>
              <Skeleton height={14} />
              <Skeleton height={14} />
              <Skeleton height={14} width="85%" />
              <Skeleton height={14} width="60%" />
            </View>
          </View>
          {summary.isGenerating && (
            <Text style={styles.genHint}>字幕を取得して要約中（初回は 20〜40 秒）</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <SummaryView videoId={videoId} summaryMd={state.summaryMd} cacheHit={state.cacheHit} />
      {state.fresh && <ArticlesContainer videoId={videoId} />}
    </ScrollView>
  );
}

/** エラー区分を「落ち着いた状態画面」のイラスト・文言・アクションに対応づける。 */
function resolveErrorStatus(
  state: Extract<SummaryState, { kind: "error" }>,
  onRetry: () => void,
  onReSummarize: () => void,
): { art: ReactNode; title: string; body: string; primaryLabel?: string; onPrimary?: () => void } {
  const display = ERROR_CODE_DISPLAY[state.code];

  if (state.notCached) {
    return {
      art: <ArtNotFound />,
      title: "保存済みの要約がありません",
      body: "この動画はまだ要約されていません。今すぐ要約できます。",
      primaryLabel: "再要約する",
      onPrimary: onReSummarize,
    };
  }

  // 状況に応じてイラストと見出しを出し分ける。
  // 見つからない系（字幕なし・動画なし）は ArtNotFound、一時的な失敗（混雑・上流障害・通信）は ArtBusy。
  let art: ReactNode;
  let title: string;
  switch (state.code) {
    case "NO_TRANSCRIPT":
      art = <ArtNotFound />;
      title = "字幕が見つかりません";
      break;
    case "VIDEO_NOT_FOUND":
      art = <ArtNotFound />;
      title = "動画が見つかりません";
      break;
    case "RATE_LIMITED":
      art = <ArtBusy />;
      title = "少し混み合っているようです";
      break;
    case "UPSTREAM_FAILED":
      art = <ArtBusy />;
      title = "外部サービスで問題が発生しました";
      break;
    default:
      // SERVER_ERROR など
      art = <ArtBusy />;
      title = "うまく読み込めませんでした";
  }

  // どんなエラーでも「もう一度試す」を出す（種別ごとの固有文は body に残す）。
  return {
    art,
    title,
    body: display.displayMessage,
    primaryLabel: "もう一度試す",
    onPrimary: onRetry,
  };
}

function SummaryView(props: { videoId: string; summaryMd: string; cacheHit: boolean }) {
  // コピー完了表示を 2 秒だけ出すための一時 state。
  const [copied, setCopied] = useState(false);
  // 連打しても timer が誤発火しないよう、ref に id を保持して次タップ時に clear する。
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shareText = `${props.summaryMd}\n\n元動画: https://youtu.be/${props.videoId}`;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(shareText);
    setCopied(true);
    if (copyResetTimer.current !== null) {
      clearTimeout(copyResetTimer.current);
    }
    copyResetTimer.current = setTimeout(() => {
      setCopied(false);
      copyResetTimer.current = null;
    }, 2000);
  };

  const handleShare = async () => {
    // シェアシートを閉じた場合や Web Share API 非対応環境では reject される。
    // UX 上致命的ではないので静かに無視する。
    await Share.share({ message: shareText }).catch(() => undefined);
  };

  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>要約</Text>
        {props.cacheHit && <CacheBadge />}
      </View>
      <Markdown style={markdownStyles}>{props.summaryMd}</Markdown>
      <View style={styles.actionRow}>
        <ActionButton
          icon="copy-outline"
          done={copied}
          label={copied ? "コピーしました" : "コピー"}
          onPress={handleCopy}
        />
        <ActionButton icon="share-outline" label="シェア" onPress={handleShare} />
      </View>
    </View>
  );
}

/**
 * 関連記事の取得 + 表示。fresh 生成成功時のみ mount され、その場で 1 回 fetch する。
 * view（純粋な閲覧）では mount されないため Qiita を叩かない。
 */
function ArticlesContainer({ videoId }: { videoId: string }) {
  const articlesMutation = trpc.articles.relatedFor.useMutation();
  const { mutate: fetchArticles } = articlesMutation;

  useEffect(() => {
    fetchArticles({ videoId });
  }, [videoId, fetchArticles]);

  const errorCode = articlesMutation.error ? normalizeError(articlesMutation.error) : null;

  return (
    <ArticlesSection
      isPending={articlesMutation.isPending}
      errorCode={errorCode}
      articles={articlesMutation.data?.articles ?? null}
      onRetry={() => fetchArticles({ videoId })}
    />
  );
}

function ArticlesSection(props: {
  isPending: boolean;
  errorCode: ErrorCode | null;
  articles: readonly RelatedArticle[] | null;
  onRetry: () => void;
}) {
  const errorDisplay = props.errorCode ? ERROR_CODE_DISPLAY[props.errorCode] : null;

  return (
    <View style={styles.articlesContainer}>
      <Text style={styles.articlesTitle}>関連記事</Text>

      {props.isPending && (
        <View style={styles.articleCardList}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.articleSkeletonCard}>
              <Skeleton width={48} height={10} />
              <Skeleton height={14} width="88%" />
              <Skeleton height={12} width="96%" />
            </View>
          ))}
        </View>
      )}

      {errorDisplay && (
        <View style={styles.articlesErrorBox}>
          <Text style={styles.articlesError}>{errorDisplay.displayMessage}</Text>
          {errorDisplay.retryable && (
            <Pressable onPress={props.onRetry} accessibilityRole="button" hitSlop={6}>
              <Text style={styles.articlesRetry}>もう一度試す</Text>
            </Pressable>
          )}
        </View>
      )}

      {!props.isPending && props.articles && props.articles.length === 0 && (
        <Text style={styles.articlesEmpty}>関連記事が見つかりませんでした。</Text>
      )}

      {!props.isPending && props.articles && props.articles.length > 0 && (
        <View style={styles.articleCardList}>
          {props.articles.map((a) => (
            <ArticleCard key={a.url} article={a} />
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * Slack ライクなリンクプレビューカード。
 * 画像 → サイト名 → タイトル → 説明 → 著者（アイコン + 名前）の順で積む。
 * OGP 画像取得が失敗した記事は画像エリアを描画せず、テキストのみで縮退表示する。
 */
function ArticleCard({ article }: { article: RelatedArticle }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(article.imageUrl) && !imageFailed;
  const siteName = article.siteName ?? article.source.toUpperCase();
  const hasAuthor = Boolean(article.authorName || article.authorIconUrl);

  return (
    <Pressable
      style={styles.articleCard}
      onPress={() => {
        Linking.openURL(article.url).catch(() => undefined);
      }}
      accessibilityRole="link"
      accessibilityLabel={`${siteName}: ${article.title}`}
    >
      {showImage && article.imageUrl && (
        <Image
          source={{ uri: article.imageUrl }}
          style={styles.articleImage}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      )}
      <View style={styles.articleBody}>
        <Text style={styles.articleSource}>{siteName}</Text>
        <Text style={styles.articleTitle} numberOfLines={2}>
          {article.title}
        </Text>
        {article.description && (
          <Text style={styles.articleDescription} numberOfLines={2}>
            {article.description}
          </Text>
        )}
        {hasAuthor && (
          <View style={styles.articleAuthorRow}>
            {article.authorIconUrl ? (
              <Image source={{ uri: article.authorIconUrl }} style={styles.articleAuthorIcon} />
            ) : (
              <View style={styles.articleAuthorIcon} />
            )}
            {article.authorName && (
              <Text style={styles.articleAuthorName} numberOfLines={1}>
                {article.authorName}
              </Text>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    padding: spacing.resultPad,
    paddingBottom: 32,
  },
  // ── generating ──
  generating: {
    padding: spacing.resultPad,
    gap: spacing.lg,
  },
  genTitle: {
    marginBottom: 14,
  },
  genLines: {
    gap: 10,
  },
  genHint: {
    ...type.hint,
    color: colors.textTertiary,
  },
  // ── summary ──
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    ...type.sectionTitle,
    color: colors.textPrimary,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: spacing.lg,
  },
  // ── related articles ──
  articlesContainer: {
    marginTop: spacing.xl,
  },
  articlesTitle: {
    ...type.sectionTitle,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  articleCardList: {
    gap: 12,
  },
  articlesEmpty: {
    ...type.caption,
    color: colors.textTertiary,
  },
  articlesErrorBox: {
    gap: 8,
    alignItems: "flex-start",
  },
  articlesError: {
    ...type.caption,
    color: colors.textTertiary,
  },
  articlesRetry: {
    ...type.secondaryBtn,
    fontWeight: "600",
    color: colors.textSecondary,
    textDecorationLine: "underline",
  },
  articleCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  articleSkeletonCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 8,
  },
  articleImage: {
    width: "100%",
    aspectRatio: 1.91,
    backgroundColor: colors.surface2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  articleBody: {
    padding: 12,
    gap: 4,
  },
  articleSource: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.77, // 11 * 0.07em
    color: colors.textTertiary,
    textTransform: "uppercase",
  },
  articleTitle: {
    fontSize: 14.5,
    fontWeight: "600",
    color: colors.textPrimary,
    lineHeight: 20,
  },
  articleDescription: {
    fontSize: 12.5,
    color: colors.textSecondary,
    lineHeight: 19,
    marginTop: 1,
  },
  articleAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 6,
  },
  articleAuthorIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  articleAuthorName: {
    fontSize: 12.5,
    color: colors.textSecondary,
    flexShrink: 1,
  },
});
