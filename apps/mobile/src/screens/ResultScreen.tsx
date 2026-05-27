import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RelatedArticle } from "@shari/shared";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Markdown from "react-native-markdown-display";
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

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <SummarySection
        isPending={summaryMutation.isPending}
        error={summaryMutation.error?.message ?? null}
        summaryMd={summaryMutation.data?.summaryMd ?? null}
        cacheHit={summaryMutation.data?.cacheHit ?? null}
      />

      {summarySuccess && (
        <ArticlesSection
          isPending={articlesMutation.isPending}
          error={articlesMutation.error?.message ?? null}
          articles={articlesMutation.data?.articles ?? null}
        />
      )}
    </ScrollView>
  );
}

function SummarySection(props: {
  isPending: boolean;
  error: string | null;
  summaryMd: string | null;
  cacheHit: boolean | null;
}) {
  if (props.error) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorTitle}>要約取得に失敗しました</Text>
        <Text style={styles.errorMessage}>{props.error}</Text>
      </View>
    );
  }

  if (props.isPending || !props.summaryMd) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>字幕を取得して要約しています…</Text>
        <Text style={styles.loadingHint}>初回は 20〜40 秒ほどかかります</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>要約</Text>
        {props.cacheHit && <Text style={styles.cacheBadge}>cache</Text>}
      </View>
      <Markdown style={markdownStyles}>{props.summaryMd}</Markdown>
    </View>
  );
}

function ArticlesSection(props: {
  isPending: boolean;
  error: string | null;
  articles: readonly RelatedArticle[] | null;
}) {
  return (
    <View style={styles.articlesContainer}>
      <Text style={styles.sectionTitle}>関連記事</Text>

      {props.isPending && (
        <View style={styles.articlesLoading}>
          <ActivityIndicator />
          <Text style={styles.loadingHint}>Qiita を検索中…</Text>
        </View>
      )}

      {props.error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorMessage}>関連記事の取得に失敗: {props.error}</Text>
        </View>
      )}

      {!props.isPending && props.articles && props.articles.length === 0 && (
        <Text style={styles.emptyText}>関連記事が見つかりませんでした。</Text>
      )}

      {!props.isPending &&
        props.articles?.map((a) => (
          <Pressable
            key={a.url}
            style={styles.articleCard}
            onPress={() => {
              // Linking.openURL は失敗時に reject するため catch しないと
              // unhandled rejection になる。失敗してもユーザー体験への影響は小さいので静かに無視。
              Linking.openURL(a.url).catch(() => undefined);
            }}
          >
            <Text style={styles.articleSource}>{a.source}</Text>
            <Text style={styles.articleTitle}>{a.title}</Text>
          </Pressable>
        ))}
    </View>
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
  loadingBox: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: "#333",
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
  articlesContainer: {
    marginTop: 12,
    gap: 8,
  },
  articlesLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  emptyText: {
    fontSize: 13,
    color: "#777",
  },
  articleCard: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    backgroundColor: "#fafafa",
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
