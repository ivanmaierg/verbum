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

// Book-frame drawn from docs/ui-sketches.md:
// Angled edges (╱/╲), two pages with scripture text, version between bottom edges,
// drop-shadow ░░░. Hint line sits BELOW the outer frame (verses must breathe — no
// decorations inside pages per ui-sketches.md).
const BOOK_FRAME = `
 ╱‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾╲╱‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾╲
│  ✦ Genesis 1:1                    │  ✦ John 3:16                      │
│                                   │                                   │
│  ${GENESIS_1_1_TEXT.slice(0, 33).padEnd(33)} │  ${JOHN_3_16_TEXT.slice(0, 33).padEnd(33)} │
│  ${GENESIS_1_1_TEXT.slice(33, 66).padEnd(33)} │  ${JOHN_3_16_TEXT.slice(33, 66).padEnd(33)} │
│  ${GENESIS_1_1_TEXT.slice(66, 99).padEnd(33)} │  ${JOHN_3_16_TEXT.slice(66, 99).padEnd(33)} │
│  ${GENESIS_1_1_TEXT.slice(99).padEnd(33)} │  ${JOHN_3_16_TEXT.slice(99, 132).padEnd(33)} │
│                                   │  ${JOHN_3_16_TEXT.slice(132).padEnd(33)} │
│                                   │                                   │
 ╲___________________________________╱${WELCOME_VERSION.padStart(4)}___________________________╱
   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░`;

export function WelcomeScreen({ state: _state, dispatch: _dispatch }: WelcomeScreenProps) {
  return (
    <box flexDirection="column">
      <text>{BANNER}</text>
      <text>{BOOK_FRAME}</text>
      <text>{"\n  ? help • q quit"}</text>
    </box>
  );
}
