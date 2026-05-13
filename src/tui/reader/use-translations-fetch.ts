import { useEffect } from "react";
import type { Dispatch } from "react";
import type { BibleRepository } from "@/application/ports/bible-repository";
import type { ReaderState, ReaderAction } from "@/tui/reader/reader-reducer";

export function useTranslationsFetch(
  state: ReaderState,
  dispatch: Dispatch<ReaderAction>,
  repo: BibleRepository,
): void {
  const pickerStatus = state.kind === "loaded" ? state.translationPicker?.status : undefined;

  useEffect(() => {
    if (state.kind !== "loaded" || state.translationPicker?.status !== "loading") return;

    let cancelled = false;

    repo.getTranslations().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        dispatch({ type: "TranslationsFetched", translations: result.value });
      } else {
        dispatch({ type: "TranslationFetchFailed" });
      }
    });

    return () => {
      cancelled = true;
    };
  // pickerStatus drives the effect — re-fire if picker transitions to "loading" again.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind, pickerStatus]);
}
