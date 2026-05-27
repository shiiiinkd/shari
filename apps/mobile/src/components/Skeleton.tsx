import { useEffect, useRef } from "react";
import { Animated, StyleSheet, type DimensionValue, type ViewStyle } from "react-native";

type Props = {
  width?: DimensionValue;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
};

/**
 * Skeleton: opacity を 0.4 ↔ 1.0 でフェードさせるグレー矩形。
 * useNativeDriver は web では noop だが opacity は CSS で補間されるので問題なし。
 */
export function Skeleton({ width = "100%", height, borderRadius = 4, style }: Props) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.base, { width, height, borderRadius, opacity }, style]} />;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: "#e8e8e8",
  },
});
