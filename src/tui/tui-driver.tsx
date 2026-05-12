// src/tui/tui-driver.tsx — TUI runtime: renderer lifecycle, Promise exit.
// This is the ONLY file that holds the OpenTUI renderer handle.
// Uses standard useReducer (no shim) per ADR 0010.
// Quit is handled inline in useKeyboard — not via reducer Effect dispatch.
//
// OpenTUI API:
//   createCliRenderer() — async factory, returns Promise<CliRenderer>
//   createRoot(renderer).render(<App/>) — mounts the React tree
//   useReducer — standard React hook (supported by @opentui/react)
//   useKeyboard(handler) — hook from @opentui/react; subscribes to press events
//   KeyEvent.name — the key name string (e.g. "q", "Q", "return")
//   renderer.destroy() — synchronous teardown; restores terminal

import { useReducer } from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
import {
  welcomeReducer,
  initialWelcomeState,
  type WelcomeAction,
  type WelcomeState,
} from "./welcome/welcome-reducer";
import { WelcomeScreen } from "./welcome/welcome-screen";
import type { CliRenderer } from "@opentui/core";

// --- Inline <App> component ---

function App({
  renderer,
  resolve,
}: {
  renderer: CliRenderer;
  resolve: () => void;
}) {
  const [state, dispatch] = useReducer(welcomeReducer, initialWelcomeState);

  // useKeyboard hook — quit handled inline per ADR 0010.
  // q/Q → renderer.destroy() + resolve() directly (no reducer round-trip).
  // Other keys → dispatch to reducer (no-op for welcome screen).
  useKeyboard((keyEvent) => {
    if (keyEvent.name === "q" || keyEvent.name === "Q") {
      renderer.destroy();
      resolve();
      return;
    }
    dispatch({ type: "KeyPressed", key: keyEvent.name });
  });

  return <WelcomeScreen state={state} dispatch={dispatch} />;
}

// --- Public API ---

/**
 * Initialises the OpenTUI renderer, mounts the welcome screen, and returns a
 * Promise<void> that resolves when the user quits.
 * Does NOT call process.exit — that is the entry point's responsibility.
 */
export async function tuiDriver(): Promise<void> {
  // Non-TTY guard — exit cleanly without touching the renderer.
  if (!process.stdout.isTTY) {
    process.stderr.write(
      "verbum: interactive TUI requires a TTY — run without piping\n",
    );
    return;
  }

  // Minimum terminal size guard.
  const cols = process.stdout.columns ?? 0;
  const rows = process.stdout.rows ?? 0;
  if (cols < 60 || rows < 20) {
    process.stderr.write(
      `verbum: terminal too small (minimum 60×20, current ${cols}×${rows})\n`,
    );
    return;
  }

  const renderer = await createCliRenderer({
    exitOnCtrlC: false, // We handle SIGINT ourselves to use the same quit path.
  });

  return new Promise<void>((resolve) => {
    // SIGINT → same teardown path as pressing q.
    const sigintHandler = () => {
      renderer.destroy();
      resolve();
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
