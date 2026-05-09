// src/tui/welcome/welcome-reducer.test.ts — unit tests for the welcome screen reducer.
// No OpenTUI imports, no terminal allocation — pure function tests (REQ-6 / SCN-6c).

import { describe, it, expect } from "bun:test";
import {
  welcomeReducer,
  initialWelcomeState,
} from "./welcome-reducer";

describe("welcomeReducer", () => {
  it('KeyPressed("q") returns [state, { kind: "quit" }]', () => {
    // SCN-6a
    const [nextState, effect] = welcomeReducer(initialWelcomeState, {
      type: "KeyPressed",
      key: "q",
    });
    expect(effect).toEqual({ kind: "quit" });
    expect(nextState).toBe(initialWelcomeState);
  });

  it('KeyPressed("Q") returns [state, { kind: "quit" }]', () => {
    // SCN-6a (uppercase Q also quits)
    const [nextState, effect] = welcomeReducer(initialWelcomeState, {
      type: "KeyPressed",
      key: "Q",
    });
    expect(effect).toEqual({ kind: "quit" });
    expect(nextState).toBe(initialWelcomeState);
  });

  it('KeyPressed("x") returns [state, null] — any other key is a no-op', () => {
    // SCN-6b
    const [nextState, effect] = welcomeReducer(initialWelcomeState, {
      type: "KeyPressed",
      key: "x",
    });
    expect(effect).toBeNull();
    expect(nextState).toBe(initialWelcomeState);
  });

  it('initialWelcomeState.kind === "active"', () => {
    // Verify initial state shape
    expect(initialWelcomeState.kind).toBe("active");
  });
});
