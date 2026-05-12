import { useState, useEffect } from "react";
import { TextAttributes } from "@opentui/core";
import { SPINNER_FRAMES } from "@/cli/loading";
import { usePassageFetch } from "@/tui/reader/use-passage-fetch";
import type { BibleRepository } from "@/application/ports/bible-repository";
import type { ReaderState, ReaderAction } from "@/tui/reader/reader-reducer";
import type { Dispatch } from "react";

const DIM = TextAttributes.DIM;

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
      return " ] next ch  •  [ prev ch  •  / palette  •  q quit ";
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
        <input
          focused
          value={state.query}
          onChange={(v) => dispatch({ type: "QueryTyped", query: v })}
          onSubmit={() => dispatch({ type: "QuerySubmitted" })}
        />
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

  return (
    <box flexDirection="column">
      {state.passage.verses.map((v) => (
        <text key={v.number}>
          <span attributes={DIM}>{`${String(v.number).padStart(3)}  `}</span>
          {v.text}
        </text>
      ))}
    </box>
  );
}
