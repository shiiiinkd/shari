import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, type DimensionValue, type ViewStyle } from "react-native";
import { colors, radii } from "../theme";

type Props = {
  width?: DimensionValue;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
};

/**
 * Skeleton: opacity を 0.45 ↔ 1.0 でフェードさせるグレー矩形（モックの shariPulse 1.5s ease-in-out 相当）。
 * useNativeDriver は web では noop だが opacity は CSS で補間されるので問題なし。
 */
export function Skeleton({ width = "100%", height, borderRadius = radii.sm, style }: Props) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
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
    backgroundColor: colors.skeleton,
  },
});
