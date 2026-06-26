import React from "react";
import renderer, { act } from "react-test-renderer";
import { Text, TouchableOpacity } from "react-native";
import TutorialModal from "../TutorialModal";
import { TUTORIAL_STEPS } from "../../tutorial/scriptedTutorial";

const getTextValues = (tree) =>
  tree.root.findAllByType(Text).map((node) => {
    const value = node.props.children;
    return Array.isArray(value) ? value.join("") : String(value);
  });

const pressButtonWithText = (tree, text) => {
  const button = tree.root.findAllByType(TouchableOpacity).find((node) =>
    node.findAllByType(Text).some((textNode) => textNode.props.children === text)
  );
  expect(button).toBeTruthy();
  act(() => {
    button.props.onPress();
  });
};

describe("TutorialModal", () => {
  it("renders scripted step progress and combo guidance", () => {
    const tree = renderer.create(
      <TutorialModal
        visible
        isDarkMode={false}
        step={TUTORIAL_STEPS[2]}
        stepIndex={2}
        totalSteps={TUTORIAL_STEPS.length}
        feedback={{ type: "success", text: TUTORIAL_STEPS[2].success }}
        completed={false}
        onSkip={jest.fn()}
        onHide={jest.fn()}
        onShow={jest.fn()}
      />
    );

    const texts = getTextValues(tree);
    expect(texts).toContain("Tutorial 3 of 4");
    expect(texts).toContain("Play RED");
    expect(texts).toContain("Target score: 26 | Combo bonus: +2");
    expect(texts).toContain("Combo started: +2. Keep the streak alive and the next bonus grows.");

    act(() => {
      tree.unmount();
    });
  });

  it("calls skip and hide handlers", () => {
    const onSkip = jest.fn();
    const onHide = jest.fn();
    const tree = renderer.create(
      <TutorialModal
        visible
        step={TUTORIAL_STEPS[0]}
        stepIndex={0}
        totalSteps={TUTORIAL_STEPS.length}
        onSkip={onSkip}
        onHide={onHide}
      />
    );

    pressButtonWithText(tree, "Skip");
    expect(onSkip).toHaveBeenCalledTimes(1);

    pressButtonWithText(tree, "OK");
    expect(onHide).toHaveBeenCalledTimes(1);

    act(() => {
      tree.unmount();
    });
  });

  it("shows completed combo total", () => {
    const onSkip = jest.fn();
    const tree = renderer.create(
      <TutorialModal
        visible
        completed
        feedback={{ type: "success", text: TUTORIAL_STEPS[3].success }}
        onSkip={onSkip}
      />
    );

    expect(getTextValues(tree)).toContain("Combo increased to +4");
    expect(getTextValues(tree)).toContain("Combo boosted: +4. Your bonus so far totals +6.");
    pressButtonWithText(tree, "Done");
    expect(onSkip).toHaveBeenCalledTimes(1);

    act(() => {
      tree.unmount();
    });
  });

  it("renders a floating reopen button when collapsed", () => {
    const onShow = jest.fn();
    const tree = renderer.create(
      <TutorialModal visible collapsed onShow={onShow} />
    );

    pressButtonWithText(tree, "Tutorial");
    expect(onShow).toHaveBeenCalledTimes(1);

    act(() => {
      tree.unmount();
    });
  });
});
