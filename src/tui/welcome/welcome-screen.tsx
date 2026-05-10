// src/tui/welcome/welcome-screen.tsx — pure props-driven view for the welcome screen.
// No useState for business state. No useEffect. No imports from domain/application/api.
// The driver (tui-driver.tsx) owns useReducer; this component is a pure view (REQ-2 / NFR-5).
//
// OpenTUI primitives resolved from node_modules/@opentui/react:
//   <box>  — container with Yoga flexbox layout (BoxProps)
//   <text> — multi-line text node (TextProps)
//   <span> — inline run inside <text>, accepts its own attributes (SpanProps)
//
// Color system: monochrome minimal (see docs/ui-sketches.md, "Color philosophy").
// Dim is the only "color"; verse text always renders at default fg so the words
// remain the only fully-lit thing on screen.

import { TextAttributes } from "@opentui/core";
import { BANNER } from "@/cli/banner";
import {
  GENESIS_1_1_TEXT,
  JOHN_3_16_TEXT,
  WELCOME_VERSION,
} from "@/cli/welcome-content";
import type { WelcomeAction, WelcomeState } from "./welcome-reducer";

export type WelcomeScreenProps = {
  state: WelcomeState;
  dispatch: (action: WelcomeAction) => void;
};

const DIM = TextAttributes.DIM;
const BANNER_WIDTH = Math.max(...BANNER.split("\n").map((l) => l.length));

// Book-frame chrome rows. All `muted` — they frame the words but never compete with them.
const TOP_EDGE = " ╱‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾╲╱‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾╲";
const REF_ROW = "│  ✦ Genesis 1:1                    │  ✦ John 3:16                      │";
const UNDERLINE = "│   ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾ │ ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾   │";
const BLANK_INNER = "│                                   │                                   │";
const BOTTOM_EDGE = " ╲__________________________________╲╱_________________________________╱";
const SHADOW = "  ╲░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░╲╱░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░╱";
const RIBBON_1 = "                                                                  ┃";
const RIBBON_2 = "                                                                /";
const RIBBON_3 = "                                                                ▼";

// One row of verse text inside the open book. Frame characters and inter-page
// gutters render as <span attributes={DIM}>; the verse text itself stays at
// default fg — the only non-dim content on the welcome screen.
function VerseRow({ left, right }: { left: string; right: string }) {
  return (
    <text>
      <span attributes={DIM}>{"│  "}</span>
      {left.padEnd(33)}
      <span attributes={DIM}>{" │  "}</span>
      {right.padEnd(33)}
      <span attributes={DIM}>{" │"}</span>
    </text>
  );
}

export function WelcomeScreen({
  state: _state,
  dispatch: _dispatch,
}: WelcomeScreenProps) {
  const g = GENESIS_1_1_TEXT;
  const j = JOHN_3_16_TEXT;

  return (
    <box flexDirection="column">
      <text>{BANNER.trimEnd()}</text>
      <text attributes={DIM}>{WELCOME_VERSION.padStart(BANNER_WIDTH)}</text>

      <text>{" "}</text>
      <text attributes={DIM}>{TOP_EDGE}</text>
      <text attributes={DIM}>{REF_ROW}</text>
      <text attributes={DIM}>{UNDERLINE}</text>
      <VerseRow left={g.slice(0, 33)} right={j.slice(0, 33)} />
      <VerseRow left={g.slice(33, 66)} right={j.slice(33, 66)} />
      <VerseRow left={g.slice(66, 99)} right={j.slice(66, 99)} />
      <VerseRow left={g.slice(99)} right={j.slice(99, 132)} />
      <VerseRow left={""} right={j.slice(132)} />
      <text attributes={DIM}>{BLANK_INNER}</text>
      <text attributes={DIM}>{BOTTOM_EDGE}</text>
      <text attributes={DIM}>{SHADOW}</text>
      <text attributes={DIM}>{RIBBON_1}</text>
      <text attributes={DIM}>{RIBBON_2}</text>
      <text attributes={DIM}>{RIBBON_3}</text>

      <text>{" "}</text>
      <text attributes={DIM}>{"  ? help • q quit"}</text>
    </box>
  );
}
