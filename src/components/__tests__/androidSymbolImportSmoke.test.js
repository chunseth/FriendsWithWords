jest.mock("../SFSymbolIcon", () => require("../SFSymbolIcon.android"));
jest.mock("react-native-sfsymbols", () => {
  throw new Error(
    "react-native-sfsymbols should not be imported in Android smoke checks"
  );
});
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock("react-native-linear-gradient", () => "LinearGradient");
jest.mock("react-native-reanimated", () => ({
  runOnJS: (fn) => fn,
}));
jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  return {
    GestureHandlerRootView: ({ children }) => children,
    GestureDetector: ({ children }) => children,
    Gesture: {
      Pan: () => {
        const chain = {
          minPointers: () => chain,
          maxPointers: () => chain,
          minDistance: () => chain,
          onBegin: () => chain,
          onUpdate: () => chain,
          onEnd: () => chain,
        };
        return chain;
      },
    },
  };
});

describe("android symbol import smoke", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("loads MainMenuScreen without importing iOS symbols", () => {
    expect(() => require("../MainMenuScreen")).not.toThrow();
  });

  it("loads MultiplayerMenuScreen without importing iOS symbols", () => {
    expect(() => require("../MultiplayerMenuScreen")).not.toThrow();
  });

  it("loads MultiplayerModeScreen without importing iOS symbols", () => {
    expect(() => require("../MultiplayerModeScreen")).not.toThrow();
  });

  it("loads EndGameModal without importing iOS symbols", () => {
    expect(() => require("../EndGameModal")).not.toThrow();
  });
});
