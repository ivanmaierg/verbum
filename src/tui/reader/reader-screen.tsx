import { useState, useEffect } from "react";
import { TextAttributes } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/react";
import { SPINNER_FRAMES } from "@/cli/loading";
import { ACCENT_HEX } from "@/presentation/colors";
import { usePassageFetch } from "@/tui/reader/use-passage-fetch";
import { VERSES_PER_PAGE } from "@/tui/reader/reader-reducer";
import type { BibleRepository } from "@/application/ports/bible-repository";
import type { ReaderState, ReaderAction } from "@/tui/reader/reader-reducer";
import type { Dispatch } from "react";
import type { Verse } from "@/domain/passage";

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
  return <LoadedBody pageVerses={pageVerses} cursorIndex={cursorIndex} pageStartIndex={pageStartIndex} />;
}

const PREFIX_LEN = 6; // 1 (gutter) + 3 (padded number) + 2 (spaces)
const CONTINUATION_INDENT = " ".repeat(PREFIX_LEN);

function LoadedBody({
  pageVerses,
  cursorIndex,
  pageStartIndex,
}: {
  pageVerses: Verse[];
  cursorIndex: number;
  pageStartIndex: number;
}) {
  // Subtract border (2) + prefix (6); guard against narrow terminals so we never wrap to 0.
  const { width } = useTerminalDimensions();
  const wrapWidth = Math.max(20, width - 2 - PREFIX_LEN);

  return (
    <box flexDirection="column">
      {pageVerses.flatMap((v, i) => {
        const idx = pageStartIndex + i;
        const focused = idx === cursorIndex;
        const lines = wordWrap(v.text, wrapWidth);
        return lines.map((line, lineIdx) => (
          <text key={`${v.number}-${lineIdx}`}>
            {lineIdx === 0 ? (
              <>
                <span fg={focused ? ACCENT_HEX : undefined} attributes={focused ? undefined : DIM}>
                  {focused ? "▶" : " "}
                </span>
                <span attributes={DIM}>{`${String(v.number).padStart(3)}  `}</span>
              </>
            ) : (
              <span>{CONTINUATION_INDENT}</span>
            )}
            <span attributes={focused ? INVERSE : undefined}>{line}</span>
          </text>
        ));
      })}
    </box>
  );
}

function wordWrap(text: string, width: number): string[] {
  if (width <= 0) return [text];
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= width) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
