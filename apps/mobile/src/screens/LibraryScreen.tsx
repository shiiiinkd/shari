import type { LibraryHistoryItem } from "@shari/shared";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Skeleton } from "../components/Skeleton";
import { ERROR_CODE_DISPLAY, normalizeError } from "../lib/error";
import { formatRelativeTime } from "../lib/relativeTime";
import { trpc } from "../lib/trpc";
import { youtubeThumbnailUrl } from "../lib/youtube";
import type { LibraryScreenProps } from "../navigation/types";

type Props = LibraryScreenProps;

const PAGE_SIZE = 20;

/**
 * Library（ライブラリタブ）: 過去に要約した動画の履歴一覧。
 * library.history を useInfiniteQuery で range ページング（無限スクロール）。
 * 行タップで Result を閲覧モード（mode:"view" / 読み取り専用）で開く。
 */
export function LibraryScreen({ navigation }: Props) {
  // タブはヘッダ非表示のため、上部 safe-area inset は画面側で確保する。
  const insets = useSafeAreaInsets();
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = trpc.library.history.useInfiniteQuery(
    { limit: PAGE_SIZE },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      initialCursor: 0,
    },
  );

  const items = data?.pages.flatMap((p) => p.items) ?? [];

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const openSummary = useCallback(
    (videoId: string) => {
      navigation.navigate("Result", { videoId, mode: "view" });
    },
    [navigation],
  );

  // 初回ロード中はスケルトン（pull-to-refresh の再取得時は既存データを保持するので出さない）。
  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <SkeletonList />
      </View>
    );
  }

  // 初回ロードが失敗（データ皆無）。区分に応じた表示 + 再試行。
  if (isError && items.length === 0) {
    const display = ERROR_CODE_DISPLAY[normalizeError(error)];
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>履歴の取得に失敗しました</Text>
          <Text style={styles.errorMessage}>{display.displayMessage}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => void refetch()}
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>もう一度試す</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={
        items.length === 0
          ? styles.emptyContent
          : [styles.listContent, { paddingTop: insets.top + 16 }]
      }
      data={items}
      keyExtractor={(item) => item.videoId}
      renderItem={({ item }) => <HistoryRow item={item} onPress={openSummary} />}
      ItemSeparatorComponent={Separator}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.4}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
      ListEmptyComponent={<EmptyState />}
      ListFooterComponent={
        isFetchingNextPage ? (
          <View style={styles.footer}>
            <ActivityIndicator />
          </View>
        ) : null
      }
    />
  );
}

function HistoryRow({
  item,
  onPress,
}: {
  item: LibraryHistoryItem;
  onPress: (videoId: string) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const relative = formatRelativeTime(item.lastViewedAt);

  return (
    <Pressable
      style={styles.row}
      onPress={() => onPress(item.videoId)}
      accessibilityRole="button"
      accessibilityLabel={`${item.title} の要約を開く`}
    >
      <View style={styles.thumbWrap}>
        {!imageFailed && (
          <Image
            source={{ uri: youtubeThumbnailUrl(item.videoId) }}
            style={styles.thumb}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        )}
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.rowChannel} numberOfLines={1}>
          {item.channelName}
        </Text>
        {relative !== "" && <Text style={styles.rowDate}>{relative}</Text>}
      </View>
    </Pressable>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>まだ要約履歴がありません</Text>
      <Text style={styles.emptyHint}>要約タブから動画を要約すると、ここに履歴が残ります</Text>
    </View>
  );
}

function SkeletonList() {
  return (
    <View style={styles.listContent}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={120} height={68} borderRadius={8} />
          <View style={styles.rowBody}>
            <Skeleton height={15} />
            <Skeleton height={15} width="70%" />
            <Skeleton height={12} width="40%" style={styles.skeletonGap} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyContent: {
    flexGrow: 1,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  thumbWrap: {
    width: 120,
    height: 68,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#e8e8e8",
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
    lineHeight: 20,
  },
  rowChannel: {
    fontSize: 13,
    color: "#666",
  },
  rowDate: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: "#f0f0f0",
  },
  footer: {
    paddingVertical: 16,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#555",
  },
  emptyHint: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
  },
  skeletonGap: {
    marginTop: 2,
  },
  errorBox: {
    padding: 16,
    backgroundColor: "#fee",
    borderRadius: 8,
    gap: 6,
    alignItems: "flex-start",
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#c00",
  },
  errorMessage: {
    fontSize: 13,
    color: "#c00",
  },
  retryButton: {
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
});
