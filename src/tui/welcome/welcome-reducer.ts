export type WelcomeState = { kind: "active" };

export type WelcomeAction = { type: "KeyPressed"; key: string };

// Quit handling lives in tui-driver.tsx (useKeyboard), not in this reducer.
const handlers = {
  KeyPressed: (state: WelcomeState, _action: WelcomeAction): WelcomeState => state,
} satisfies {
  [K in WelcomeAction["type"]]: (
    state: WelcomeState,
    action: Extract<WelcomeAction, { type: K }>,
  ) => WelcomeState;
};

export function welcomeReducer(
  state: WelcomeState,
  action: WelcomeAction,
): WelcomeState {
  return handlers[action.type](state, action);
}

export const initialWelcomeState: WelcomeState = { kind: "active" };
