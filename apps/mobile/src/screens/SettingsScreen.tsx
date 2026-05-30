import Constants from "expo-constants";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Settings（設定タブ）: MVP はバージョン / about のみ。
 * アカウント設定・利用状況・連携等は今後この枠を高機能化していく中で追加する。
 */
export function SettingsScreen() {
  // タブはヘッダ非表示のため、上部 safe-area inset は画面側で確保する。
  const insets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version ?? "—";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <View style={styles.brand}>
        <Text style={styles.appName}>shari</Text>
        <Text style={styles.appTagline}>YouTube 技術動画の日本語要約</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>バージョン</Text>
          <Text style={styles.rowValue}>{version}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.aboutTitle}>このアプリについて</Text>
        <Text style={styles.aboutBody}>
          技術系 YouTube 動画の字幕を取得し、日本のエンジニア向けに日本語で要約します。
          要約した動画はライブラリから再閲覧できます。
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 20,
    gap: 24,
  },
  brand: {
    alignItems: "center",
    gap: 4,
    marginTop: 12,
  },
  appName: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0a7",
  },
  appTagline: {
    fontSize: 13,
    color: "#777",
  },
  section: {
    gap: 6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    backgroundColor: "#fafafa",
  },
  rowLabel: {
    fontSize: 15,
    color: "#333",
  },
  rowValue: {
    fontSize: 15,
    color: "#777",
  },
  aboutTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    paddingHorizontal: 2,
  },
  aboutBody: {
    fontSize: 14,
    lineHeight: 21,
    color: "#444",
    paddingHorizontal: 2,
  },
});
