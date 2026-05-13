import { useEffect } from "react";
import type { Dispatch } from "react";
import { getChapter } from "@/application/get-chapter";
import type { BibleRepository } from "@/application/ports/bible-repository";
import { isRepoError } from "@/domain/errors";
import { DEFAULT_TRANSLATION_ID } from "@/domain/translations";
import type { ReaderState, ReaderAction } from "@/tui/reader/reader-reducer";

export function usePassageFetch(
  state: ReaderState,
  dispatch: Dispatch<ReaderAction>,
  repo: BibleRepository,
): void {
  useEffect(() => {
    if (state.kind !== "loading") return;

    let cancelled = false;
    const ref = state.ref;

    getChapter(repo, DEFAULT_TRANSLATION_ID, ref).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        dispatch({ type: "PassageFetched", passage: result.value });
      } else {
        const err = result.error;
        if (isRepoError(err)) {
          dispatch({ type: "FetchFailed", ref, reason: err });
        } else {
          dispatch({ type: "FetchFailed", ref, reason: { kind: "network", message: "parse error on response" } });
        }
      }
    });

    return () => {
      cancelled = true;
    };
  // ref is an object — spread the scalar fields as deps to avoid stale closure on navigation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind, state.kind === "loading" ? state.ref.book : null, state.kind === "loading" ? state.ref.chapter : null]);
}
