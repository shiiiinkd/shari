import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import { colors } from "../theme";

/**
 * 回転スピナー（border-top を色付けした円を回す）。モックの shariSpin（0.8s linear）相当。
 * Library の追加読み込みフッタなどで使う。
 */
export function Spinner({
  size = 18,
  color = colors.textTertiary,
}: {
  size?: number;
  color?: string;
}) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Animated.View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderTopColor: color,
          transform: [{ rotate }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 2,
    borderColor: colors.skeleton,
  },
});
