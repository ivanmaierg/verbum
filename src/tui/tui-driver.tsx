import { useReducer, useState } from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
import { readerReducer, initialReaderState } from "./reader/reader-reducer";
import { ReaderScreen } from "./reader/reader-screen";
import { WelcomeScreen } from "./welcome/welcome-screen";
import { initialWelcomeState } from "./welcome/welcome-reducer";
import type { CliRenderer } from "@opentui/core";
import type { BibleRepository } from "@/application/ports/bible-repository";

type Phase = "welcome" | "reader";

function App({
  renderer,
  resolve,
  repo,
}: {
  renderer: CliRenderer;
  resolve: () => void;
  repo: BibleRepository;
}) {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [readerState, dispatch] = useReducer(readerReducer, initialReaderState);

  useKeyboard((keyEvent) => {
    const name = keyEvent.name.toLowerCase();
    if (name === "q") {
      renderer.destroy();
      resolve();
      return;
    }
    if (phase === "welcome") {
      setPhase("reader");
      return;
    }
    if (readerState.kind === "awaiting") {
      if (readerState.phase === "chapter") {
        if (name === "escape") { dispatch({ type: "PickerBackedOut" }); return; }
        if (name === "up") { dispatch({ type: "ChapterGridMovedUp" }); return; }
        if (name === "down") { dispatch({ type: "ChapterGridMovedDown" }); return; }
        if (name === "left") { dispatch({ type: "ChapterGridMovedLeft" }); return; }
        if (name === "right") { dispatch({ type: "ChapterGridMovedRight" }); return; }
        if (name === "tab") { dispatch({ type: "SuggestionAccepted" }); return; }
        return;
      }
      if (name === "down") { dispatch({ type: "SuggestionMovedDown" }); return; }
      if (name === "up") { dispatch({ type: "SuggestionMovedUp" }); return; }
      if (name === "tab") { dispatch({ type: "SuggestionAccepted" }); return; }
      return;
    }

    if (readerState.kind === "loaded" && readerState.translationPicker !== null) {
      if (name === "escape") { dispatch({ type: "TranslationPickerDismissed" }); return; }
      if (readerState.translationPicker.status !== "ready") return;
      if (name === "up") { dispatch({ type: "TranslationPickerMovedUp" }); return; }
      if (name === "down") { dispatch({ type: "TranslationPickerMovedDown" }); return; }
      if (name === "return") { dispatch({ type: "TranslationPickerAccepted" }); return; }
      if (name === "backspace") {
        dispatch({ type: "TranslationPickerQueryTyped", query: readerState.translationPicker.query.slice(0, -1) });
        return;
      }
      if (keyEvent.sequence && keyEvent.sequence.length === 1 && keyEvent.sequence >= " ") {
        dispatch({ type: "TranslationPickerQueryTyped", query: readerState.translationPicker.query + keyEvent.sequence });
        return;
      }
      return;
    }

    if (readerState.kind === "loaded" && readerState.versePicker !== null) {
      if (name === "up") { dispatch({ type: "VersePickerMovedUp" }); return; }
      if (name === "down") { dispatch({ type: "VersePickerMovedDown" }); return; }
      if (name === "left") { dispatch({ type: "VersePickerMovedLeft" }); return; }
      if (name === "right") { dispatch({ type: "VersePickerMovedRight" }); return; }
      if (name === "tab") { dispatch({ type: "VersePickerAccepted" }); return; }
      if (name === "return") { dispatch({ type: "VersePickerAccepted" }); return; }
      if (name === "escape") { dispatch({ type: "VersePickerCancelled" }); return; }
      return;
    }

    if (name === "up") { dispatch({ type: "CursorMovedUp" }); return; }
    if (name === "down") { dispatch({ type: "CursorMovedDown" }); return; }
    if (name === "[") { dispatch({ type: "PageRetreated" }); return; }
    if (name === "]") { dispatch({ type: "PageAdvanced" }); return; }
    if (name === "n") { dispatch({ type: "ChapterAdvanced" }); return; }
    if (name === "p") { dispatch({ type: "ChapterRetreated" }); return; }
    if (name === "t") { dispatch({ type: "TranslationPickerOpened" }); return; }
    if (name === "/") { dispatch({ type: "PaletteReopened" }); return; }
  });

  if (phase === "welcome") {
    return <WelcomeScreen state={initialWelcomeState} dispatch={() => {}} />;
  }
  return <ReaderScreen state={readerState} dispatch={dispatch} repo={repo} />;
}

// Resolves when the user quits. Does NOT call process.exit — that's the entry point's job.
export async function tuiDriver(repo: BibleRepository): Promise<void> {
  if (!process.stdout.isTTY) {
    process.stderr.write(
      "verbum: interactive TUI requires a TTY — run without piping\n",
    );
    return;
  }

  const cols = process.stdout.columns ?? 0;
  const rows = process.stdout.rows ?? 0;
  if (cols < 60 || rows < 20) {
    process.stderr.write(
      `verbum: terminal too small (minimum 60×20, current ${cols}×${rows})\n`,
    );
    return;
  }

  // exitOnCtrlC: false — we route SIGINT through the same quit path as `q`.
  const renderer = await createCliRenderer({ exitOnCtrlC: false });

  return new Promise<void>((resolve) => {
    const sigintHandler = () => {
      renderer.destroy();
      resolve();
    };
    process.once("SIGINT", sigintHandler);

    // wrappedResolve detaches the SIGINT listener so the process can exit normally after a q-quit.
    const wrappedResolve = () => {
      process.off("SIGINT", sigintHandler);
      resolve();
    };

    createRoot(renderer).render(
      <App renderer={renderer} resolve={wrappedResolve} repo={repo} />,
    );
  });
}
