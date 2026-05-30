/**
 * ナビゲーションの route 定義。
 *
 * 構造:
 *   RootStack(native-stack){ Tabs(bottom-tabs), Result }
 *   - Tabs: Summarize(要約・初期) / Library(ライブラリ) / Settings(設定)
 *   - Result: Tabs の上に全画面で push し、タブバーを覆う。
 *
 * Result が受け取るのは videoId と表示モードのみ。
 * 元 URL の表示は要約レスポンスのメタで行う想定で、route param には載せない
 * （深いリンク URL 化したとき扱いが煩雑になるため）。
 */
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps, NavigatorScreenParams } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

/**
 * Result の表示モード。
 * - new : 新規生成（summary.create / 字幕取得 + Claude 要約 + 利用ログ）。Summarize から。
 * - view: 保存済み閲覧（summary.get / 読み取り専用・再生成も課金もしない）。Library から。
 */
export type ResultMode = "new" | "view";

/** ボトムタブの route 定義。ラベルは日本語、route 名は英語。 */
export type TabParamList = {
  Summarize: undefined;
  Library: undefined;
  Settings: undefined;
};

/** RootStack の route 定義。Tabs 起点、Result を全画面 push。 */
export type RootStackParamList = {
  // ネストしたタブへ型安全に遷移できるよう NavigatorScreenParams で持つ
  // （例: Result から navigation.navigate("Tabs", { screen: "Summarize" })）。
  Tabs: NavigatorScreenParams<TabParamList>;
  Result: { videoId: string; mode: ResultMode };
};

/**
 * タブ内の screen は、タブ navigation と root stack navigation の双方へアクセスするため
 * CompositeScreenProps で両者を合成する（Result への push を root stack 経由で行う）。
 */
export type SummarizeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, "Summarize">,
  NativeStackScreenProps<RootStackParamList>
>;

export type LibraryScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, "Library">,
  NativeStackScreenProps<RootStackParamList>
>;

/** Settings は Result へ遷移しないためタブ props のみ。 */
export type SettingsScreenProps = BottomTabScreenProps<TabParamList, "Settings">;

/** Result は root stack の screen。 */
export type ResultScreenProps = NativeStackScreenProps<RootStackParamList, "Result">;
