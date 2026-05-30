import Svg, { Circle, Path, Rect } from "react-native-svg";

/**
 * 履歴が空のスポットイラスト（動画カードの小さな積み重ね）。docs/design/illustrations.jsx を逐語移植。
 * グレースケールのみ（ブランド色は使わない）。
 */
const ART_STROKE = "#bcc1ca";
const ART_LINE = "#d3d7dd";
const ART_FILL = "#ffffff";
const ART_BACK = "#f1f1f4";

export function ArtNoHistory() {
  return (
    <Svg width={140} height={132} viewBox="0 0 140 132" fill="none">
      <Circle cx={70} cy={66} r={56} fill={ART_BACK} />
      <Rect
        x={38}
        y={44}
        width={56}
        height={32}
        rx={6}
        fill="#fafafb"
        stroke={ART_LINE}
        strokeWidth={2.5}
      />
      <Rect
        x={48}
        y={56}
        width={56}
        height={34}
        rx={6}
        fill={ART_FILL}
        stroke={ART_STROKE}
        strokeWidth={2.5}
      />
      <Path d="M70 65 l12 8 -12 8 Z" fill="#cdd1d8" />
    </Svg>
  );
}
