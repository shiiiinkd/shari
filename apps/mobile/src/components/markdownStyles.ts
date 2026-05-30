import { colors, fonts } from "../theme";

/**
 * react-native-markdown-display 用のスタイル。docs/design/data.jsx の MD_* に合わせる。
 * 要約本文は ## 見出し・箇条書き・インラインコード中心。
 */
export const markdownStyles = {
  body: { fontSize: 15, lineHeight: 25, color: colors.textPrimary },
  heading1: {
    fontSize: 20,
    fontWeight: "700" as const,
    marginTop: 18,
    marginBottom: 8,
    lineHeight: 26,
  },
  heading2: {
    fontSize: 17,
    fontWeight: "700" as const,
    marginTop: 18,
    marginBottom: 8,
    lineHeight: 22,
  },
  heading3: { fontSize: 16, fontWeight: "600" as const, marginTop: 12, marginBottom: 6 },
  paragraph: { marginTop: 0, marginBottom: 6 },
  bullet_list: { marginTop: 2, marginBottom: 8, paddingLeft: 20 },
  ordered_list: { marginTop: 2, marginBottom: 8, paddingLeft: 20 },
  list_item: { marginBottom: 7 },
  code_inline: {
    fontFamily: fonts.mono,
    fontSize: 13,
    backgroundColor: colors.surface3,
    color: colors.textPrimary,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  code_block: {
    fontFamily: fonts.mono,
    fontSize: 13,
    backgroundColor: colors.surface2,
    color: colors.textPrimary,
    padding: 8,
    borderRadius: 6,
  },
  fence: {
    fontFamily: fonts.mono,
    fontSize: 13,
    backgroundColor: colors.surface2,
    color: colors.textPrimary,
    padding: 8,
    borderRadius: 6,
  },
};
