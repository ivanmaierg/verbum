// src/tui/welcome/welcome-reducer.ts — pure state machine for the welcome screen.
// Follows house-rules.md Rules 8 (plain useReducer) and ADR 0010 TypeScript-native dialect.
// Zero imports from OpenTUI, React, domain, application, or api.

/** The welcome screen has a single active state for this slice. */
export type WelcomeState = { kind: "active" };

/** Only one action variant needed for this slice. */
export type WelcomeAction = { type: "KeyPressed"; key: string };

/**
 * Pure reducer. Plain (state, action) => State per ADR 0010 (Rule 8 loosened).
 * Quit handling lives in the useKeyboard handler in tui-driver.tsx — not in the reducer.
 * - Any key → returns state unchanged (welcome screen has no state transitions).
 */
export function welcomeReducer(
  state: WelcomeState,
  action: WelcomeAction,
): WelcomeState {
  switch (action.type) {
    case "KeyPressed": {
      return state;
    }
  }
}

/** Initial state. */
export const initialWelcomeState: WelcomeState = { kind: "active" };
