import Svg, { Circle, Path } from "react-native-svg";

/**
 * 見つからないのスポットイラスト（書類＋虫眼鏡）。docs/design/illustrations.jsx を逐語移植。
 * グレースケールのみ。
 */
const ART_STROKE = "#bcc1ca";
const ART_LINE = "#d3d7dd";
const ART_FILL = "#ffffff";
const ART_BACK = "#f1f1f4";

export function ArtNotFound() {
  return (
    <Svg width={140} height={132} viewBox="0 0 140 132" fill="none">
      <Circle cx={70} cy={66} r={56} fill={ART_BACK} />
      <Path
        d="M48 36 h26 l14 14 v40 a4 4 0 0 1 -4 4 H48 a4 4 0 0 1 -4 -4 V40 a4 4 0 0 1 4 -4 Z"
        fill={ART_FILL}
        stroke={ART_STROKE}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <Path
        d="M74 36 v14 h14"
        fill="none"
        stroke={ART_STROKE}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <Path d="M53 60 h20 M53 70 h26" stroke={ART_LINE} strokeWidth={2.5} strokeLinecap="round" />
      <Circle cx={91} cy={84} r={14} fill="#fafafb" stroke="#aab0b8" strokeWidth={3} />
      <Path d="M101 94 l10 10" stroke="#aab0b8" strokeWidth={3.5} strokeLinecap="round" />
    </Svg>
  );
}
