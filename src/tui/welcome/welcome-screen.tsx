import { TextAttributes } from "@opentui/core";
import { BANNER_DIM_LINES, BANNER_ACCENT_LINES, BANNER_WIDTH } from "@/cli/banner";
import { ACCENT_HEX } from "@/presentation/colors";
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

const TOP_EDGE = " ╱‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾╲╱‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾╲";
const REF_ROW = "│  ✦ Genesis 1:1                    │  ✦ John 3:16                      │";
const UNDERLINE = "│   ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾ │ ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾   │";
const BLANK_INNER = "│                                   │                                   │";
const BOTTOM_EDGE = " ╲__________________________________╲╱_________________________________╱";
const SHADOW = "  ╲░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░╲╱░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░╱";
const RIBBON_1 = "                                                                  ┃";
const RIBBON_2 = "                                                                /";
const RIBBON_3 = "                                                                ▼";

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
      {BANNER_DIM_LINES.map((dimLine, i) => (
        <text key={i}>
          <span attributes={DIM}>{dimLine}</span>
          <span fg={ACCENT_HEX}>{BANNER_ACCENT_LINES[i] ?? ""}</span>
        </text>
      ))}
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
      <text attributes={DIM}>{"  any key to start  •  / palette  •  ] next ch  •  [ prev ch  •  q quit"}</text>
    </box>
  );
}
