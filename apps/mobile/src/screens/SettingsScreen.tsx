import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { ScrollView, StyleSheet, Text, View } from "react-native";
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
        <Text style={styles.version}>バージョン {version}</Text>
      </View>

      <View style={styles.card}>
        <SettingsRow label="バージョン" detail={version} />
        <SettingsRow label="このアプリについて" last />
      </View>
    </ScrollView>
  );
}

function SettingsRow({ label, detail, last }: { label: string; detail?: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <Text style={styles.rowLabel}>{label}</Text>
      {detail && <Text style={styles.rowDetail}>{detail}</Text>}
      <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
    </View>
  );
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
  version: {
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
});
