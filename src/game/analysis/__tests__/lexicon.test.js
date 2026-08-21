import { buildLexicon } from "../lexicon";

describe("analysis lexicon", () => {
  it("filters curated invalid dictionary entries", () => {
    const lexicon = buildLexicon(["at", "oneer", "lettice", "aaron"]);

    expect(lexicon.isValid("at")).toBe(true);
    expect(lexicon.isValid("oneer")).toBe(false);
    expect(lexicon.isValid("lettice")).toBe(false);
    expect(lexicon.isValid("aaron")).toBe(false);
  });
});
