import { describe, it, expect } from "bun:test";
import {
  welcomeReducer,
  initialWelcomeState,
} from "./welcome-reducer";

describe("welcomeReducer", () => {
  it('KeyPressed("q") returns initialWelcomeState unchanged', () => {
    const nextState = welcomeReducer(initialWelcomeState, {
      type: "KeyPressed",
      key: "q",
    });
    expect(nextState).toBe(initialWelcomeState);
  });

  it('KeyPressed("Q") returns initialWelcomeState unchanged', () => {
    const nextState = welcomeReducer(initialWelcomeState, {
      type: "KeyPressed",
      key: "Q",
    });
    expect(nextState).toBe(initialWelcomeState);
  });

  it('KeyPressed("x") returns initialWelcomeState unchanged — any key is a no-op', () => {
    const nextState = welcomeReducer(initialWelcomeState, {
      type: "KeyPressed",
      key: "x",
    });
    expect(nextState).toBe(initialWelcomeState);
  });

  it('initialWelcomeState.kind === "active"', () => {
    expect(initialWelcomeState.kind).toBe("active");
  });
});
