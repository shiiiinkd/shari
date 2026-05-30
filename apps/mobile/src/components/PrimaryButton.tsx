import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radii, semantic, type } from "../theme";

/**
 * プライマリボタン（ブランド塗り）。ブランド色を使ってよい数少ない箇所の一つ。
 * 「要約する」/「再要約する」/「もう一度試す」など主アクションに使う。
 */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: disabled ? semantic.primaryFillDisabled : semantic.primaryFill },
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: "100%",
    minHeight: 50,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    backgroundColor: colors.brandPressed,
  },
  label: {
    color: colors.white,
    ...type.primaryBtn,
  },
});
