jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

import { validatePlayerDisplayName } from "../playerProfile";

describe("validatePlayerDisplayName", () => {
  it("accepts ordinary usernames", () => {
    expect(validatePlayerDisplayName("WordFan_27")).toBeNull();
  });

  it("rejects obscene usernames", () => {
    expect(validatePlayerDisplayName("fucktiles")).toBe(
      "Username can't contain obscene language."
    );
  });

  it("rejects common leetspeak obscenities", () => {
    expect(validatePlayerDisplayName("sh1tstack")).toBe(
      "Username can't contain obscene language."
    );
  });
});
