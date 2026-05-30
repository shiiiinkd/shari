/**
 * ISO8601 文字列を日本語の相対表記（「3日前」等）に変換する。
 *
 * Intl.RelativeTimeFormat は Hermes/Android で挙動が安定しないため、
 * 依存せず手書きの簡易フォーマッタにする（履歴一覧の日付表示専用）。
 * パース不能な入力は空文字を返し、行レイアウトを壊さない。
 */
const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return "";
  }
  const diffSec = Math.floor((now - then) / 1000);

  // 未来 / 1 分未満は「たった今」（時計ズレ含め直近として丸める）。
  if (diffSec < MINUTE) return "たった今";
  if (diffSec < HOUR) return `${Math.floor(diffSec / MINUTE)}分前`;
  if (diffSec < DAY) return `${Math.floor(diffSec / HOUR)}時間前`;
  if (diffSec < WEEK) return `${Math.floor(diffSec / DAY)}日前`;
  if (diffSec < MONTH) return `${Math.floor(diffSec / WEEK)}週間前`;
  if (diffSec < YEAR) return `${Math.floor(diffSec / MONTH)}か月前`;
  return `${Math.floor(diffSec / YEAR)}年前`;
}
