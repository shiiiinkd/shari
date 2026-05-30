import type { RelatedArticle } from "@shari/shared";
import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import { Image, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import Markdown from "react-native-markdown-display";
import { Skeleton } from "../components/Skeleton";
import { useSummary, type SummaryState } from "../hooks/useSummary";
import { ERROR_CODE_DISPLAY, normalizeError, type ErrorCode } from "../lib/error";
import { trpc } from "../lib/trpc";
import type { ResultScreenProps } from "../navigation/types";

type Props = ResultScreenProps;

/**
 * Result:
 *   mode="new"  → summary.create（字幕取得 + Claude 要約）。成功後に関連記事を取得。
 *   mode="view" → summary.get（保存済みの読み取り専用）。関連記事は出さない。
 *                 保存が無ければ「再要約する」で create 経路へ手動切替。
 *
 * create / get の非対称は useSummary に隠蔽。関連記事は「フレッシュ生成（fresh）に伴う時だけ」出す
 * = view からの再要約後は出る、純粋な閲覧では出ない（Qiita 毎回コールの回避）。
 */
export function ResultScreen({ route }: Props) {
  const { videoId, mode } = route.params;
  const summary = useSummary(videoId, mode);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <SummaryView
        videoId={videoId}
        state={summary.state}
        isGenerating={summary.isGenerating}
        onRetry={summary.retry}
        onReSummarize={summary.reSummarize}
      />

      {summary.state.kind === "success" && summary.state.fresh && (
        <ArticlesContainer videoId={videoId} />
      )}
    </ScrollView>
  );
}

function SummaryView(props: {
  videoId: string;
  state: SummaryState;
  isGenerating: boolean;
  onRetry: () => void;
  onReSummarize: () => void;
}) {
  // コピー完了表示を 2 秒だけ出すための一時 state。
  const [copied, setCopied] = useState(false);
  // 連打しても timer が誤発火しないよう、ref に id を保持して次タップ時に clear する。
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { state } = props;

  if (state.kind === "error") {
    const display = ERROR_CODE_DISPLAY[state.code];
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorTitle}>
          {state.notCached ? "保存済みの要約がありません" : "要約取得に失敗しました"}
        </Text>
        <Text style={styles.errorMessage}>{display.displayMessage}</Text>
        {state.notCached ? (
          <Pressable
            style={styles.primaryButton}
            onPress={props.onReSummarize}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>再要約する</Text>
          </Pressable>
        ) : state.retryable ? (
          <Pressable style={styles.retryButton} onPress={props.onRetry} accessibilityRole="button">
            <Text style={styles.retryButtonText}>もう一度試す</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (state.kind === "loading") {
    return (
      <View>
        <View style={styles.sectionHeader}>
          <Skeleton width={80} height={20} />
        </View>
        <View style={styles.skeletonLines}>
          <Skeleton height={14} />
          <Skeleton height={14} />
          <Skeleton height={14} width="85%" />
          <Skeleton height={14} width="60%" />
        </View>
        {props.isGenerating && (
          <Text style={styles.loadingHint}>字幕を取得して要約中（初回は 20〜40 秒）</Text>
        )}
      </View>
    );
  }

  const summaryMd = state.summaryMd;
  const shareText = `${summaryMd}\n\n元動画: https://youtu.be/${props.videoId}`;

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
        {state.cacheHit && <Text style={styles.cacheBadge}>cache</Text>}
      </View>
      <Markdown style={markdownStyles}>{summaryMd}</Markdown>
      <View style={styles.actionRow}>
        <Pressable
          style={styles.actionButton}
          onPress={handleCopy}
          accessibilityRole="button"
          accessibilityLabel={copied ? "コピー完了" : "要約をコピー"}
        >
          <Text style={styles.actionButtonText}>{copied ? "コピーしました" : "コピー"}</Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={handleShare}
          accessibilityRole="button"
          accessibilityLabel="要約をシェア"
        >
          <Text style={styles.actionButtonText}>シェア</Text>
        </Pressable>
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
      <Text style={styles.sectionTitle}>関連記事</Text>

      {props.isPending && (
        <View style={styles.articleSkeletonList}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.articleCard}>
              <Skeleton width={60} height={11} />
              <Skeleton height={14} width="90%" />
            </View>
          ))}
        </View>
      )}

      {errorDisplay && (
        <View style={styles.errorBox}>
          <Text style={styles.errorMessage}>
            関連記事の取得に失敗: {errorDisplay.displayMessage}
          </Text>
          {errorDisplay.retryable && (
            <Pressable
              style={styles.retryButton}
              onPress={props.onRetry}
              accessibilityRole="button"
            >
              <Text style={styles.retryButtonText}>もう一度試す</Text>
            </Pressable>
          )}
        </View>
      )}

      {!props.isPending && props.articles && props.articles.length === 0 && (
        <Text style={styles.emptyText}>関連記事が見つかりませんでした。</Text>
      )}

      {!props.isPending && props.articles?.map((a) => <ArticleCard key={a.url} article={a} />)}
    </View>
  );
}

