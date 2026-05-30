import { useEffect, useState } from "react";
import { ERROR_CODE_DISPLAY, normalizeError, type ErrorCode } from "../lib/error";
import { trpc } from "../lib/trpc";
import type { ResultMode } from "../navigation/types";

/**
 * Result 画面の要約取得状態。
 * fresh = create（新規生成）経路で得たか。true のときだけ関連記事を出す。
 */
export type SummaryState =
  | { kind: "loading" }
  | { kind: "error"; code: ErrorCode; retryable: boolean; notCached: boolean }
  | { kind: "success"; summaryMd: string; cacheHit: boolean; fresh: boolean };

export interface UseSummaryResult {
  state: SummaryState;
  /** create（新規生成）経路が有効か。関連記事表示と「要約中」ヒントの出し分けに使う。 */
  isGenerating: boolean;
  /** 現在の経路を再実行（retryable エラー時の「もう一度試す」）。 */
  retry: () => void;
  /** view で保存が無いとき → create 経路へ切替（「再要約する」）。 */
  reSummarize: () => void;
}

/**
 * Result 画面の要約取得を mode 別に吸収するフック。
 *
 * - new : summary.create（mutation・字幕取得 + Claude 要約 + 利用ログ）を即実行。fresh=true。
 * - view: summary.get（query・読み取り専用）。NOT_FOUND(summary_not_cached) なら
 *         reSummarize() で create 経路へ手動切替（勝手に課金しない）。
 *
 * create は mutation、get は query という非対称をここで隠蔽し、画面には統一 state を渡す。
 */
export function useSummary(videoId: string, mode: ResultMode): UseSummaryResult {
  // 生成（create）を発動したか。new は最初から true、view は再要約で true になる。
  const [generating, setGenerating] = useState(mode === "new");

  const createMutation = trpc.summary.create.useMutation();
  const getQuery = trpc.summary.get.useQuery(
    { videoId, language: "ja" },
    // view で、まだ生成へ切り替えていない間だけ読み取りクエリを有効化。
    // 再要約後（generating=true）は get を止め create 経路の状態を見る。
    { enabled: mode === "view" && !generating, retry: false },
  );

  const { mutate: create } = createMutation;

  // generating の間、create を発火（mount 時 / 再要約への切替時）。
  useEffect(() => {
    if (generating) {
      create({ videoId, language: "ja" });
    }
  }, [generating, videoId, create]);

  let state: SummaryState;
  if (generating) {
    if (createMutation.error) {
      const code = normalizeError(createMutation.error);
      state = {
        kind: "error",
        code,
        retryable: ERROR_CODE_DISPLAY[code].retryable,
        notCached: false,
      };
    } else if (createMutation.data) {
      state = {
        kind: "success",
        summaryMd: createMutation.data.summaryMd,
        cacheHit: createMutation.data.cacheHit,
        fresh: true,
      };
    } else {
      state = { kind: "loading" };
    }
  } else if (getQuery.error) {
    const code = normalizeError(getQuery.error);
    state = {
      kind: "error",
      code,
      retryable: ERROR_CODE_DISPLAY[code].retryable,
      notCached: code === "SUMMARY_NOT_CACHED",
    };
  } else if (getQuery.data) {
    // 閲覧は常にキャッシュ読み。cache バッジは出さない（fresh=false）。
    state = { kind: "success", summaryMd: getQuery.data.summaryMd, cacheHit: false, fresh: false };
  } else {
    state = { kind: "loading" };
  }

  const retry = () => {
    if (generating) {
      create({ videoId, language: "ja" });
    } else {
      void getQuery.refetch();
    }
  };

  const reSummarize = () => {
    setGenerating(true);
  };

  return { state, isGenerating: generating, retry, reSummarize };
}
