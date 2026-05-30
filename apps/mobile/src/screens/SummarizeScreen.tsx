import { useFocusEffect } from "@react-navigation/native";
import { youtubeUrlSchema } from "@shari/shared";
import * as Clipboard from "expo-clipboard";
import { useCallback, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import type { SummarizeScreenProps } from "../navigation/types";
import { colors, radii, semantic, spacing, type } from "../theme";

type Props = SummarizeScreenProps;

/**
 * Summarize（要約タブ・初期画面）: YouTube URL を受け取り videoId 化 → Result へ遷移。
 *
 * クリップボード方針 (MVP):
 *   - 起動時 / 画面復帰時に Clipboard.hasUrlAsync() で URL 検出のみ行い、
 *     入っていれば「貼り付け」ボタンを表示する。
 *   - hasUrlAsync は中身を読まないため iOS の paste 通知を出さない。
 *   - 実際の貼り付けはユーザーがボタンを押した時に getStringAsync で行う。
 *   - 自動貼り付け / 設定 ON-OFF は Phase2 で扱う。
 */
export function SummarizeScreen({ navigation }: Props) {
  // タブはヘッダ非表示のため、上部 safe-area inset は画面側で確保する。
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hasClipboardUrl, setHasClipboardUrl] = useState(false);
  const [focused, setFocused] = useState(false);

  // useFocusEffect: Summarize が再度アクティブになるたび評価し直す。
  // Result から戻ってきた時にもクリップボードに新しい URL が入っていれば反映できる。
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Clipboard.hasUrlAsync()
        .then((hit) => {
          if (!cancelled) setHasClipboardUrl(hit);
        })
        .catch(() => {
          if (!cancelled) setHasClipboardUrl(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const handlePaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setUrl(text.trim());
        setError(null);
      }
    } catch {
      // 貼り付け失敗 → 手入力で続行できるので静かに無視
    }
  };

  const handleSubmit = () => {
    setError(null);
    const result = youtubeUrlSchema.safeParse(url.trim());
    if (!result.success) {
      setError("正しい YouTube URL を入力してください");
      return;
    }
    navigation.navigate("Result", { videoId: result.data, mode: "new" });
  };

  const canSubmit = url.trim().length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.field}>
        <Text style={styles.label}>YouTube URL を入力</Text>
        <View style={[styles.input, focused && styles.inputFocused]}>
          <TextInput
            style={styles.inputText}
            placeholder="https://www.youtube.com/watch?v=..."
            placeholderTextColor={colors.textTertiary}
            value={url}
            onChangeText={(v) => {
              setUrl(v);
              if (error) setError(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />
        </View>
      </View>

      {hasClipboardUrl && (
        <SecondaryButton
          label="クリップボードから貼り付け"
          icon="clipboard-outline"
          onPress={handlePaste}
        />
      )}

      <PrimaryButton label="要約する" onPress={handleSubmit} disabled={!canSubmit} />

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.screenPad,
    gap: spacing.md,
    backgroundColor: colors.bg,
  },
  field: {
    gap: 2,
    marginTop: spacing.sm,
  },
  label: {
    ...type.fieldLabel,
    color: colors.labelInk,
  },
  input: {
    minHeight: 50,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: semantic.inputBorder,
    backgroundColor: colors.bg,
  },
  inputFocused: {
    borderColor: semantic.inputFocusBorder,
  },
  inputText: {
    fontSize: 15.5,
    color: colors.textPrimary,
    padding: 0,
  },
  error: {
    fontSize: 13,
    color: colors.errorText,
  },
});
