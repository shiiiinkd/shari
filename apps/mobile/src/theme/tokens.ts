/**
 * shari モバイルのデザイントークン（単一の真実）。
 * 値は docs/design/kit.jsx の C{} と screens.jsx を 1:1 で写したもの。
 *
 * 配色規律（YouTube 式「1色集中」）:
 *   ブランドのインディゴ系（`colors.brand` / `brandPressed` / `brandSubtle`）を使ってよいのは
 *   次の限られた箇所だけ。それ以外は必ずグレースケールにする。
 *     1. アクティブタブのインジケーター線＋アイコン・ラベル（TabNavigator）
 *     2. プライマリボタン「要約する」等の塗り（PrimaryButton）
 *     3. cache バッジ（CacheBadge）
 *     4. URL 入力のフォーカス境界・リング（SummarizeScreen の UrlInput）
 *   画面側は原則 `semantic.*` とグレースケール `colors.*` を参照し、`colors.brand` を直接使わない。
 *
 * ライトテーマ固定（app.config.ts: userInterfaceStyle "light"）。
 * ダーク対応は別マイルストーンのため context / provider は持たず、ただの typed object として import する。
 */
import { Platform } from "react-native";

export const colors = {
  brand: "#4f46e5",
  brandPressed: "#3730a3",
  brandSubtle: "#eef2ff",
  bg: "#ffffff",
  surface: "#fafafa",
  surface2: "#f4f4f6",
  surface3: "#f0f0f2",
  textPrimary: "#11161d",
  textSecondary: "#666666",
  textTertiary: "#9aa0a8",
  textDisabled: "#aab0b8",
  border: "#ececef",
  border2: "#dcdfe4",
  errorText: "#cc0000",
  errorBg: "#fdeceb",
  skeleton: "#e8e8ec",
  /** Summarize の FieldLabel 専用インク（screens.jsx LABEL_INK）。 */
  labelInk: "#333a44",
  /** ブランド塗り上のテキスト。 */
  white: "#ffffff",
} as const;

/**
 * 役割ベースの別名。画面はこれを参照することで「ブランド色は3箇所だけ」を名前で担保する。
 * （画面に `colors.brand` が直接現れたら規律違反のサイン）
 */
export const semantic = {
  tabActive: colors.brand,
  tabInactive: colors.textSecondary,
  primaryFill: colors.brand,
  primaryFillDisabled: colors.textDisabled,
  cacheBadgeText: colors.brandPressed,
  cacheBadgeBg: colors.brandSubtle,
  inputFocusBorder: colors.brand,
  inputFocusRing: colors.brandSubtle,
  inputBorder: colors.border2,
  divider: colors.border,
} as const;

export const radii = {
  sm: 5, // バッジ・スケルトン・インラインコード
  md: 8, // カード・セカンダリ/アクションボタン・サムネ
  lg: 10, // 入力欄・プライマリボタン・記事カード
  xl: 12, // 設定カード
  pill: 100,
} as const;

export const spacing = {
  screenPad: 24, // Summarize 画面パディング
  resultPad: 20, // Result 画面パディング
  listPadH: 20, // Library / Settings 横パディング
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 28,
} as const;

/**
 * タイポグラフィ。モックの実値（小数含む。RN は小数 fontSize を受け付ける）。
 * lineHeight は RN では絶対値が安全なため、モックの倍率を掛けた px 値で持つ。
 */
export const type = {
  // 見出し・本文
  sectionTitle: { fontSize: 18, fontWeight: "700" } as const,
  mdH2: { fontSize: 17, fontWeight: "700", lineHeight: 22 } as const,
  body: { fontSize: 15, lineHeight: 25 } as const,
  // ラベル・補助
  fieldLabel: { fontSize: 14, fontWeight: "500" } as const,
  channel: { fontSize: 12.5 } as const,
  date: { fontSize: 12 } as const,
  caption: { fontSize: 12.5 } as const,
  hint: { fontSize: 12.5 } as const,
  // ボタン
  primaryBtn: { fontSize: 16, fontWeight: "700" } as const,
  secondaryBtn: { fontSize: 14, fontWeight: "500" } as const,
  actionBtn: { fontSize: 13, fontWeight: "600" } as const,
} as const;

export const fonts = {
  /** 本文は OS 既定（iOS=San Francisco/Hiragino, Android=Roboto/Noto）。明示指定しない。 */
  system: undefined,
  /** 等幅（コード）。 */
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
} as const;

/** デバイス幅基準（モック=390）。スケルトン幅の % 換算などに使う。 */
export const SCREEN = { width: 390, height: 844 } as const;

export type Colors = typeof colors;
export type Semantic = typeof semantic;
