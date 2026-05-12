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

type ReaderScreenProps = {
  state: ReaderState;
  dispatch: Dispatch<ReaderAction>;
  repo: BibleRepository;
};

const PAGE_MAX_WIDTH = 70;

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

  const { width: termWidth } = useTerminalDimensions();
  const boxWidth = Math.min(PAGE_MAX_WIDTH, Math.max(40, termWidth - 4));

  return (
    <box flexDirection="column" alignItems="center" flexGrow={1} paddingTop={1}>
      <box
        border
        borderStyle="single"
        title={titleFor(state)}
        bottomTitle={bottomTitleFor(state)}
        width={boxWidth}
      >
        <Body state={state} dispatch={dispatch} frame={frame} boxWidth={boxWidth} />
      </box>
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

export function bottomTitleFor(state: ReaderState): string {
  switch (state.kind) {
    case "awaiting":
      return " Tab complete  •  ↑↓ suggest  •  Enter open  •  q quit ";
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
  boxWidth: number;
};

function Body({ state, dispatch, frame, boxWidth }: BodyProps) {
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
        {state.suggestions.length > 0 ? (
          <box flexDirection="column" marginTop={1} marginLeft={2}>
            {state.suggestions.map((s, i) => {
              const selected = i === state.selectedIndex;
              return (
                <text key={s.alias}>
                  <span fg={selected ? ACCENT_HEX : undefined}>
                    {selected ? "▶ " : "  "}
                  </span>
                  <span fg={selected ? ACCENT_HEX : undefined}>{s.displayName}</span>
                  {"  "}
                  <span attributes={DIM}>{s.canonical}</span>
                </text>
              );
            })}
          </box>
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
    <LoadedBody
      pageVerses={pageVerses}
      cursorIndex={cursorIndex}
      pageStartIndex={pageStartIndex}
      boxWidth={boxWidth}
    />
  );
}

// Prefix layout matches docs/ui-sketches.md Reading view (line 122):
//   "▶ 16 For God..." or "  16 For God..." — 5 chars before text, 5-space continuation.
const PREFIX_LEN = 5;
const CONTINUATION_INDENT = " ".repeat(PREFIX_LEN);

function LoadedBody({
  pageVerses,
  cursorIndex,
  pageStartIndex,
  boxWidth,
}: {
  pageVerses: Verse[];
  cursorIndex: number;
  pageStartIndex: number;
  boxWidth: number;
}) {
  const wrapWidth = Math.max(20, boxWidth - 2 - PREFIX_LEN);

  return (
    <box flexDirection="column" paddingTop={1} paddingBottom={1}>
      {pageVerses.flatMap((v, i) => {
        const idx = pageStartIndex + i;
        const focused = idx === cursorIndex;
        const lines = wordWrap(v.text, wrapWidth);
        const rows = lines.map((line, lineIdx) => (
          <text key={`${v.number}-${lineIdx}`}>
            {lineIdx === 0 ? (
              <>
                <span fg={focused ? ACCENT_HEX : undefined} attributes={focused ? undefined : DIM}>
                  {focused ? "▶" : " "}
                </span>
                <span attributes={DIM}>{` ${String(v.number).padStart(2)} `}</span>
              </>
            ) : (
              <span>{CONTINUATION_INDENT}</span>
            )}
            <span fg={focused ? ACCENT_HEX : undefined}>{line}</span>
          </text>
        ));
        // Blank row between verses (not after the last) — matches the sketch's vertical rhythm.
        if (i < pageVerses.length - 1) {
          rows.push(<text key={`gap-${v.number}`}>{" "}</text>);
        }
        return rows;
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
