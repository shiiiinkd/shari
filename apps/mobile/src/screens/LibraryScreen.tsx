import type { LibraryHistoryItem } from "@shari/shared";
import { useCallback, useState } from "react";
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Skeleton } from "../components/Skeleton";
import { Spinner } from "../components/Spinner";
import { StatusState } from "../components/StatusState";
import { ArtBusy, ArtNoHistory } from "../components/illustrations";
import { ERROR_CODE_DISPLAY, normalizeError } from "../lib/error";
import { formatRelativeTime } from "../lib/relativeTime";
import { trpc } from "../lib/trpc";
import { youtubeThumbnailUrl } from "../lib/youtube";
import type { LibraryScreenProps } from "../navigation/types";
import { colors, radii, type } from "../theme";

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
      <View style={[styles.container, { paddingTop: insets.top + 4 }]}>
        <SkeletonList />
      </View>
    );
  }

  // 初回ロードが失敗（データ皆無）。落ち着いた中央レイアウトで表示（赤箱は使わない）。
  // どんなエラーでも「もう一度試す」を出す。
  if (isError && items.length === 0) {
    const display = ERROR_CODE_DISPLAY[normalizeError(error)];
    return (
      <StatusState
        art={<ArtBusy />}
        title="うまく読み込めませんでした"
        body={display.displayMessage}
        primaryLabel="もう一度試す"
        onPrimary={() => void refetch()}
      />
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={
        items.length === 0
          ? styles.emptyContent
          : [styles.listContent, { paddingTop: insets.top + 4 }]
      }
      data={items}
      keyExtractor={(item) => item.videoId}
      renderItem={({ item }) => <HistoryRow item={item} onPress={openSummary} />}
      ItemSeparatorComponent={Separator}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.4}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={colors.textTertiary}
        />
      }
      ListEmptyComponent={<EmptyState />}
      ListFooterComponent={
        isFetchingNextPage ? (
          <View style={styles.footer}>
            <Spinner />
            <Text style={styles.footerText}>読み込み中</Text>
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
    <StatusState
      art={<ArtNoHistory />}
      title="まだ要約はありません"
      body="要約タブで動画を要約すると、ここに並んでいきます。"
    />
  );
}

function SkeletonList() {
  return (
    <View style={styles.skeletonWrap}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.row, i < 4 && styles.rowDivider]}>
          <Skeleton width={132} height={74} borderRadius={radii.md} />
          <View style={styles.skeletonBody}>
            <Skeleton height={13} width="92%" />
            <Skeleton height={13} width="64%" />
            <Skeleton height={11} width="34%" style={styles.skeletonGap} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  emptyContent: {
    flexGrow: 1,
  },
  skeletonWrap: {
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  thumbWrap: {
    width: 132,
    aspectRatio: 16 / 9,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    backgroundColor: colors.surface2,
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  rowBody: {
    flex: 1,
    gap: 3,
    paddingTop: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
    lineHeight: 20,
  },
  rowChannel: {
    ...type.channel,
    color: colors.textSecondary,
  },
  rowDate: {
    ...type.date,
    color: colors.textTertiary,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 18,
  },
  footerText: {
    ...type.caption,
    color: colors.textTertiary,
  },
  skeletonBody: {
    flex: 1,
    gap: 8,
    paddingTop: 3,
  },
  skeletonGap: {
    marginTop: 2,
  },
});
