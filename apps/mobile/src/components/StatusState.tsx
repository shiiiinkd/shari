import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";
import { PrimaryButton } from "./PrimaryButton";

/**
 * 落ち着いた中央レイアウトの状態画面（空 / エラー / not-found 共通）。
 * docs/design/illustrations.jsx の StatusState を移植。
 * ブランド色が出るのは任意の PrimaryButton だけ（art・テキストはグレースケール）。
 */
export function StatusState({
  art,
  title,
  body,
  primaryLabel,
  onPrimary,
}: {
  art: ReactNode;
  title: string;
  body: string;
  primaryLabel?: string;
  onPrimary?: () => void;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.art}>{art}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {primaryLabel && onPrimary && (
        <View style={styles.action}>
          <PrimaryButton label={primaryLabel} onPress={onPrimary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
  },
  art: {
    marginBottom: 22,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: "center",
  },
  body: {
    fontSize: 13.5,
    color: colors.textTertiary,
    lineHeight: 23, // 13.5 * 1.7
    maxWidth: 278,
    textAlign: "center",
  },
  action: {
    width: "100%",
    maxWidth: 300,
    marginTop: 28,
  },
});
