import { useState, useEffect } from "react";
import { TextAttributes } from "@opentui/core";
import { SPINNER_FRAMES } from "@/cli/loading";
import { ACCENT_HEX } from "@/presentation/colors";
import { usePassageFetch } from "@/tui/reader/use-passage-fetch";
import type { BibleRepository } from "@/application/ports/bible-repository";
import type { ReaderState, ReaderAction } from "@/tui/reader/reader-reducer";
import type { Dispatch } from "react";

const DIM = TextAttributes.DIM;
const BOLD = TextAttributes.BOLD;

type ReaderScreenProps = {
  state: ReaderState;
  dispatch: Dispatch<ReaderAction>;
  repo: BibleRepository;
};

export function ReaderScreen({ state, dispatch, repo }: ReaderScreenProps) {
  usePassageFetch(state, dispatch, repo);

  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (state.kind !== "loading") return;
    const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length), 80);
    return () => clearInterval(id);
  }, [state.kind]);

  if (state.kind === "awaiting") {
    return (
      <box flexDirection="column">
        <text attributes={DIM}>{"╭───────────────────────────────────────╮"}</text>
        <text>
          <span attributes={DIM}>{"│ ▶ "}</span>
          <input
            focused
            value={state.query}
            onChange={(v) => dispatch({ type: "QueryTyped", query: v })}
            onSubmit={() => dispatch({ type: "QuerySubmitted" })}
          />
          <span attributes={DIM}>{" │"}</span>
        </text>
        {state.parseError !== null && (
          <text fg={"\x1b[31m"}>{`│ ⚠ couldn't parse "${state.query}"`.padEnd(41) + "│"}</text>
        )}
        <text attributes={DIM}>{"╰───────────────────────────────────────╯"}</text>
        <text>{" "}</text>
        <text attributes={DIM}>{"  Enter open  •  Esc cancel  •  q quit"}</text>
      </box>
    );
  }

  if (state.kind === "loading") {
    return (
      <box flexDirection="column">
        <text attributes={DIM}>{`  ${SPINNER_FRAMES[frame]} loading…`}</text>
      </box>
    );
  }

  if (state.kind === "network-error") {
    const isLastChapter = state.reason.kind === "chapter_not_found";
    return (
      <box flexDirection="column">
        <text>
          <span attributes={DIM}>{"┌─ "}</span>
          <span fg={ACCENT_HEX} attributes={BOLD}>{`${state.ref.book} ${state.ref.chapter}`}</span>
          <span attributes={DIM}>{" ─────────────────────────────────────┐"}</span>
        </text>
        <text>{" "}</text>
        <text>{isLastChapter ? "  ⚠ last chapter reached" : "  ⚠ could not load — network unreachable"}</text>
        <text>{" "}</text>
        <text attributes={DIM}>{"└──────────────────────────────────────────────────────────────────┘"}</text>
        <text attributes={DIM}>{"  / palette  •  q quit"}</text>
      </box>
    );
  }

  const { passage, ref } = state;
  return (
    <box flexDirection="column">
      <text>
        <span attributes={DIM}>{"┌─ "}</span>
        <span fg={ACCENT_HEX} attributes={BOLD}>{`${ref.book} ${ref.chapter}`}</span>
        <span attributes={DIM}>{" ─ Berean Standard Bible ─────────────────────────────┐"}</span>
      </text>
      <text attributes={DIM}>{"│"}</text>
      {passage.verses.map((v) => (
        <text key={v.number}>
          <span attributes={DIM}>{`│  ${String(v.number).padStart(3)}  `}</span>
          {v.text}
          <span attributes={DIM}>{"  │"}</span>
        </text>
      ))}
      <text attributes={DIM}>{"│"}</text>
      <text attributes={DIM}>{"├──────────────────────────────────────────────────────────────────┤"}</text>
      <text attributes={DIM}>{"│  ] next ch  •  [ prev ch  •  / palette  •  q quit               │"}</text>
      <text attributes={DIM}>{"└──────────────────────────────────────────────────────────────────┘"}</text>
    </box>
  );
}
