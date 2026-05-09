// src/tui/welcome/welcome-screen.tsx — pure props-driven view for the welcome screen.
// No useState for business state. No useEffect. No imports from domain/application/api.
// The driver (tui-driver.tsx) owns useReducer; this component is a pure view (REQ-2 / NFR-5).
//
// OpenTUI primitives resolved from node_modules/@opentui/react:
//   <box> — container with Yoga flexbox layout (BoxProps)
//   <text> — multi-line text node (TextProps)

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

// Title block: wordmark + version. The version sits at the bottom-right corner
// of the wordmark, padded to the wordmark's max line width so it always
// right-aligns regardless of which figlet font/text is committed in banner.ts.
const BANNER_WIDTH = Math.max(...BANNER.split("\n").map((l) => l.length));
const TITLE = `${BANNER.trimEnd()}\n${WELCOME_VERSION.padStart(BANNER_WIDTH)}`;

// Book-frame drawn from docs/ui-sketches.md, with a bookmark ribbon (señalador
// de página) hanging from the right side. Angled edges (╱/╲), two pages with
// scripture text, drop-shadow ░░░ underneath, then a vertical ribbon. Hint
// line sits BELOW the ribbon. Verses breathe — no decorations inside pages.
const BOOK_FRAME = `

 ╱‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾╲╱‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾╲
│  ✦ Genesis 1:1                    │  ✦ John 3:16                      │
│   ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾ │ ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾   │
│  ${GENESIS_1_1_TEXT.slice(0, 33).padEnd(33)} │  ${JOHN_3_16_TEXT.slice(0, 33).padEnd(33)} │
│  ${GENESIS_1_1_TEXT.slice(33, 66).padEnd(33)} │  ${JOHN_3_16_TEXT.slice(33, 66).padEnd(33)} │
│  ${GENESIS_1_1_TEXT.slice(66, 99).padEnd(33)} │  ${JOHN_3_16_TEXT.slice(66, 99).padEnd(33)} │
│  ${GENESIS_1_1_TEXT.slice(99).padEnd(33)} │  ${JOHN_3_16_TEXT.slice(99, 132).padEnd(33)} │
│                                   │  ${JOHN_3_16_TEXT.slice(132).padEnd(33)} │
│                                   │                                   │
 ╲__________________________________╲╱_________________________________╱
  ╲░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░╲╱░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░╱
                                                                  ┃
                                                                /
                                                                ▼`;

export function WelcomeScreen({
  state: _state,
  dispatch: _dispatch,
}: WelcomeScreenProps) {
  return (
    <box flexDirection="column">
      <text>{TITLE}</text>

      <text>{BOOK_FRAME}</text>
      <text>{"\n  ? help • q quit"}</text>
    </box>
  );
}
