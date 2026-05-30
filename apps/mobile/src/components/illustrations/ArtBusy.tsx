import Svg, { Circle, Path } from "react-native-svg";

/**
 * 混雑/再試行のスポットイラスト（湯気の立つカップ＝「少し待って」）。
 * docs/design/illustrations.jsx を逐語移植。グレースケールのみ。
 */
const ART_STROKE = "#bcc1ca";
const ART_FILL = "#ffffff";
const ART_BACK = "#f1f1f4";

export function ArtBusy() {
  return (
    <Svg width={140} height={132} viewBox="0 0 140 132" fill="none">
      <Circle cx={70} cy={66} r={56} fill={ART_BACK} />
      <Path d="M59 38 q-7 -9 0 -18" stroke="#cdd1d8" strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M70 36 q-7 -9 0 -18" stroke="#cdd1d8" strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M81 38 q-7 -9 0 -18" stroke="#cdd1d8" strokeWidth={2.5} strokeLinecap="round" />
      <Path
        d="M47 54 h46 l-4 32 a11 11 0 0 1 -11 10 H62 a11 11 0 0 1 -11 -10 Z"
        fill={ART_FILL}
        stroke={ART_STROKE}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <Path
        d="M93 60 h6 a9 9 0 0 1 0 18 h-6"
        fill="none"
        stroke={ART_STROKE}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <Path d="M44 104 h50" stroke={ART_STROKE} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}
