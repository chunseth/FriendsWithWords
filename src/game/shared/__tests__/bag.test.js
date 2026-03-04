import { createShuffledTileBag, hashSeed } from "../bag";

describe("bag seed hashing", () => {
  it("does not map adjacent daily seeds to adjacent hash values", () => {
    const march1 = hashSeed("20260301");
    const march2 = hashSeed("20260302");
    const march3 = hashSeed("20260303");

    expect(Math.abs(march1 - march2)).toBeGreaterThan(1_000_000);
    expect(Math.abs(march2 - march3)).toBeGreaterThan(1_000_000);
  });

  it("produces deterministic shuffled bags for the same seed", () => {
    const first = createShuffledTileBag("20260301").tileBag
      .slice(-7)
      .map((tile) => tile.letter)
      .join("");
    const second = createShuffledTileBag("20260301").tileBag
      .slice(-7)
      .map((tile) => tile.letter)
      .join("");

    expect(first).toBe(second);
  });
});
