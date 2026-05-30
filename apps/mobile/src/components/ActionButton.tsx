import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radii, semantic, type } from "../theme";

/**
 * アクションボタン（surface 塗りのアウトライン・ブランド色なし）。
 * Result の「コピー」「シェア」。done=true で完了アイコン（checkmark）に差し替える。
 */
export function ActionButton({
  label,
  onPress,
  icon,
  done = false,
}: {
  label: string;
  onPress: () => void;
  icon: keyof typeof Ionicons.glyphMap;
  done?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.base, pressed && styles.pressed]}
    >
      <Ionicons name={done ? "checkmark" : icon} size={17} color={colors.textSecondary} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: semantic.inputBorder,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  pressed: {
    backgroundColor: colors.surface2,
  },
  label: {
    color: colors.textSecondary,
    ...type.actionBtn,
  },
});