/**
 * Slack ライクなリンクプレビューカード。
 * 画像 → タイトル → 説明 → 著者（アイコン + 名前 + サイト名）の順で積む。
 * OGP 取得が失敗した記事は画像エリアを描画せず、テキストのみで縮退表示する。
 */
function ArticleCard({ article }: { article: RelatedArticle }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(article.imageUrl) && !imageFailed;
  const siteName = article.siteName ?? article.source.toUpperCase();

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
        {(article.authorName || article.authorIconUrl) && (
          <View style={styles.articleAuthorRow}>
            {article.authorIconUrl && (
              <Image source={{ uri: article.authorIconUrl }} style={styles.articleAuthorIcon} />
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
  scroll: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  cacheBadge: {
    fontSize: 11,
    color: "#0a7",
    backgroundColor: "#dfd",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  skeletonLines: {
    gap: 8,
    marginBottom: 12,
  },
  loadingHint: {
    fontSize: 12,
    color: "#777",
  },
  errorBox: {
    padding: 12,
    backgroundColor: "#fee",
    borderRadius: 8,
    gap: 4,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#c00",
  },
  errorMessage: {
    fontSize: 13,
    color: "#c00",
  },
  retryButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#c00",
    borderRadius: 6,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  primaryButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: "#0a7",
    borderRadius: 6,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fafafa",
  },
  actionButtonText: {
    fontSize: 13,
    color: "#333",
    fontWeight: "500",
  },
  articlesContainer: {
    marginTop: 12,
    gap: 8,
  },
  articleSkeletonList: {
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: "#777",
  },
  articleCard: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    backgroundColor: "#fafafa",
    overflow: "hidden",
  },
  articleImage: {
    width: "100%",
    aspectRatio: 1.91,
    backgroundColor: "#eee",
  },
  articleBody: {
    padding: 12,
    gap: 4,
  },
  articleSource: {
    fontSize: 11,
    color: "#666",
    textTransform: "uppercase",
  },
  articleTitle: {
    fontSize: 14,
    color: "#111",
    fontWeight: "600",
  },
  articleDescription: {
    fontSize: 12,
    color: "#555",
    lineHeight: 16,
    marginTop: 2,
  },
  articleAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  articleAuthorIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ddd",
  },
  articleAuthorName: {
    fontSize: 12,
    color: "#666",
    flexShrink: 1,
  },
});

const markdownStyles = {
  body: { fontSize: 15, lineHeight: 22, color: "#111" },
  heading1: { fontSize: 20, fontWeight: "700" as const, marginTop: 8, marginBottom: 8 },
  heading2: { fontSize: 18, fontWeight: "700" as const, marginTop: 12, marginBottom: 6 },
  heading3: { fontSize: 16, fontWeight: "600" as const, marginTop: 10, marginBottom: 4 },
  paragraph: { marginTop: 4, marginBottom: 8 },
  bullet_list: { marginTop: 4, marginBottom: 8 },
  code_inline: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 4,
    borderRadius: 4,
    fontFamily: "monospace",
  },
  code_block: {
    backgroundColor: "#f5f5f5",
    padding: 8,
    borderRadius: 6,
    fontFamily: "monospace",
    fontSize: 13,
  },
  fence: {
    backgroundColor: "#f5f5f5",
    padding: 8,
    borderRadius: 6,
    fontFamily: "monospace",
    fontSize: 13,
  },
};
