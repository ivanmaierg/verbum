// src/tui/welcome/welcome-reducer.ts — pure state machine for the welcome screen.
// Follows house-rules.md Rules 8, 9, 10 and ADR 0009 Go-portability dialect.
// Portable to Bubble Tea: welcomeReducer ↔ Update(msg) (Model, Cmd)
// Zero imports from OpenTUI, React, domain, application, or api.

/** The welcome screen has a single active state for this slice. */
export type WelcomeState = { kind: "active" };

/** Past-tense fact name per house-rule 10. Only one action variant needed for this slice. */
export type WelcomeAction = { type: "KeyPressed"; key: string };

/** Effect discriminated union with `kind` field per house-rule 5.
 *  Only quit is needed for this slice. null = no effect. */
export type Effect = { kind: "quit" };

/**
 * Pure reducer. Signature mirrors Bubble Tea's Update(msg) (Model, Cmd).
 * - KeyPressed("q") | KeyPressed("Q") → [state, { kind: "quit" }]
 * - Any other key → [state, null]
 */
export function welcomeReducer(
  state: WelcomeState,
  action: WelcomeAction,
): [WelcomeState, Effect | null] {
  switch (action.type) {
    case "KeyPressed": {
      if (action.key === "q" || action.key === "Q") {
        return [state, { kind: "quit" }];
      }
      return [state, null];
    }
  }
}

/** Initial state. Equivalent to Bubble Tea's initialModel(). */
export const initialWelcomeState: WelcomeState = { kind: "active" };
