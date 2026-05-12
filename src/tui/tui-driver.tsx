import { useReducer } from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
import {
  welcomeReducer,
  initialWelcomeState,
} from "./welcome/welcome-reducer";
import { WelcomeScreen } from "./welcome/welcome-screen";
import type { CliRenderer } from "@opentui/core";

function App({
  renderer,
  resolve,
}: {
  renderer: CliRenderer;
  resolve: () => void;
}) {
  const [state, dispatch] = useReducer(welcomeReducer, initialWelcomeState);

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

// Resolves when the user quits. Does NOT call process.exit — that's the entry point's job.
export async function tuiDriver(): Promise<void> {
  if (!process.stdout.isTTY) {
    process.stderr.write(
      "verbum: interactive TUI requires a TTY — run without piping\n",
    );
    return;
  }

  const cols = process.stdout.columns ?? 0;
  const rows = process.stdout.rows ?? 0;
  if (cols < 60 || rows < 20) {
    process.stderr.write(
      `verbum: terminal too small (minimum 60×20, current ${cols}×${rows})\n`,
    );
    return;
  }

  // exitOnCtrlC: false — we route SIGINT through the same quit path as `q`.
  const renderer = await createCliRenderer({ exitOnCtrlC: false });

  return new Promise<void>((resolve) => {
    const sigintHandler = () => {
      renderer.destroy();
      resolve();
    };
    process.once("SIGINT", sigintHandler);

    // wrappedResolve detaches the SIGINT listener so the process can exit normally after a q-quit.
    const wrappedResolve = () => {
      process.off("SIGINT", sigintHandler);
      resolve();
    };

    createRoot(renderer).render(
      <App renderer={renderer} resolve={wrappedResolve} />,
    );
  });
}
