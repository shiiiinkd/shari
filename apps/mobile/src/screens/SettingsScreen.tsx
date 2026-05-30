import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii } from "../theme";

/**
 * Settings（設定タブ）: MVP はバージョン / about のみ（グレースケール・ブランド色なし）。
 * アカウント設定・利用状況・連携等は今後この枠を高機能化していく中で追加する。
 */
export function SettingsScreen() {
  // タブはヘッダ非表示のため、上部 safe-area inset は画面側で確保する。
  const insets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version ?? "—";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 28 }]}
    >
      <View style={styles.brand}>
        <Text style={styles.appName}>shari</Text>
        <Text style={styles.tagline}>YouTube 技術動画の日本語要約</Text>
      </View>

      <View style={styles.card}>
        <SettingsRow label="バージョン" detail={version} last />
      </View>

      <View style={styles.about}>
        <Text style={styles.aboutTitle}>このアプリについて</Text>
        <Text style={styles.aboutBody}>
          技術系 YouTube
          動画の字幕を取得し、日本のエンジニア向けに日本語で要約します。要約した動画はライブラリから再閲覧できます。
        </Text>
      </View>
    </ScrollView>
  );
}

/**
 * 設定行。`onPress` を渡したときだけ Pressable + chevron（タップ可能の affordance）にする。
 * 遷移先が無い行に chevron を出すと「押せそうで押せない」誤誘導になるため、明示的に分岐する。
 */
function SettingsRow({
  label,
  detail,
  last,
  onPress,
}: {
  label: string;
  detail?: string;
  last?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text style={styles.rowLabel}>{label}</Text>
      {detail && <Text style={styles.rowDetail}>{detail}</Text>}
      {onPress && <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.row,
          !last && styles.rowDivider,
          pressed && styles.rowPressed,
        ]}
        onPress={onPress}
        accessibilityRole="button"
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.row, !last && styles.rowDivider]}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 20,
  },
  brand: {
    alignItems: "center",
    gap: 6,
    marginBottom: 28,
  },
  appName: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: 0.26, // 0.01em
  },
  tagline: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: colors.bg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingHorizontal: 16,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowPressed: {
    backgroundColor: colors.surface,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
  },
  rowDetail: {
    fontSize: 14,
    color: colors.textTertiary,
    marginRight: 8,
  },
  about: {
    marginTop: 24,
    paddingHorizontal: 4,
    gap: 8,
  },
  aboutTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  aboutBody: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
});
