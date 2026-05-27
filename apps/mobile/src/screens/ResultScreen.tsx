import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RelatedArticle } from "@shari/shared";
import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import { Image, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import Markdown from "react-native-markdown-display";
import { Skeleton } from "../components/Skeleton";
import { ERROR_CODE_DISPLAY, normalizeError, type ErrorCode } from "../lib/error";
import { trpc } from "../lib/trpc";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Result">;

/**
 * Result:
 *   1. mount → summary.create を mutate（字幕取得 + Claude 要約）
 *   2. summary 成功 → articles.relatedFor を mutate
 *   段階表示: summary が出るまでスピナー → 要約描画 → その下で articles の取得が走る
 *
 * mutation を使う理由:
 *   - backend では両 procedure が DB 書き込みを伴うため mutation 定義
 *   - mobile からも useMutation 経由で扱い、再試行はユーザー操作（戻る → 再送）に委ねる
 *   - useQuery を使うと「マウント / フォーカス時に勝手に走る」挙動になり、料金が嵩む
 */
export function ResultScreen({ route }: Props) {
  const { videoId } = route.params;

  const summaryMutation = trpc.summary.create.useMutation();
  const articlesMutation = trpc.articles.relatedFor.useMutation();

  // summary.create は videoId が決まり次第すぐ実行。
  // 依存配列は videoId のみ（mutate 関数は react-query が安定参照を保証する）。
  const { mutate: createSummary } = summaryMutation;
  useEffect(() => {
    createSummary({ videoId, language: "ja" });
  }, [videoId, createSummary]);

  // summary 成功後に articles を呼ぶ。
  // 成功状態を切り出して依存に入れることで、isSuccess の遷移時のみ発火する。
  const summarySuccess = summaryMutation.isSuccess;
  const { mutate: fetchArticles } = articlesMutation;
  useEffect(() => {
    if (summarySuccess) {
      fetchArticles({ videoId });
    }
  }, [summarySuccess, videoId, fetchArticles]);

  const summaryErrorCode = summaryMutation.error ? normalizeError(summaryMutation.error) : null;
  const articlesErrorCode = articlesMutation.error ? normalizeError(articlesMutation.error) : null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <SummarySection
        videoId={videoId}
        isPending={summaryMutation.isPending}
        errorCode={summaryErrorCode}
        summaryMd={summaryMutation.data?.summaryMd ?? null}
        cacheHit={summaryMutation.data?.cacheHit ?? null}
        onRetry={() => createSummary({ videoId, language: "ja" })}
      />

      {summarySuccess && (
        <ArticlesSection
          isPending={articlesMutation.isPending}
          errorCode={articlesErrorCode}
          articles={articlesMutation.data?.articles ?? null}
          onRetry={() => fetchArticles({ videoId })}
        />
      )}
    </ScrollView>
  );
}

function SummarySection(props: {
  videoId: string;
  isPending: boolean;
  errorCode: ErrorCode | null;
  summaryMd: string | null;
  cacheHit: boolean | null;
  onRetry: () => void;
}) {
  // コピー完了の表示を 2 秒だけ出すための一時 state。
  const [copied, setCopied] = useState(false);
  // setTimeout は連打しても自動キャンセルされないため、ref に id を保持して
  // 次タップ時に明示的に clear する。これがないと「2 連打→1 回目の timer が
  // 早めに発火して、まだ 2 秒経っていない 2 回目の表示が消える」現象が起きる。
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (props.errorCode) {
    const display = ERROR_CODE_DISPLAY[props.errorCode];
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorTitle}>要約取得に失敗しました</Text>
        <Text style={styles.errorMessage}>{display.displayMessage}</Text>
        {display.retryable && (
          <Pressable style={styles.retryButton} onPress={props.onRetry} accessibilityRole="button">
            <Text style={styles.retryButtonText}>もう一度試す</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (props.isPending || !props.summaryMd) {
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
        <Text style={styles.loadingHint}>字幕を取得して要約中（初回は 20〜40 秒）</Text>
      </View>
    );
  }

  const summaryMd = props.summaryMd;
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
    // ユーザーがシェアシートを閉じた場合や、Web Share API 非対応環境では
    // reject される。UX 上致命的ではないので静かに無視する。
    await Share.share({ message: shareText }).catch(() => undefined);
  };

  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>要約</Text>
        {props.cacheHit && <Text style={styles.cacheBadge}>cache</Text>}
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
