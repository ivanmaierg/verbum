// src/tui/tui-driver.tsx — TUI runtime: renderer lifecycle, effect runner, Promise exit.
// This is the ONLY file that holds the OpenTUI renderer handle.
// Reducer is called TWICE per dispatch (ADR-DESIGN-WELCOME-6): once to extract the effect,
// once via baseDispatch to update React state. This is a TS-only quirk — Bubble Tea handles
// this natively. useRef is NOT used (house-rule 9: no escape hatches for business logic).
// The double-call is benign: welcomeReducer is a pure function with no IO.
//
// OpenTUI API resolved from node_modules:
//   createCliRenderer() — async factory, returns Promise<CliRenderer>
//   createRoot(renderer).render(<App/>) — mounts the React tree
//   useReducer — standard React hook (supported by @opentui/react)
//   useKeyboard(handler) — hook from @opentui/react; subscribes to press events
//   KeyEvent.name — the key name string (e.g. "q", "Q", "return")
//   renderer.destroy() — synchronous teardown; restores terminal
//   renderer.keyInput — KeyHandler (EventEmitter); emits "keypress" with KeyEvent
//   renderer.terminalWidth / renderer.terminalHeight — current terminal size

import { useReducer } from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
import {
  welcomeReducer,
  initialWelcomeState,
  type WelcomeAction,
  type WelcomeState,
  type Effect,
} from "./welcome/welcome-reducer";
import { WelcomeScreen } from "./welcome/welcome-screen";
import type { CliRenderer } from "@opentui/core";

// React's useReducer expects (state, action) => state. Our welcomeReducer returns
// [state, effect] per the ADR 0009 dialect. reactReducer drops the effect for React's
// purposes; the effect is read on the synchronous side via the dispatch wrapper inside
// <App> (ADR-DESIGN-WELCOME-6, double-call pattern).
const reactReducer = (s: WelcomeState, a: WelcomeAction): WelcomeState =>
  welcomeReducer(s, a)[0];

// --- Private helper ---

function runEffect(
  effect: Effect,
  renderer: CliRenderer,
  resolve: () => void,
): void {
  switch (effect.kind) {
    case "quit": {
      // Teardown sequence (ADR-DESIGN-WELCOME-4):
      // renderer.destroy() restores terminal raw mode → then resolve so the awaiting
      // process.exit(0) in src/index.tsx runs. If Bun's event loop refuses to drain,
      // the explicit process.exit(0) at the entry point is the belt-and-braces safety net.
      renderer.destroy();
      resolve();
      break;
    }
  }
}

// --- Inline <App> component (owns the reducer per ADR-DESIGN-WELCOME-6) ---

function App({
  renderer,
  resolve,
}: {
  renderer: CliRenderer;
  resolve: () => void;
}) {
  const [state, baseDispatch] = useReducer(reactReducer, initialWelcomeState);

  // Custom dispatch wrapper — ADR-DESIGN-WELCOME-6:
  // Call reducer once to read the effect (pure, no IO), then baseDispatch for React state.
  // currentState in this closure is always fresh because React guarantees that
  // useReducer re-renders synchronously before the next event is processed.
  const dispatch = (action: WelcomeAction) => {
    const [, effect] = welcomeReducer(state, action);
    baseDispatch(action);
    if (effect !== null) {
      runEffect(effect, renderer, resolve);
    }
  };

  // useKeyboard hook (from @opentui/react) — delivers KeyEvent on press.
  // KeyEvent.name is the key string (e.g. "q", "Q").
  useKeyboard((keyEvent) => {
    dispatch({ type: "KeyPressed", key: keyEvent.name });
  });

  return <WelcomeScreen state={state} dispatch={dispatch} />;
}

// --- Public API ---

/**
 * Initialises the OpenTUI renderer, mounts the welcome screen, and returns a
 * Promise<void> that resolves when the user quits (Effect.quit → renderer.destroy()).
 * Does NOT call process.exit — that is the entry point's responsibility (ADR-DESIGN-WELCOME-4).
 */
export async function tuiDriver(): Promise<void> {
  // NFR-2: non-TTY guard — exit cleanly without touching the renderer.
  if (!process.stdout.isTTY) {
    process.stderr.write(
      "verbum: interactive TUI requires a TTY — run without piping\n",
    );
    return;
  }

  // NFR-3: minimum terminal size guard.
  // terminalWidth/Height are available on process.stdout before renderer init.
  const cols = process.stdout.columns ?? 0;
  const rows = process.stdout.rows ?? 0;
  if (cols < 60 || rows < 20) {
    process.stderr.write(
      `verbum: terminal too small (minimum 60×20, current ${cols}×${rows})\n`,
    );
    return;
  }

  const renderer = await createCliRenderer({
    exitOnCtrlC: false, // We handle SIGINT ourselves to use the same quit path (SCN-3b).
  });

  return new Promise<void>((resolve) => {
    // SIGINT → same teardown path as pressing q (SCN-3b).
    const sigintHandler = () => {
      runEffect({ kind: "quit" }, renderer, resolve);
    };
    process.once("SIGINT", sigintHandler);

    // Clean up the SIGINT handler after we resolve so the process can exit normally.
    const wrappedResolve = () => {
      process.off("SIGINT", sigintHandler);
      resolve();
    };

    createRoot(renderer).render(
      <App renderer={renderer} resolve={wrappedResolve} />,
    );
  });
}
