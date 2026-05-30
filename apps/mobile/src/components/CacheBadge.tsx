import { StyleSheet, Text } from "react-native";
import { radii, semantic } from "../theme";

/**
 * cache バッジ。ブランド色を使ってよい数少ない箇所の一つ（文字＝brandPressed / 背景＝brandSubtle）。
 * Result の新規生成成功時、キャッシュ再利用だったときだけ出す。
 */
export function CacheBadge() {
  return <Text style={styles.badge}>cache</Text>;
}

const styles = StyleSheet.create({
  badge: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.44, // 11 * 0.04em
    color: semantic.cacheBadgeText,
    backgroundColor: semantic.cacheBadgeBg,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.sm,
    overflow: "hidden", // iOS で背景に borderRadius を効かせる
  },
});
