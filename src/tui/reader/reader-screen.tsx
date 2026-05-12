import { useState, useEffect } from "react";
import { TextAttributes } from "@opentui/core";
import { SPINNER_FRAMES } from "@/cli/loading";
import { ACCENT_HEX } from "@/presentation/colors";
import { usePassageFetch } from "@/tui/reader/use-passage-fetch";
import { VERSES_PER_PAGE } from "@/tui/reader/reader-reducer";
import type { BibleRepository } from "@/application/ports/bible-repository";
import type { ReaderState, ReaderAction } from "@/tui/reader/reader-reducer";
import type { Dispatch } from "react";

const DIM = TextAttributes.DIM;
const INVERSE = TextAttributes.INVERSE;

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
    const id = setInterval(
      () => setFrame((f) => (f + 1) % SPINNER_FRAMES.length),
      80,
    );
    return () => clearInterval(id);
  }, [state.kind]);

  return (
    <box
      border
      borderStyle="single"
      title={titleFor(state)}
      bottomTitle={bottomTitleFor(state)}
      flexGrow={1}
    >
      <Body state={state} dispatch={dispatch} frame={frame} />
    </box>
  );
}

function titleFor(state: ReaderState): string {
  switch (state.kind) {
    case "awaiting":
      return " verbum ";
    case "loading":
    case "loaded":
    case "network-error":
      return ` ${state.ref.book} ${state.ref.chapter} — Berean Standard Bible `;
  }
}

function bottomTitleFor(state: ReaderState): string {
  switch (state.kind) {
    case "awaiting":
      return " Enter open  •  q quit ";
    case "loading":
      return " loading…  •  q quit ";
    case "loaded":
      return " ↑↓ verse  •  [ ] page  •  n p chapter  •  / palette  •  q quit ";
    case "network-error":
      return " / palette  •  q quit ";
  }
}

type BodyProps = {
  state: ReaderState;
  dispatch: Dispatch<ReaderAction>;
  frame: number;
};

function Body({ state, dispatch, frame }: BodyProps) {
  if (state.kind === "awaiting") {
    return (
      <box flexDirection="column">
        <text attributes={DIM}>{"  Type a reference, press Enter"}</text>
        <text>{" "}</text>
        <box width={50} marginLeft={2}>
          <input
            focused
            value={state.query}
            onChange={(v) => dispatch({ type: "QueryTyped", query: v })}
            onSubmit={() => dispatch({ type: "QuerySubmitted" })}
          />
        </box>
        {state.parseError !== null ? (
          <text>{`  ⚠ couldn't parse "${state.query}"`}</text>
        ) : null}
      </box>
    );
  }

  if (state.kind === "loading") {
    return (
      <text attributes={DIM}>{`  ${SPINNER_FRAMES[frame]} loading…`}</text>
    );
  }

  if (state.kind === "network-error") {
    const isLastChapter = state.reason.kind === "chapter_not_found";
    return (
      <text>
        {isLastChapter
          ? "  ⚠ last chapter reached"
          : "  ⚠ could not load — network unreachable"}
      </text>
    );
  }

  const { passage, cursorIndex, pageStartIndex } = state;
  const pageVerses = passage.verses.slice(pageStartIndex, pageStartIndex + VERSES_PER_PAGE);

  return (
    <box flexDirection="column">
      {pageVerses.map((v, i) => {
        const idx = pageStartIndex + i;
        const focused = idx === cursorIndex;
        return (
          <text key={v.number}>
            <span fg={focused ? ACCENT_HEX : undefined} attributes={focused ? undefined : DIM}>
              {focused ? "▶" : " "}
            </span>
            <span attributes={DIM}>{`${String(v.number).padStart(3)}  `}</span>
            <span attributes={focused ? INVERSE : undefined}>{v.text}</span>
          </text>
        );
      })}
    </box>
  );
}
