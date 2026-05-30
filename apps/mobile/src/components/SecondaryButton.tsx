import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radii, semantic, type } from "../theme";

/**
 * セカンダリボタン（グレーのアウトライン・ブランド色なし）。
 * 「クリップボードから貼り付け」などの補助アクション。
 */
export function SecondaryButton({
  label,
  onPress,
  icon,
  full = false,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  full?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        full ? styles.full : styles.auto,
        pressed && styles.pressed,
      ]}
    >
      {icon && <Ionicons name={icon} size={18} color={colors.textSecondary} />}
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
    backgroundColor: colors.bg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  auto: {
    alignSelf: "flex-start",
  },
  full: {
    alignSelf: "stretch",
  },
  pressed: {
    backgroundColor: colors.surface,
  },
  label: {
    color: colors.textSecondary,
    ...type.secondaryBtn,
  },
});
