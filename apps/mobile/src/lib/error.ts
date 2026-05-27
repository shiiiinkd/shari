/**
 * mobile からエラー区分判別を扱う薄い窓口。
 * 実体は @shari/shared/errors。mobile 固有の挙動を足す場合のフック点として残す。
 */
export {
  ERROR_CODE_DISPLAY,
  normalizeError,
  type ErrorCode,
  type NormalizableError,
} from "@shari/shared/errors";
